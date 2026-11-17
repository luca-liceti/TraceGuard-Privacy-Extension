import type { PIIDetectionEvent, SiteRiskData } from './types';

/** How often the in-app weekly digest may appear. */
export const WEEKLY_DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyDigestInput {
    piiEvents: PIIDetectionEvent[];
    siteCache: Record<string, SiteRiskData>;
    now: number;
    /** Sites below this WSS count as low-scoring. Defaults to 60. */
    threshold?: number;
    /** Defaults to seven days. */
    windowMs?: number;
}

export interface WeeklyDigest {
    since: number;
    handovers: number;
    handoverSites: number;
    analyzedSites: number;
    lowScoreSites: number;
    trackerOrganizations: string[];
    fields: string[];
    threshold: number;
    hasActivity: boolean;
}

function analyzedAt(site: SiteRiskData): number {
    if (typeof site.lastAnalyzed === 'number') return site.lastAnalyzed;
    const parsed = Date.parse(site.lastAnalyzed);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Builds a local-only summary of the last week from data TraceGuard already
 * stores. It intentionally reports what was seen, not a diff: the exposure
 * ledger has no per-domain timestamps, so claiming "new" holders would be
 * fiction. PII events do carry timestamps, so those are windowed exactly.
 */
export function buildWeeklyDigest({
    piiEvents,
    siteCache,
    now,
    threshold = 60,
    windowMs = WEEKLY_DIGEST_WINDOW_MS,
}: WeeklyDigestInput): WeeklyDigest {
    const since = now - windowMs;

    const recentEvents = piiEvents.filter((event) =>
        Number.isFinite(event.timestamp)
        && event.timestamp >= since
        && event.timestamp <= now
    );

    const handoverSites = new Set(recentEvents.map((event) => event.site).filter(Boolean));
    const fields = [...new Set(recentEvents.map((event) => event.fieldType).filter(Boolean))].sort();

    const recentSites = Object.values(siteCache).filter((site) => {
        const analyzed = analyzedAt(site);
        return analyzed >= since && analyzed <= now;
    });

    const lowScoreSites = recentSites.filter((site) => site.wss < threshold).length;

    const organizations = new Map<string, string>();
    for (const site of recentSites) {
        for (const tracker of site.enrichedDetails?.trackers?.items ?? []) {
            const name = tracker.organization?.trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (!organizations.has(key)) organizations.set(key, name);
        }
    }

    return {
        since,
        handovers: recentEvents.length,
        handoverSites: handoverSites.size,
        analyzedSites: recentSites.length,
        lowScoreSites,
        trackerOrganizations: [...organizations.values()].sort((a, b) => a.localeCompare(b)),
        fields,
        threshold,
        hasActivity: recentEvents.length > 0 || recentSites.length > 0,
    };
}
