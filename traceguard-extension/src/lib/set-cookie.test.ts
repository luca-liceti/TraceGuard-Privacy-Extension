import { describe, it, expect } from 'vitest';
import { parseSetCookie } from './set-cookie';

describe('parseSetCookie', () => {
    it('extracts name and falls back to the request host when no Domain attribute', () => {
        const parsed = parseSetCookie('_ga=GA1.2.999; Path=/', 'example.com');
        expect(parsed).toMatchObject({
            name: '_ga',
            domain: 'example.com',
            httpOnly: false,
            secure: false,
            sameSite: 'unspecified',
        });
    });

    it('parses HttpOnly, Secure, and SameSite flags', () => {
        const parsed = parseSetCookie(
            'session=abc; Domain=.example.com; Path=/; HttpOnly; Secure; SameSite=Lax',
            'www.example.com'
        );
        expect(parsed).toMatchObject({
            name: 'session',
            domain: 'example.com', // leading dot stripped
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
        });
    });

    it('maps SameSite=None to None', () => {
        const parsed = parseSetCookie('ide=xyz; SameSite=None; Secure', 'doubleclick.net');
        expect(parsed?.sameSite).toBe('None');
        expect(parsed?.domain).toBe('doubleclick.net');
    });

    it('derives expiry from Max-Age (precedence over Expires)', () => {
        const before = Date.now();
        const parsed = parseSetCookie(
            'pk=1; Max-Age=3600; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
            'example.com'
        );
        expect(parsed?.expirationDate).not.toBeNull();
        // Max-Age=3600 => ~1 hour out, not the 2015 Expires date.
        expect(parsed!.expirationDate!).toBeGreaterThan(before + 3590 * 1000);
    });

    it('falls back to Expires when Max-Age is absent', () => {
        const parsed = parseSetCookie('legacy=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT', 'example.com');
        expect(parsed?.expirationDate).toBe(Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
    });

    it('returns null for a header with no parseable name', () => {
        expect(parseSetCookie('; Path=/', 'example.com')).toBeNull();
        expect(parseSetCookie('', 'example.com')).toBeNull();
    });

    it('never includes the cookie value in the result', () => {
        const parsed = parseSetCookie('auth=SUPERSECRET; HttpOnly', 'example.com');
        expect(parsed).not.toHaveProperty('value');
        expect(JSON.stringify(parsed)).not.toContain('SUPERSECRET');
    });
});
