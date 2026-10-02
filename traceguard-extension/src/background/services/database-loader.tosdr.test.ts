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
        // The per-service version drives per-rating staleness and the catalog sync.
        expect(record.serviceUpdatedAt).toBe('2026-07-22T03:00:02.559212');
    });

    it('returns undefined for a domain the index does not rate', async () => {
        mockFetch({ 'tosdr-index.json': INDEX, 'tosdr/details/7.json': SHARD });
        const { getTosDRRecord } = await import('./database-loader');

        expect(await getTosDRRecord('unknown.example')).toBeUndefined();
    });

    it('keeps a service ToS;DR catalogued but did not grade, scored neutral', async () => {
        // A service can carry points and documents with an N/A rating; it should
        // still resolve, show N/A, and not be scored as dangerous.
        const index = {
            updatedAt: 222,
            shardCount: 64,
            count: 1,
            entries: {
                'claude.ai': { score: 50, serviceId: 11619, serviceName: 'Anthropic (Claude)', shard: 7 },
            },
        };
        const shard = {
            'claude.ai': { points: [{ title: 'Some documented point', classification: 'bad' }], documents: [] },
        };
        mockFetch({ 'tosdr-index.json': index, 'tosdr/details/7.json': shard });
        const { getTosDRRecord } = await import('./database-loader');

        const record = await getTosDRRecord('claude.ai');
        expect(record.found).toBe(true);
        expect(record.grade).toBeUndefined();
        expect(record.score).toBe(50);
        expect(record.points).toHaveLength(1);
    });

    it('keeps at most four detail shards resident', async () => {
        // Memory stays flat however many sites are visited: touching more than
        // four shards evicts the least-recently-used, which then re-reads from
        // its local file rather than a network call.
        const entries: Record<string, any> = {};
        const map: Record<string, unknown> = {};
        for (let shard = 0; shard < 6; shard++) {
            const domain = `site${shard}.com`;
            entries[domain] = { score: 40, serviceId: shard, serviceName: domain, shard };
            map[`tosdr/details/${shard}.json`] = { [domain]: { points: [], documents: [] } };
        }
        map['tosdr-index.json'] = { updatedAt: 1, shardCount: 6, count: 6, entries };
        mockFetch(map);
        const { getTosDRRecord } = await import('./database-loader');

        for (let shard = 0; shard < 6; shard++) {
            await getTosDRRecord(`site${shard}.com`);
            const loads = (global.fetch as any).mock.calls.filter((c: unknown[]) => String(c[0]).includes('/details/')).length;
            expect(loads).toBe(shard + 1);
        }

        // site0's shard was evicted after six loads; reading it again re-fetches.
        await getTosDRRecord('site0.com');
        const loads = (global.fetch as any).mock.calls.filter((c: unknown[]) => String(c[0]).includes('/details/')).length;
        expect(loads).toBe(7);
    });

    it('returns undefined when the index is absent', async () => {
        mockFetch({});
        const { getTosDRRecord } = await import('./database-loader');

        expect(await getTosDRRecord('instructure.com')).toBeUndefined();
    });

    it('exposes the catalog build time and per-service versions for the sync', async () => {
        mockFetch({ 'tosdr-index.json': INDEX, 'tosdr/details/7.json': SHARD });
        const { getTosdrCatalogMeta } = await import('./database-loader');

        const meta = await getTosdrCatalogMeta();
        expect(meta?.updatedAt).toBe(111);
        expect(meta?.versions.get('2392')).toBe('2026-07-22T03:00:02.559212');
    });
});
