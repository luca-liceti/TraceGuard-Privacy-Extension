/// <reference types="node" />
import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifySignedFeed, refreshThreatFeed } from './threat-feed';

function makeKeypair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string }; // { kty: 'OKP', crv: 'Ed25519', x: base64url }
    const publicKeyHex = Buffer.from(jwk.x, 'base64url').toString('hex');
    return { publicKeyHex, privateKey };
}

function canonical(version: string, updated: string, domains: string[]) {
    return JSON.stringify({ version, updated, domains });
}

describe('verifySignedFeed', () => {
    it('accepts a valid signature', async () => {
        const { publicKeyHex, privateKey } = makeKeypair();
        const version = '1.0.0';
        const updated = new Date().toISOString();
        const domains = ['evil.com', 'phish.org'];
        const signature = sign(null, Buffer.from(canonical(version, updated, domains)), privateKey).toString('base64');

        const ok = await verifySignedFeed({ version, updated, domains, signature }, publicKeyHex);
        expect(ok).toBe(true);
    });

    it('rejects a tampered domain list', async () => {
        const { publicKeyHex, privateKey } = makeKeypair();
        const version = '1.0.0';
        const updated = new Date().toISOString();
        const signature = sign(
            null,
            Buffer.from(canonical(version, updated, ['evil.com'])),
            privateKey
        ).toString('base64');

        const ok = await verifySignedFeed(
            { version, updated, domains: ['evil.com', 'injected.com'], signature },
            publicKeyHex
        );
        expect(ok).toBe(false);
    });

    it('rejects a signature from a different key', async () => {
        const { publicKeyHex } = makeKeypair();
        const { privateKey: otherKey } = makeKeypair();
        const version = '1.0.0';
        const updated = new Date().toISOString();
        const domains = ['evil.com'];
        const signature = sign(null, Buffer.from(canonical(version, updated, domains)), otherKey).toString('base64');

        const ok = await verifySignedFeed({ version, updated, domains, signature }, publicKeyHex);
        expect(ok).toBe(false);
    });
});

describe('refreshThreatFeed fallbacks', () => {
    it('returns null when the network fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        await expect(refreshThreatFeed()).resolves.toBeNull();
        vi.unstubAllGlobals();
    });

    it('returns null for a malformed feed (missing signature)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ version: '1.0.0', updated: new Date().toISOString(), domains: ['a.com'] }),
        }));
        await expect(refreshThreatFeed()).resolves.toBeNull();
        vi.unstubAllGlobals();
    });

    it('returns null for a stale feed', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                version: '1.0.0',
                updated: '2000-01-01T00:00:00.000Z',
                domains: ['a.com'],
                signature: 'AAAA',
            }),
        }));
        await expect(refreshThreatFeed()).resolves.toBeNull();
        vi.unstubAllGlobals();
    });
});
