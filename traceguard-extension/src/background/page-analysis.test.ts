import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportKey, generateAesKey } from '../lib/crypto';
import {
    readSiteCache,
    readSiteEntry,
    siteCacheShard,
    siteCacheShardKey,
} from '../lib/site-cache';
import { handlePageAnalysis } from './index';

const SCORES = {
    reputation: 100,
    tracking: 100,
    cookies: 100,
    fingerprinting: 100,
    input: 100,
    policy: 100,
};

const sender = {} as chrome.runtime.MessageSender;

function payload(url: string, isInitialLoad = true) {
    return {
        type: 'PAGE_ANALYSIS_RESULT',
        url,
        isInitialLoad,
        scores: SCORES,
        detectionDetails: {},
    };
}

let key: CryptoKey;

beforeEach(async () => {
    key = await generateAesKey();
    await chrome.storage.session.set({ cryptoKeyHex: await exportKey(key) });
    await chrome.storage.local.set({
        settings: {
            enabled: true,
            wssThreshold: 60,
            whitelist: [],
            blacklist: [],
            theme: 'system',
        },
        state: { ups: 100, sitesAnalyzed: 0, trackersDetected: 0, piiEventsCount: 0 },
    });
});

describe('handlePageAnalysis site cache writes', () => {
    it('stores an analyzed site in its shard', async () => {
        await handlePageAnalysis(payload('https://alpha.example.com/'), sender);

        expect(await readSiteEntry('alpha.example.com', key)).toMatchObject({
            domain: 'alpha.example.com',
            visitCount: 1,
        });
    });

    it('writes only the analyzed domain shard and leaves other shards untouched', async () => {
        const first = 'alpha.example.com';
        let second = '';
        let index = 0;
        do {
            second = `other${index}.example.com`;
            index += 1;
        } while (siteCacheShard(second) === siteCacheShard(first));

        await handlePageAnalysis(payload(`https://${first}/`), sender);

        const firstShard = siteCacheShardKey(siteCacheShard(first));
        const before = (await chrome.storage.local.get(firstShard))[firstShard];
        const set = chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>;
        set.mockClear();

        await handlePageAnalysis(payload(`https://${second}/`), sender);

        const written = (set.mock.calls as Array<[Record<string, unknown>]>)
            .flatMap(call => Object.keys(call[0]));
        expect(written).toContain(siteCacheShardKey(siteCacheShard(second)));
        expect(written).not.toContain(firstShard);
        expect((await chrome.storage.local.get(firstShard))[firstShard]).toBe(before);
        expect(await readSiteEntry(first, key)).toMatchObject({ visitCount: 1 });
    });

    it('does not count a mutation-triggered re-analysis twice', async () => {
        await handlePageAnalysis(payload('https://alpha.example.com/'), sender);
        expect((await readSiteEntry('alpha.example.com', key))?.visitCount).toBe(1);

        await handlePageAnalysis(payload('https://alpha.example.com/', false), sender);
        expect((await readSiteEntry('alpha.example.com', key))?.visitCount).toBe(1);
    });

    it('ignores a malformed payload without writing the cache', async () => {
        await handlePageAnalysis({ type: 'PAGE_ANALYSIS_RESULT', url: 'https://alpha.example.com/' }, sender);

        expect(await readSiteCache(key)).toEqual({});
    });
});
