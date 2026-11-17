import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptData, exportKey, generateAesKey } from './crypto';
import {
    SITE_CACHE_MAX_SITES,
    SITE_CACHE_PREFIX,
    enforceSiteCacheCap,
    ensureSiteCacheMigrated,
    readSiteCache,
    readSiteEntry,
    replaceSiteCache,
    resetSiteCacheStateForTests,
    siteCacheShard,
    siteCacheShardKey,
    writeSiteCacheEntry,
} from './site-cache';
import type { SiteRiskData } from './types';

function site(domain: string, lastAnalyzed: number): SiteRiskData {
    return {
        domain,
        wss: 80,
        breakdown: { reputation: 80, tracking: 80, cookies: 80, input: 80, policy: 80 },
        lastAnalyzed,
    };
}

function setMock() {
    return chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>;
}

async function newKey(): Promise<CryptoKey> {
    const key = await generateAesKey();
    await chrome.storage.session.set({ cryptoKeyHex: await exportKey(key) });
    return key;
}

beforeEach(() => {
    resetSiteCacheStateForTests();
});

describe('shard layout', () => {
    it('maps a domain to a stable shard in range', () => {
        const shard = siteCacheShard('example.com');
        expect(shard).toBe(siteCacheShard('example.com'));
        expect(shard).toBeGreaterThanOrEqual(0);
        expect(shard).toBeLessThan(64);
        expect(siteCacheShardKey(shard)).toBe(`${SITE_CACHE_PREFIX}${String(shard).padStart(2, '0')}`);
    });

    it('does not put a domain name in a storage key', () => {
        expect(siteCacheShardKey(siteCacheShard('private.example'))).not.toContain('private');
    });
});

describe('writeSiteCacheEntry', () => {
    it('writes only the shard of the analyzed domain', async () => {
        const key = await newKey();
        const set = setMock();
        set.mockClear();

        expect(await writeSiteCacheEntry(site('a.example', 1), key)).toBe(true);

        expect(set).toHaveBeenCalledTimes(1);
        const written = set.mock.calls[0][0] as Record<string, unknown>;
        expect(Object.keys(written)).toEqual([siteCacheShardKey(siteCacheShard('a.example'))]);
        expect(await readSiteEntry('a.example', key)).toMatchObject({ domain: 'a.example', wss: 80 });
    });

    it('does not rewrite a different shard when a second domain is analyzed', async () => {
        const key = await newKey();
        const first = 'a.example';
        let second = '';
        let index = 0;
        do {
            second = `other${index}.example`;
            index += 1;
        } while (siteCacheShard(second) === siteCacheShard(first));

        await writeSiteCacheEntry(site(first, 1), key);
        const firstShard = siteCacheShardKey(siteCacheShard(first));
        const before = (await chrome.storage.local.get(firstShard))[firstShard];

        const set = setMock();
        set.mockClear();
        expect(await writeSiteCacheEntry(site(second, 2), key)).toBe(true);

        expect(set).toHaveBeenCalledTimes(1);
        expect(Object.keys(set.mock.calls[0][0] as Record<string, unknown>))
            .toEqual([siteCacheShardKey(siteCacheShard(second))]);
        expect((await chrome.storage.local.get(firstShard))[firstShard]).toBe(before);
        expect(await readSiteEntry(first, key)).toMatchObject({ domain: first });
    });

    it('refuses to overwrite a shard it cannot decrypt', async () => {
        const key = await newKey();
        const shardKey = siteCacheShardKey(siteCacheShard('a.example'));
        await chrome.storage.local.set({ [shardKey]: 'not-decryptable' });

        expect(await writeSiteCacheEntry(site('a.example', 1), key)).toBe(false);
        expect((await chrome.storage.local.get(shardKey))[shardKey]).toBe('not-decryptable');
    });
});

describe('migration', () => {
    it('splits the legacy blob once and removes it', async () => {
        const key = await newKey();
        await chrome.storage.local.set({
            siteCache: await encryptData(key, { 'old.example': site('old.example', 5) }),
        });

        expect(await ensureSiteCacheMigrated(key)).toBe(true);
        expect((await chrome.storage.local.get('siteCache')).siteCache).toBeUndefined();
        expect(await readSiteEntry('old.example', key)).toMatchObject({ wss: 80 });
    });

    it('reports failure and keeps the legacy blob when it cannot be decrypted', async () => {
        const key = await newKey();
        await chrome.storage.local.set({ siteCache: 'not-decryptable' });

        expect(await ensureSiteCacheMigrated(key)).toBe(false);
        expect((await chrome.storage.local.get('siteCache')).siteCache).toBe('not-decryptable');
    });
});

describe('replaceSiteCache', () => {
    it('replaces the whole cache instead of merging', async () => {
        const key = await newKey();
        await writeSiteCacheEntry(site('old.example', 1), key);

        expect(await replaceSiteCache({ 'new.example': site('new.example', 2) }, key)).toBe(true);
        expect(await readSiteEntry('old.example', key)).toBeUndefined();
        expect(await readSiteEntry('new.example', key)).toMatchObject({ wss: 80 });
    });
});

describe('enforceSiteCacheCap', () => {
    it('keeps the most recently analyzed domains', async () => {
        const key = await newKey();
        const shards: Record<string, Record<string, SiteRiskData>> = {};
        for (let index = 0; index <= SITE_CACHE_MAX_SITES; index += 1) {
            const entry = site(`site-${index}.example`, index);
            const shardKey = siteCacheShardKey(siteCacheShard(entry.domain));
            (shards[shardKey] ??= {})[entry.domain] = entry;
        }
        // Plaintext maps are accepted by the reader, so seeding is fast.
        await chrome.storage.local.set(shards);

        await enforceSiteCacheCap(key);

        const cache = await readSiteCache(key);
        expect(Object.keys(cache)).toHaveLength(SITE_CACHE_MAX_SITES);
        expect(cache['site-0.example']).toBeUndefined();
        expect(cache['site-1.example']).toBeDefined();
    }, 20000);
});
