import { describe, it, expect } from 'vitest';
import { detectCookiesRaw, detectCookiesDetailed } from './cookie';

describe('cookie data minimization', () => {
    it('detectCookiesRaw returns only names, never values', () => {
        document.cookie = 'session=SECRET_TOKEN_123; _ga=GA1.2.999; csrftoken=abc123';
        const raw = detectCookiesRaw();

        // Only names are ever emitted.
        for (const entry of raw) {
            expect(entry).toHaveProperty('name');
            expect(entry).not.toHaveProperty('value');
        }

        // No cookie value may leak into the serialized result.
        const serialized = JSON.stringify(raw);
        expect(serialized).not.toContain('SECRET_TOKEN_123');
        expect(serialized).not.toContain('GA1.2.999');
        expect(serialized).not.toContain('abc123');
    });
});

describe('cookie categorization', () => {
    it('does not flag innocent first-party cookie names as trackers', () => {
        // "sessionid" contains "sid" and "refresh" contains "fr" - plain
        // substring matching would miscategorize them as Google/Facebook
        // trackers, dragging the WSS down and turning safe sites into
        // "risky" ones that get penalized. (happy-dom keeps only one cookie
        // per assignment, so set them individually.)
        document.cookie = 'sessionid=1';
        document.cookie = 'refresh=1';
        document.cookie = 'csrftoken=2';
        document.cookie = 'fr=3';
        document.cookie = '_ga=GA1.2.999';
        const result = detectCookiesDetailed();

        // Only the real tracker cookies count: Facebook's exact "fr" and GA's "_ga".
        expect(result.details?.['cross-site-tracker']).toBe(1); // fr only
        expect(result.details?.['analytics']).toBe(1);          // _ga only
        expect(result.details?.['third-party']).toBe(0);        // sessionid/refresh/csrftoken are first-party
    });
});
