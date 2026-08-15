import { describe, it, expect, vi } from 'vitest';
import { checkReputation, checkReputationSync, loadBlacklist } from './reputation';

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

describe('static blacklist via loadBlacklist', () => {
    it('scores 0 for a domain in the bundled threat feed', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: async () => ({
                version: '1.0.0',
                updated: new Date().toISOString(),
                domains: ['malware.example.com'],
            }),
        }));
        await loadBlacklist();
        const result = await checkReputation('https://malware.example.com');
        expect(result.score).toBe(0);
        expect(result.checks).toContain('Found in static blacklist of known malicious domains');
        vi.unstubAllGlobals();
    });
});

describe('checkReputationSync', () => {
    it('returns safe for an arbitrary unlisted domain', () => {
        expect(checkReputationSync('https://this-domain-should-not-be-listed-xyz.com').score).toBe(100);
    });
});
