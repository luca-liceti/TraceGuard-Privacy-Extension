import { describe, expect, it } from 'vitest';
import { deriveKeyFromPassword, generateSalt } from './crypto';
import { verifyVaultPassword } from './vault-password';

async function createVault(password: string): Promise<void> {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt);

    // The setup screen encrypts the raw marker, not a JSON value. Mirror that
    // exact layout: IV first, then the AES-GCM ciphertext, base64 encoded.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode('TraceGuardValidator')
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    await chrome.storage.local.set({
        cryptoSalt: Array.from(salt),
        validator: btoa(String.fromCharCode(...combined)),
    });
}

describe('verifyVaultPassword', () => {
    it('returns the derived key for the correct password', async () => {
        await createVault('correct horse battery staple');

        const result = await verifyVaultPassword('correct horse battery staple');

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.key).toBeDefined();
    });

    it('rejects a wrong password', async () => {
        await createVault('correct horse battery staple');

        await expect(verifyVaultPassword('wrong password')).resolves.toEqual({
            ok: false,
            reason: 'invalid',
        });
    });

    it('reports a missing vault instead of calling the password wrong', async () => {
        await expect(verifyVaultPassword('anything')).resolves.toEqual({
            ok: false,
            reason: 'not-set-up',
        });
    });

    it('rejects an empty password without deriving a key', async () => {
        await createVault('correct horse battery staple');

        await expect(verifyVaultPassword('')).resolves.toEqual({
            ok: false,
            reason: 'invalid',
        });
    });
});
