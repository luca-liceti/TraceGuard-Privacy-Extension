import { describe, expect, it } from 'vitest';
import { resolveSyncCurrentSite, slimSiteData } from './site-sync';
import type { SiteRiskData } from './types';

function makeSite(domain: string, lastAnalyzed: number, extra: Partial<SiteRiskData> = {}): SiteRiskData {
    return {
        domain,
        wss: 80,
        breakdown: { reputation: 100, tracking: 100, cookies: 100, fingerprinting: 100, input: 100, policy: 100 },
        lastAnalyzed,
        ...extra,
    };
}

describe('resolveSyncCurrentSite', () => {
    it('clears the view when nothing is cached and no site is shown', () => {
        expect(resolveSyncCurrentSite('b.com', undefined, undefined)).toEqual({
            changed: true,
            next: undefined,
        });
    });

    it('clears the view when the new domain has no cache entry and the view shows a different site', () => {
        const current = makeSite('a.com', 1000);
        expect(resolveSyncCurrentSite('b.com', undefined, current)).toEqual({
            changed: true,
            next: undefined,
        });
    });

    it('does NOT clobber a just-landed analysis back to "no site" (regression)', () => {
        // The sync's cache read predates the PAGE_ANALYSIS_RESULT: the view
        // already shows this domain even though our (stale) cache lookup
        // found nothing. Clearing it was the bug that left the sidebar/popup
        // stuck in the empty state after switching tabs.
        const current = makeSite('b.com', 5000);
        expect(resolveSyncCurrentSite('b.com', undefined, current)).toEqual({
            changed: false,
            next: undefined,
        });
    });

    it('writes the cached site when nothing is shown yet', () => {
        const cached = makeSite('b.com', 5000);
        expect(resolveSyncCurrentSite('b.com', cached, undefined)).toEqual({
            changed: true,
            next: slimSiteData(cached),
        });
    });

    it('switches to the cached site when a different domain is shown', () => {
        const cached = makeSite('b.com', 5000);
        const current = makeSite('a.com', 9000);
        expect(resolveSyncCurrentSite('b.com', cached, current)).toEqual({
            changed: true,
            next: slimSiteData(cached),
        });
    });

    it('updates the view when the cached entry is newer than what is shown', () => {
        const cached = makeSite('b.com', 6000);
        const current = makeSite('b.com', 5000);
        expect(resolveSyncCurrentSite('b.com', cached, current)).toEqual({
            changed: true,
            next: slimSiteData(cached),
        });
    });

    it('never downgrades a fresher entry already on screen', () => {
        const cached = makeSite('b.com', 5000);
        const current = makeSite('b.com', 6000);
        expect(resolveSyncCurrentSite('b.com', cached, current)).toEqual({
            changed: false,
            next: undefined,
        });
    });
});

describe('slimSiteData', () => {
    it('keeps only the non-sensitive fields', () => {
        const full = makeSite('a.com', 42, {
            visitCount: 3,
            lastVisit: 99,
            detectionDetails: {
                reputation: { checks: ['x'], status: 'Clean' },
            },
            enrichedDetails: {} as SiteRiskData['enrichedDetails'],
        });
        expect(slimSiteData(full)).toEqual({
            domain: 'a.com',
            wss: 80,
            breakdown: full.breakdown,
            lastAnalyzed: 42,
        });
    });
});