import { describe, it, expect, vi, beforeEach } from 'vitest';

// The loader caches the index and shards at module scope, so each test imports
// it fresh. fetch is stubbed to serve the bundled asset URLs from a map.

const INDEX = {
    updatedAt: 111,
    shardCount: 64,
    count: 1,
    entries: {
        'instructure.com': {
            grade: 'D',
            score: 40,
            serviceId: 2392,
            serviceName: 'Instructure',
            shard: 7,
            serviceUpdatedAt: '2026-07-22T03:00:02.559212',
        },
    },
};

const SHARD = {
    'instructure.com': {
        points: [{ title: 'Third parties may be involved', classification: 'bad' }],
        documents: [{ name: 'Marketing Privacy Policy', url: 'https://www.instructure.com/policies/marketing-privacy' }],
    },
};

function mockFetch(map: Record<string, unknown>) {
    global.fetch = vi.fn(async (url: unknown) => {
        const key = String(url).split('/assets/')[1];
        if (key && key in map) {
            return { ok: true, json: async () => map[key] } as unknown as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
}

describe('getTosDRRecord', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('combines the index entry with its detail shard', async () => {
        mockFetch({ 'tosdr-index.json': INDEX, 'tosdr/details/7.json': SHARD });
        const { getTosDRRecord } = await import('./database-loader');

        const record = await getTosDRRecord('instructure.com');
        expect(record.found).toBe(true);
        expect(record.grade).toBe('D');
        expect(record.score).toBe(40);
        expect(record.serviceName).toBe('Instructure');
        expect(record.points).toHaveLength(1);
        expect(record.documents[0].name).toBe('Marketing Privacy Policy');
        expect(record.lastUpdated).toBe(111);
    });

    it('returns undefined for a domain the index does not rate', async () => {
        mockFetch({ 'tosdr-index.json': INDEX, 'tosdr/details/7.json': SHARD });
        const { getTosDRRecord } = await import('./database-loader');

        expect(await getTosDRRecord('unknown.example')).toBeUndefined();
    });

    it('falls back to the legacy single-file dataset when no index exists', async () => {
        mockFetch({ 'tosdr-data.json': { 'legacy.com': { found: true, grade: 'A', score: 100 } } });
        const { getTosDRRecord } = await import('./database-loader');

        const record = await getTosDRRecord('legacy.com');
        expect(record.grade).toBe('A');
        expect(record.score).toBe(100);
    });
});
