import { describe, it, expect } from 'vitest';
import { analyzeHeaders, computeHeaderGrade } from './header-analyzer';

describe('analyzeHeaders', () => {
    it('returns six header analyses (one per checked header)', () => {
        expect(analyzeHeaders([])).toHaveLength(6);
    });

    it('marks missing headers as "missing"', () => {
        const results = analyzeHeaders([]);
        expect(results.every(r => r.rating === 'missing')).toBe(true);
    });

    it('marks a present CSP header as "good"', () => {
        const results = analyzeHeaders([{ name: 'content-security-policy', value: "default-src 'self'" }]);
        const csp = results.find(r => r.header === 'Content-Security-Policy');
        expect(csp?.present).toBe(true);
        expect(csp?.rating).toBe('good');
    });

    it('marks HSTS with a short max-age as "fair"', () => {
        const results = analyzeHeaders([{ name: 'strict-transport-security', value: 'max-age=60' }]);
        const hsts = results.find(r => r.header === 'Strict-Transport-Security');
        expect(hsts?.rating).toBe('fair');
    });
});

describe('computeHeaderGrade', () => {
    it('returns F for no headers', () => {
        expect(computeHeaderGrade([])).toEqual({ score: 0, grade: 'F' });
    });

    it('returns A when every header is good', () => {
        const items = analyzeHeaders([
            { name: 'content-security-policy', value: "default-src 'self'" },
            { name: 'strict-transport-security', value: 'max-age=31536000' },
            { name: 'x-content-type-options', value: 'nosniff' },
            { name: 'x-frame-options', value: 'DENY' },
            { name: 'referrer-policy', value: 'no-referrer' },
            { name: 'permissions-policy', value: 'camera=()' },
        ]);
        expect(computeHeaderGrade(items)).toEqual({ score: 100, grade: 'A' });
    });

    it('returns F when every header is missing', () => {
        const items = analyzeHeaders([]);
        expect(computeHeaderGrade(items).grade).toBe('F');
    });
});
