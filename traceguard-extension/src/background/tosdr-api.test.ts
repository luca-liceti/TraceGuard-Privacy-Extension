import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the bundled seed database so tests control exactly what "known" ratings
// exist without hitting chrome-extension:// URLs in Node's fetch.
vi.mock('./services/database-loader', () => ({
    getTosDRRecord: vi.fn().mockResolvedValue(undefined),
}));

// Keep the other utils exports real and stub only the network call the lookup
// makes, so a test can control exactly what ToS;DR returns.
vi.mock('../lib/utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/utils')>();
    return { ...actual, fetchWithTimeout: vi.fn() };
});

// The real rate limiter spaces calls over time; tests run the queued fn at once.
vi.mock('../lib/rate-limiter', () => ({
    rateLimiters: { tosdr: { execute: (fn: () => Promise<unknown>) => fn() } },
}));

import { checkTosDR, clearTosDRCache } from './tosdr-api';
import { getTosDRRecord } from './services/database-loader';
import { fetchWithTimeout } from '../lib/utils';

describe('checkTosDR', () => {
    beforeEach(() => {
        // Module-level cache survives between tests; reset so each test reads
        // the storage it seeded.
        clearTosDRCache();
        vi.mocked(getTosDRRecord).mockResolvedValue(undefined);
    });

    it('returns a local fallback for an unknown domain when cloud is disabled', async () => {
        // Cloud ToS;DR defaults to off; with no seed/cache hit the result must
        // fall back without making any network request.
        const result = await checkTosDR('https://totally-unknown-domain-xyz.com');
        expect(result.found).toBe(false);
        expect(result.source).toBe('fallback');
    });

    it('does not let a negative cache entry shadow a bundled seed rating', async () => {
        // Regression: a failed cloud lookup cached "not found" for a domain
        // that the bundled catalog actually rates. Before the fix this hid the
        // known rating for up to refreshDays (7 days).
        await chrome.storage.local.set({
            tosdr_cache: {
                'google.com': {
                    data: { found: false, score: 0, source: 'fallback' },
                    timestamp: Date.now(), // fresh negative
                },
            },
        });
        vi.mocked(getTosDRRecord).mockResolvedValue({
            found: true,
            grade: 'E',
            score: 20,
            source: 'tosdr-local',
            serviceName: 'Google',
            serviceId: 217,
        });

        const result = await checkTosDR('https://www.google.com');
        expect(result.found).toBe(true);
        expect(result.grade).toBe('E');
        expect(result.score).toBe(20);
    });

    it('reads the grade from the search endpoint rating object when the detail rating is N/A', async () => {
        // Regression: the search endpoint returns rating as { hex, human, letter },
        // while the detail endpoint returns a plain letter. Passing the object to
        // gradeToScore threw "toUpperCase is not a function", which the catch
        // swallowed into a silent miss even for a service ToS;DR had graded.
        await chrome.storage.local.set({ settings: { enableCloudTosdr: true } });
        vi.mocked(fetchWithTimeout)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    parameters: {
                        services: [{
                            id: '11619',
                            name: 'Anthropic (Claude)',
                            rating: { hex: '#d66f2c', human: 'D', letter: 'D' },
                            urls: ['anthropic.com', 'claude.ai'],
                        }],
                    },
                }),
            } as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    parameters: {
                        name: 'Anthropic (Claude)',
                        rating: 'N/A',
                        urls: ['anthropic.com'],
                        points: [],
                        documents: [],
                    },
                }),
            } as any);

        const result = await checkTosDR('https://www.anthropic.com');
        expect(result.found).toBe(true);
        expect(result.grade).toBe('D');
        expect(result.score).toBe(40);
        expect(result.serviceName).toBe('Anthropic (Claude)');
    });

    it('treats an unrated service as a found result with no grade, not a crash', async () => {
        await chrome.storage.local.set({ settings: { enableCloudTosdr: true } });
        vi.mocked(fetchWithTimeout)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    parameters: {
                        services: [{
                            id: '9999',
                            name: 'Unrated Service',
                            rating: { hex: '#000000', human: 'N/A', letter: 'N/A' },
                            urls: ['unrated.example'],
                        }],
                    },
                }),
            } as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    parameters: { name: 'Unrated Service', rating: 'N/A', urls: ['unrated.example'], points: [], documents: [] },
                }),
            } as any);

        const result = await checkTosDR('https://unrated.example');
        expect(result.found).toBe(true);
        expect(result.grade).toBeUndefined();
        expect(result.score).toBe(0);
    });

    it('trusts the cached negative when the seed has no rating either', async () => {
        await chrome.storage.local.set({
            tosdr_cache: {
                'niche-site.com': {
                    data: { found: false, score: 0, source: 'fallback' },
                    timestamp: Date.now(),
                },
            },
        });

        const result = await checkTosDR('https://niche-site.com');
        expect(result.found).toBe(false);
        expect(result.source).toBe('fallback');
    });
});