import { describe, expect, it } from 'vitest';
import { buildWeeklyDigest, WEEKLY_DIGEST_WINDOW_MS } from './digest';
import type { PIIDetectionEvent, SiteRiskData } from './types';

const now = Date.UTC(2026, 10, 17, 12, 0, 0);

function event(overrides: Partial<PIIDetectionEvent>): PIIDetectionEvent {
    return {
        timestamp: now,
        site: 'alpha-site.com',
        fieldType: 'email',
        sensitivity: 'MEDIUM',
        siteWSS: 55,
        scoreImpact: -5,
        ...overrides,
    };
}

function site(overrides: Partial<SiteRiskData> & { domain: string }): SiteRiskData {
    return {
        wss: 70,
        breakdown: { reputation: 100, tracking: 100, cookies: 100, fingerprinting: 100, input: 100, policy: 100 },
        lastAnalyzed: now,
        ...overrides,
    } as SiteRiskData;
}

function withTrackers(domain: string, wss: number, lastAnalyzed: number | string, organizations: (string | null)[]): SiteRiskData {
    return site({
        domain,
        wss,
        lastAnalyzed,
        enrichedDetails: {
            trackers: {
                items: organizations.map((organization) => ({ organization })),
                summary: { total: organizations.length, active: 0, blockedByBrowser: 0, byCategory: {} },
            },
        } as SiteRiskData['enrichedDetails'],
    });
}

describe('buildWeeklyDigest', () => {
    it('counts only PII events inside the window', () => {
        const digest = buildWeeklyDigest({
            now,
            piiEvents: [
                event({ site: 'alpha-site.com', fieldType: 'email' }),
                event({ site: 'beta-site.com', fieldType: 'password' }),
                event({ site: 'beta-site.com', fieldType: 'password' }),
                event({ timestamp: now - WEEKLY_DIGEST_WINDOW_MS - 1, site: 'old-site.com' }),
            ],
            siteCache: {},
        });

        expect(digest.handovers).toBe(3);
        expect(digest.handoverSites).toBe(2);
        expect(digest.fields).toEqual(['email', 'password']);
        expect(digest.analyzedSites).toBe(0);
        expect(digest.hasActivity).toBe(true);
    });

    it('summarizes recent sites, low scores and unique tracker companies', () => {
        const digest = buildWeeklyDigest({
            now,
            threshold: 60,
            piiEvents: [],
            siteCache: {
                'alpha-site.com': withTrackers('alpha-site.com', 45, now, ['Acme Trackers', 'Beta Metrics', null]),
                'beta-site.com': withTrackers('beta-site.com', 75, new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), ['acme trackers']),
                'old-site.com': withTrackers('old-site.com', 20, now - WEEKLY_DIGEST_WINDOW_MS - 1, ['Old Corp']),
            },
        });

        expect(digest.analyzedSites).toBe(2);
        expect(digest.lowScoreSites).toBe(1);
        expect(digest.trackerOrganizations).toEqual(['Acme Trackers', 'Beta Metrics']);
        expect(digest.hasActivity).toBe(true);
    });

    it('reports a quiet week without inventing activity', () => {
        const digest = buildWeeklyDigest({ now, piiEvents: [], siteCache: {} });

        expect(digest.handovers).toBe(0);
        expect(digest.analyzedSites).toBe(0);
        expect(digest.lowScoreSites).toBe(0);
        expect(digest.trackerOrganizations).toEqual([]);
        expect(digest.hasActivity).toBe(false);
    });
});
