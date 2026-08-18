import { describe, expect, it, beforeEach } from 'vitest';
import { importAllData } from './export';
import { generateAesKey, exportKey, deriveKeyFromPassword, encryptData, generateSalt } from './crypto';

async function unlockVault(): Promise<void> {
    const key = await generateAesKey();
    await chrome.storage.session.set({ cryptoKeyHex: await exportKey(key) });
}

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
        // Vault fields are re-encrypted to a ciphertext string, not stored raw.
        expect(typeof local.siteCache).toBe('string');
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
