/**
 * Pure helpers for keeping the "current site" view (side panel / popup) in
 * sync with the active tab. Extracted from the background service worker so
 * the race-safe decision logic can be unit-tested without booting the
 * extension's Chrome runtime.
 */
import type { SiteRiskData } from './types';

/**
 * Reduces a SiteRiskData record to the non-sensitive fields that are safe to
 * persist in the plaintext `state` (chrome.storage.local). The full analysis
 * (detectionDetails + enrichedDetails) lives only in the encrypted siteCache.
 */
export function slimSiteData(site: SiteRiskData): SiteRiskData {
    return {
        domain: site.domain,
        wss: site.wss,
        breakdown: site.breakdown,
        lastAnalyzed: site.lastAnalyzed,
    };
}

export interface SyncResolution {
    /** True when `state.currentSite` should be written with `next`. */
    changed: boolean;
    /** The value to write for `state.currentSite` when `changed` is true. */
    next: SiteRiskData | undefined;
}

/**
 * Decides what `state.currentSite` should be after a tab-activation sync.
 *
 * The tab sync reads the (encrypted) siteCache at an arbitrary moment, so a
 * PAGE_ANALYSIS_RESULT for the same tab can land between that read and the
 * state write. Without care, the sync's stale "no cache entry yet" read
 * cleared the site that the analysis had just set, leaving the
 * sidebar/popup stuck in the "you're not on any website" empty state.
 *
 * The rules:
 * - A cached site is only written when it is missing or newer than the view
 *   (never downgrade a fresher analysis for the same domain).
 * - An absent cached entry only clears the view when it currently shows a
 *   DIFFERENT domain. If it already shows this domain, a fresh analysis just
 *   landed after our cache read and must be left alone.
 */
export function resolveSyncCurrentSite(
    domain: string,
    cached: SiteRiskData | undefined,
    current: SiteRiskData | undefined
): SyncResolution {
    if (cached) {
        const slim = slimSiteData(cached);
        // Never downgrade equal-or-newer data already on screen.
        if (current?.domain === slim.domain && Number(current.lastAnalyzed ?? 0) >= Number(slim.lastAnalyzed ?? 0)) {
            return { changed: false, next: undefined };
        }
        return { changed: true, next: slim };
    }

    // No cached analysis yet (fresh visit still being analyzed). Clearing is
    // only correct when the view shows a different site; if it already shows
    // this domain, an analysis write landed after our cache read.
    if (current?.domain === domain) {
        return { changed: false, next: undefined };
    }
    return { changed: true, next: undefined };
}