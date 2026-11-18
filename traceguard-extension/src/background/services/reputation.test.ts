import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetBlacklistForTests, checkReputation, checkReputationSync, loadBlacklist } from './reputation';

const feed = (domains: string[]) => ({
    json: async () => ({
        version: '1.0.0',
        updated: new Date().toISOString(),
        domains,
    }),
});

beforeEach(() => {
    // Each test starts like a freshly woken service worker: no list in memory.
    __resetBlacklistForTests();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(feed([])));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('checkReputation', () => {
    it('returns safe (100) by default for an unknown domain', async () => {
        const result = await checkReputation('https://example.com');
        expect(result.score).toBe(100);
    });

    it('forces safe (100) for a whitelisted domain', async () => {
        (chrome.storage.local.get as any).mockResolvedValueOnce({
            settings: { whitelist: ['example.com'] },
        });
        const result = await checkReputation('https://example.com');
        expect(result.score).toBe(100);
        expect(result.checks).toContain('Whitelisted by user');
    });

    it('forces critical (0) for a user-blacklisted domain', async () => {
        (chrome.storage.local.get as any).mockResolvedValueOnce({
            settings: { blacklist: ['evil.com'] },
        });
        const result = await checkReputation('https://evil.com');
        expect(result.score).toBe(0);
        expect(result.checks).toContain('Found in user blacklist');
    });

    it('matches subdomains against the whitelist', async () => {
        (chrome.storage.local.get as any).mockResolvedValueOnce({
            settings: { whitelist: ['example.com'] },
        });
        const result = await checkReputation('https://sub.example.com/path');
        expect(result.score).toBe(100);
    });
});

describe('static blacklist', () => {
    it('scores 0 for a domain in the bundled threat feed', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(feed(['malware.example.com'])));
        await loadBlacklist();
        const result = await checkReputation('https://malware.example.com');
        expect(result.score).toBe(0);
        expect(result.checks).toContain('Found in static blacklist of known malicious domains');
    });

    it('loads the feed on the first check after a worker restart', async () => {
        // A stopped MV3 worker is woken for a navigation without firing
        // onStartup. Nothing calls loadBlacklist() here, which is exactly that
        // state. The first check must still see the bundled domains.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(feed(['malware.example.com'])));

        const result = await checkReputation('https://malware.example.com');

        expect(result.score).toBe(0);
        expect(result.checks).toContain('Found in static blacklist of known malicious domains');
    });

    it('retries a failed load instead of staying empty forever', async () => {
        const failing = vi.fn().mockRejectedValue(new Error('offline'));
        vi.stubGlobal('fetch', failing);
        const offline = await checkReputation('https://malware.example.com');
        expect(offline.score).toBe(100);

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(feed(['malware.example.com'])));
        const recovered = await checkReputation('https://malware.example.com');
        expect(recovered.score).toBe(0);
    });
});

describe('checkReputationSync', () => {
    it('returns safe for an arbitrary unlisted domain', () => {
        expect(checkReputationSync('https://this-domain-should-not-be-listed-xyz.com').score).toBe(100);
    });
});
