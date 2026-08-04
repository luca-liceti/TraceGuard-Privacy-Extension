import { describe, expect, it } from 'vitest';
import { calculateFingerprintingScore, calculateWSS } from './scoring';
import type { ScoreBreakdown } from './types';

const perfect: ScoreBreakdown = {
    reputation: 100, tracking: 100, cookies: 100, fingerprinting: 100, input: 100, policy: 100,
};

describe('calculateWSS', () => {
    it('returns 100 and 0 for perfect and worst complete breakdowns', () => {
        expect(calculateWSS(perfect)).toBe(100);
        expect(calculateWSS({ ...perfect, reputation: 0, tracking: 0, cookies: 0, fingerprinting: 0, input: 0, policy: 0 })).toBe(0);
    });

    it('uses the documented 25/25/15/15/10/10 weights', () => {
        expect(calculateWSS({ ...perfect, reputation: 0, tracking: 0, cookies: 0, fingerprinting: 0, input: 0, policy: 0 })).toBe(0);
        expect(calculateWSS({ ...perfect, tracking: 0 })).toBe(75);
        expect(calculateWSS({ ...perfect, fingerprinting: 0 })).toBe(85);
        expect(calculateWSS({ ...perfect, policy: 0 })).toBe(90);
    });

    it('redistributes the policy weight when ToS;DR has no rating', () => {
        expect(calculateWSS({ ...perfect, policy: 50 })).toBe(100);
        expect(calculateWSS({ ...perfect, tracking: 0, policy: 50 })).toBe(72);
    });

    it('clamps invalid scores and treats missing legacy fingerprinting as neutral', () => {
        expect(calculateWSS({ ...perfect, reputation: 150, tracking: -1, fingerprinting: undefined })).toBe(75);
    });
});

describe('calculateFingerprintingScore', () => {
    it('penalizes detected techniques logarithmically', () => {
        expect(calculateFingerprintingScore([])).toBe(100);
        expect(calculateFingerprintingScore(['canvas'])).toBeLessThan(100);
        expect(calculateFingerprintingScore(['canvas', 'webgl', 'audio'])).toBeLessThan(calculateFingerprintingScore(['canvas']));
    });
});
