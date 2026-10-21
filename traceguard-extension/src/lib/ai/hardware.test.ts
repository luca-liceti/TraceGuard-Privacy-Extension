import { describe, expect, it } from 'vitest';
import {
    BETTER_MODEL,
    FUNCTIONAL_MODEL,
    IMPROVED_SUMMARY_MODEL,
    OUTSTANDING_MODEL,
    SUMMARY_ONLY_MODEL,
    classifyRenderer,
    cleanGpuName,
    detectHardware,
    pullCommand,
    recommendFor,
} from './hardware';

describe('cleanGpuName', () => {
    it('unwraps the ANGLE prefix and the Direct3D suffix', () => {
        expect(cleanGpuName('ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)'))
            .toBe('NVIDIA GeForce GTX 1660 Ti');
    });

    it('drops the Linux PCIe suffix, using the string this project recorded on a real machine', () => {
        expect(cleanGpuName('ANGLE (NVIDIA Corporation, NVIDIA GeForce GTX 1660 Ti/PCIe/SSE2, OpenGL 4.5.0)'))
            .toBe('NVIDIA GeForce GTX 1660 Ti');
    });

    it('unwraps the Metal renderer on macOS', () => {
        expect(cleanGpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)'))
            .toBe('Apple M2 Pro');
    });

    it('keeps a plain renderer string', () => {
        expect(cleanGpuName('Apple M3')).toBe('Apple M3');
    });
});

describe('classifyRenderer', () => {
    it('reads known desktop card names and their memory', () => {
        expect(classifyRenderer('NVIDIA GeForce RTX 4070').vramGb).toBe(12);
        expect(classifyRenderer('NVIDIA GeForce RTX 4090').vramGb).toBe(24);
        expect(classifyRenderer('NVIDIA GeForce GTX 1660 Ti').vramGb).toBe(6);
        expect(classifyRenderer('NVIDIA GeForce GTX 1660 Ti').kind).toBe('discrete');
    });

    it('prefers the 16 GB variant of a card that ships in two sizes', () => {
        expect(classifyRenderer('NVIDIA GeForce RTX 4060 Ti 16GB').vramGb).toBe(16);
        expect(classifyRenderer('NVIDIA GeForce RTX 4060 Ti').vramGb).toBe(8);
        expect(classifyRenderer('NVIDIA GeForce RTX 3060 12GB').vramGb).toBe(12);
    });

    it('recognises Apple Silicon and integrated graphics', () => {
        expect(classifyRenderer('Apple M2 Pro').kind).toBe('apple');
        expect(classifyRenderer('Intel(R) UHD Graphics 630').kind).toBe('integrated');
        expect(classifyRenderer('AMD Radeon Graphics').kind).toBe('integrated');
    });

    it('treats a software renderer as no real GPU', () => {
        expect(classifyRenderer('Google SwiftShader').kind).toBe('software');
    });

    it('leaves an unknown card without a memory estimate', () => {
        const result = classifyRenderer('Some Future GPU 9000');
        expect(result.kind).toBe('unknown');
        expect(result.vramGb).toBeNull();
    });
});

describe('recommendFor', () => {
    it('suggests the outstanding tier from 24 GB and up', () => {
        expect(recommendFor('discrete', 24).model).toBe(OUTSTANDING_MODEL);
        expect(recommendFor('discrete', 32).tier).toBe('outstanding');
    });

    it('suggests the better tier from 12 GB', () => {
        expect(recommendFor('discrete', 12).model).toBe(BETTER_MODEL);
        expect(recommendFor('discrete', 16).model).toBe(BETTER_MODEL);
    });

    it('suggests the functional tier from 10 GB, which is the policy-report floor', () => {
        expect(recommendFor('discrete', 10).model).toBe(FUNCTIONAL_MODEL);
        expect(recommendFor('discrete', 10).tier).toBe('functional');
    });

    it('keeps a 6 GB card on summaries only', () => {
        const profile = recommendFor('discrete', 6);
        expect(profile.tier).toBe('summaries');
        expect(profile.model).toBe(IMPROVED_SUMMARY_MODEL);
        expect(profile.note).toContain('10 GB');
    });

    it('recommends a higher rung for Apple Silicon without claiming memory', () => {
        const profile = recommendFor('apple', null, 'Apple M2 Pro');
        expect(profile.model).toBe(FUNCTIONAL_MODEL);
        expect(profile.vramGb).toBeNull();
        expect(profile.note).toContain('24 GB');
    });

    it('falls back to the smallest model without a usable GPU', () => {
        expect(recommendFor('integrated', null).model).toBe(SUMMARY_ONLY_MODEL);
        expect(recommendFor('software', null).model).toBe(SUMMARY_ONLY_MODEL);
        expect(recommendFor('unknown', null).model).toBe(SUMMARY_ONLY_MODEL);
    });
});

describe('detectHardware', () => {
    it('always resolves to a usable recommendation', async () => {
        const profile = await detectHardware();
        expect(profile.model.length).toBeGreaterThan(0);
        expect(profile.sizeGb).toMatch(/GB$/);
        expect(['summaries', 'functional', 'better', 'outstanding']).toContain(profile.tier);
    });
});

describe('pullCommand', () => {
    it('builds the command the user pastes into a terminal', () => {
        expect(pullCommand(FUNCTIONAL_MODEL)).toBe('ollama pull qwen3.5:9b');
    });
});
