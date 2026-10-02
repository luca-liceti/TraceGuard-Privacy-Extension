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

    it('sets initial schemaVersion to 2 if missing', async () => {
        await runDataMigrations();
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ schemaVersion: 2 });
    });

    it('does not modify schemaVersion if already up to date', async () => {
        (chrome.storage.local.get as any).mockResolvedValue({ schemaVersion: 2 });
        await runDataMigrations();
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('resets a positive refresh schedule to off, without touching other settings', async () => {
        // The field now gates the privacy-ratings catalog fetch, which nobody
        // opted into when it was only the phishing-feed interval.
        (chrome.storage.local.get as any).mockImplementation(async (key: unknown) => {
            if (key === 'schemaVersion') return { schemaVersion: 1 };
            if (key === 'settings') return { settings: { databaseRefreshDays: 7, theme: 'dark' } };
            return {};
        });

        await runDataMigrations();

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            settings: { databaseRefreshDays: 0, theme: 'dark' },
        });
    });

    it('leaves an already-off schedule untouched', async () => {
        (chrome.storage.local.get as any).mockImplementation(async (key: unknown) => {
            if (key === 'schemaVersion') return { schemaVersion: 1 };
            if (key === 'settings') return { settings: { databaseRefreshDays: 0 } };
            return {};
        });

        await runDataMigrations();

        // Only the schema bump, no settings rewrite.
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ schemaVersion: 2 });
        expect((chrome.storage.local.set as any).mock.calls.every((c: unknown[]) => !(c[0] as any).settings)).toBe(true);
    });

    it('propagates storage errors so callers can handle them', async () => {
        (chrome.storage.local.get as any).mockRejectedValue(new Error('Storage failure'));

        await expect(runDataMigrations()).rejects.toThrow('Storage failure');
    });
});
