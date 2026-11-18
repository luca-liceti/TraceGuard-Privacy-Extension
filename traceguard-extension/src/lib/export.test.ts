import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { downloadJson, exportAllData, importAllData } from './export';
import { generateAesKey, exportKey, deriveKeyFromPassword, encryptData, generateSalt, importKey } from './crypto';
import { readSiteCache } from './site-cache';

async function unlockVault(): Promise<void> {
    const key = await generateAesKey();
    await chrome.storage.session.set({ cryptoKeyHex: await exportKey(key) });
}

describe('downloadJson', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => 'blob:test');
        URL.revokeObjectURL = vi.fn();
        (chrome.downloads.search as unknown as { mockResolvedValue: (value: unknown) => void })
            .mockResolvedValue([]);
    });

    function captureListener(): Array<(delta: chrome.downloads.DownloadDelta) => void> {
        const listeners: Array<(delta: chrome.downloads.DownloadDelta) => void> = [];
        vi.mocked(chrome.downloads.onChanged.addListener).mockImplementation((listener) => {
            listeners.push(listener);
        });
        return listeners;
    }

    it('resolves after in_progress becomes complete', async () => {
        const listeners = captureListener();
        const done = downloadJson('{}', 'backup.json');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(listeners).toHaveLength(1);
        listeners.forEach((listener) => listener({ id: 1, state: { current: 'in_progress' } } as chrome.downloads.DownloadDelta));
        listeners.forEach((listener) => listener({ id: 1, state: { current: 'complete' } } as chrome.downloads.DownloadDelta));

        await expect(done).resolves.toBeUndefined();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('rejects only when the download is interrupted', async () => {
        const listeners = captureListener();
        const done = downloadJson('{}', 'backup.json');
        await new Promise((resolve) => setTimeout(resolve, 0));

        listeners.forEach((listener) => listener({ id: 1, state: { current: 'interrupted' } } as chrome.downloads.DownloadDelta));

        await expect(done).rejects.toThrow('interrupted');
    });

    it('resolves when the file finished before the listener attached', async () => {
        captureListener();
        (chrome.downloads.search as unknown as { mockResolvedValue: (value: unknown) => void })
            .mockResolvedValue([{ id: 1, state: 'complete' }]);

        await expect(downloadJson('{}', 'backup.json')).resolves.toBeUndefined();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    });
});

describe('importAllData', () => {
    beforeEach(async () => {
        await unlockVault();
    });

    it('rejects invalid JSON', async () => {
        await expect(importAllData('not json', null)).rejects.toThrow('not valid JSON');
    });

    it('rejects a non-backup object', async () => {
        await expect(importAllData('[]', null)).rejects.toThrow('not a TraceGuard backup');
    });

    it('rejects a locked vault', async () => {
        await chrome.storage.session.remove('cryptoKeyHex');
        await expect(importAllData('{}', null)).rejects.toThrow('Unlock your vault');
    });

    it('restores vault fields (re-encrypted) and plaintext fields (as-is)', async () => {
        const backup = JSON.stringify({
            siteCache: { 'example.com': { domain: 'example.com', wss: 80, breakdown: {}, lastAnalyzed: 1 } },
            settings: { theme: 'dark' },
            state: { ups: 90 },
        });

        const restored = await importAllData(backup, null);
        expect([...restored].sort()).toEqual(['settings', 'siteCache', 'state'].sort());

        const local = (await chrome.storage.local.get(null)) as Record<string, any>;
        // The legacy blob is gone; the site is in an encrypted shard.
        expect(local.siteCache).toBeUndefined();
        const session = await chrome.storage.session.get<{ cryptoKeyHex?: string }>('cryptoKeyHex');
        const cache = await readSiteCache(await importKey(session.cryptoKeyHex as string));
        expect(cache['example.com']).toMatchObject({ domain: 'example.com', wss: 80 });
        // Plaintext fields are written through unchanged.
        expect(local.settings).toEqual({ theme: 'dark' });
        expect(local.state).toEqual({ ups: 90 });
    });

    it('decrypts a password-protected backup with the correct password', async () => {
        const salt = generateSalt();
        const key = await deriveKeyFromPassword('correct horse battery staple', salt);
        const payload = await encryptData(key, { settings: { theme: 'dark' } });
        const envelope = JSON.stringify({
            format: 'traceguard-backup',
            version: 1,
            encrypted: true,
            kdf: { name: 'PBKDF2-SHA256', iterations: 600000, salt: Array.from(salt) },
            payload,
        });

        const restored = await importAllData(envelope, 'correct horse battery staple');
        expect(restored).toContain('settings');
    });

    it('refuses to export vault data while the vault is locked', async () => {
        await chrome.storage.local.set({ crossSiteExposure: 'ciphertext' });
        await chrome.storage.session.remove('cryptoKeyHex');
        await expect(exportAllData(null)).rejects.toThrow('Unlock your vault');
    });

    it('rejects a password-protected backup without a password', async () => {
        const envelope = JSON.stringify({
            format: 'traceguard-backup',
            version: 1,
            encrypted: true,
            kdf: { name: 'PBKDF2-SHA256', iterations: 600000, salt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
            payload: 'ciphertext',
        });
        await expect(importAllData(envelope, null)).rejects.toThrow('password-protected');
    });
});
