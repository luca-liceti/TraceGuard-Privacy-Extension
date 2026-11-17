import type { PolicyReportResult } from './policy-report';

/**
 * Reports generated on this device, so a site is analyzed once rather than on
 * every visit. A policy changes rarely; seven days is short enough to pick up
 * a rewrite without asking the model again on every tab.
 */
/** Storage key, exported so views can follow changes to the cache. */
export const POLICY_REPORT_CACHE_KEY = 'localPolicyReports';
export const POLICY_REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bound on stored sites, oldest dropped first. */
const MAX_ENTRIES = 200;

interface CacheEntry {
    report: PolicyReportResult;
    savedAt: number;
}

type CacheMap = Record<string, CacheEntry>;

async function readAll(): Promise<CacheMap> {
    try {
        const stored = await chrome.storage.local.get(POLICY_REPORT_CACHE_KEY);
        const value = stored?.[POLICY_REPORT_CACHE_KEY];
        return value && typeof value === 'object' ? { ...(value as CacheMap) } : {};
    } catch {
        return {};
    }
}

/**
 * Every cached report that is still fresh, keyed by domain, for a view that
 * lists many sites (the activity log) and cannot ask site by site.
 */
export async function readCachedPolicyReports(): Promise<Record<string, PolicyReportResult>> {
    const all = await readAll();
    const now = Date.now();
    const fresh: Record<string, PolicyReportResult> = {};
    for (const [domain, entry] of Object.entries(all)) {
        if (!entry?.report || !Number.isFinite(entry.savedAt)) continue;
        if (now - entry.savedAt > POLICY_REPORT_TTL_MS) continue;
        fresh[domain] = entry.report;
    }
    return fresh;
}

/** A cached report that is still fresh, or null. */
export async function readCachedPolicyReport(domain: string): Promise<PolicyReportResult | null> {
    const entry = (await readAll())[domain];
    if (!entry?.report || !Number.isFinite(entry.savedAt)) return null;
    if (Date.now() - entry.savedAt > POLICY_REPORT_TTL_MS) return null;
    return entry.report;
}

export async function saveCachedPolicyReport(domain: string, report: PolicyReportResult): Promise<void> {
    const all = await readAll();
    const now = Date.now();
    for (const [key, entry] of Object.entries(all)) {
        if (!entry || now - entry.savedAt > POLICY_REPORT_TTL_MS) delete all[key];
    }
    all[domain] = { report, savedAt: now };
    const entries = Object.entries(all);
    if (entries.length > MAX_ENTRIES) {
        entries
            .sort((a, b) => a[1].savedAt - b[1].savedAt)
            .slice(0, entries.length - MAX_ENTRIES)
            .forEach(([key]) => delete all[key]);
    }
    try {
        await chrome.storage.local.set({ [POLICY_REPORT_CACHE_KEY]: all });
    } catch {
        // A full or unavailable store only costs a second analysis.
    }
}

/** Drop every stored report, used when the model or setting changes. */
export async function clearCachedPolicyReports(): Promise<void> {
    try {
        await chrome.storage.local.remove(POLICY_REPORT_CACHE_KEY);
    } catch {
        // Nothing stored, nothing to clear.
    }
}
