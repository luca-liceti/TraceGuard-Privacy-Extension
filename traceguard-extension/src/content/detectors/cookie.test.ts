import { describe, it, expect } from 'vitest';
import { detectCookiesRaw } from './cookie';

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
