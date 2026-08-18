import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runDataMigrations } from './migrations';

describe('runDataMigrations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure chrome is mocked globally by setup.ts
        if (typeof chrome !== 'undefined' && chrome.storage) {
            (chrome.storage.local.get as any).mockResolvedValue({});
            (chrome.storage.local.set as any).mockResolvedValue();
        }
    });

    it('sets initial schemaVersion to 1 if missing', async () => {
        await runDataMigrations();
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ schemaVersion: 1 });
    });

    it('does not modify schemaVersion if already up to date', async () => {
        (chrome.storage.local.get as any).mockResolvedValue({ schemaVersion: 1 });
        await runDataMigrations();
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('propagates storage errors so callers can handle them', async () => {
        (chrome.storage.local.get as any).mockRejectedValue(new Error('Storage failure'));

        await expect(runDataMigrations()).rejects.toThrow('Storage failure');
    });
});
