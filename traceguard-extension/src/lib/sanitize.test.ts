import { describe, it, expect } from 'vitest';
import { sanitizeURL } from './sanitize';

describe('sanitizeURL', () => {
    it('allows http and https URLs', () => {
        expect(sanitizeURL('https://example.com/path')).toBe('https://example.com/path');
        expect(sanitizeURL('http://example.com')).toBe('http://example.com/');
    });

    it('rejects non-http(s) schemes', () => {
        expect(sanitizeURL('javascript:alert(1)')).toBeNull();
        expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(sanitizeURL('vbscript:evil')).toBeNull();
        expect(sanitizeURL('file:///etc/passwd')).toBeNull();
    });

    it('rejects invalid and empty input', () => {
        expect(sanitizeURL('')).toBeNull();
        expect(sanitizeURL(null)).toBeNull();
        expect(sanitizeURL(undefined)).toBeNull();
        expect(sanitizeURL('not a url')).toBeNull();
    });
});
