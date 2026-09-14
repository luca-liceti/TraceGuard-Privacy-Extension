import { describe, it, expect } from 'vitest';
import { isStoppedBeforeLoading, stoppedCount } from './tracker-status';

/**
 * TraceGuard cannot block anything, so nothing may be reported as blocked. These
 * pin the vocabulary and, more importantly, the tolerance for entries cached by
 * builds that used the old spelling: a cached 'blocked' must keep reading as
 * stopped-before-loading rather than silently becoming active.
 */

describe('isStoppedBeforeLoading', () => {
    it('is true for the current spelling', () => {
        expect(isStoppedBeforeLoading('blockedByBrowser')).toBe(true);
    });

    it('is true for a value cached by an older build', () => {
        expect(isStoppedBeforeLoading('blocked')).toBe(true);
    });

    it('is false for a loaded cookie or tracker', () => {
        expect(isStoppedBeforeLoading('active')).toBe(false);
    });

    it('is false for a request that completed or failed for another reason', () => {
        expect(isStoppedBeforeLoading('completed')).toBe(false);
        expect(isStoppedBeforeLoading('failed')).toBe(false);
    });

    it('is false for a missing status', () => {
        expect(isStoppedBeforeLoading(undefined)).toBe(false);
        expect(isStoppedBeforeLoading(null)).toBe(false);
    });
});

describe('stoppedCount', () => {
    it('reads the current key', () => {
        expect(stoppedCount({ blockedByBrowser: 3 })).toBe(3);
    });

    it('falls back to a summary cached by an older build', () => {
        expect(stoppedCount({ blocked: 4 })).toBe(4);
    });

    it('prefers the current key when both are present', () => {
        expect(stoppedCount({ blockedByBrowser: 2, blocked: 5 })).toBe(2);
    });

    it('keeps a genuine zero rather than falling through to the legacy key', () => {
        expect(stoppedCount({ blockedByBrowser: 0, blocked: 5 })).toBe(0);
    });

    it('reports zero when there is no summary', () => {
        expect(stoppedCount(undefined)).toBe(0);
    });
});
