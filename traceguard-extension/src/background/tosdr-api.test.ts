import { describe, it, expect } from 'vitest';
import { checkTosDR } from './tosdr-api';

describe('checkTosDR', () => {
    it('returns a local fallback for an unknown domain when cloud is disabled', async () => {
        // Cloud ToS;DR defaults to off; with no seed/cache hit the result must
        // fall back without making any network request.
        const result = await checkTosDR('https://totally-unknown-domain-xyz.com');
        expect(result.found).toBe(false);
        expect(result.source).toBe('fallback');
    });
});
