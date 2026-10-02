/**
 * =============================================================================
 * ToS;DR API INTEGRATION - Privacy Policy Ratings
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file integrates with ToS;DR (Terms of Service; Didn't Read) - a community
 * project that reads privacy policies so you don't have to! They grade policies
 * from A (best) to E (worst), like school grades.
 * 
 * WHAT IS ToS;DR?
 * ToS;DR (tosdr.org) is a volunteer project where people read the long, boring
 * legal documents (Terms of Service, Privacy Policies) for popular websites
 * and summarize the good, bad, and ugly parts. Then they give each site a grade.
 * 
 * HOW WE USE IT:
 * 1. When you visit a website, we send the domain to ToS;DR's API
 * 2. They tell us if they have a rating for that site
 * 3. We convert their grade (A-E) to a score (100, 80, 60, 40, 20)
 * 4. That score contributes to the Website Safety Score (WSS)
 * 
 * SCORING CONVERSION:
 * - Grade A = 100 (Excellent - respects your privacy)
 * - Grade B = 80 (Good - mostly fair terms)
 * - Grade C = 60 (Fair - some concerns)
 * - Grade D = 40 (Poor - problematic terms)
 * - Grade E = 20 (Bad - serious privacy issues)
 * - No rating = 0 (Unknown - can't evaluate)
 * 
 * CACHING:
 * Results are cached for 5 minutes to avoid hammering the API.
 * The cache is stored in memory and clears when the extension reloads.
 * 
 * API INFO:
 * - URL: https://api.tosdr.org/search/v4/
 * - No API key required (free and open)
 * - Documentation: https://tosdr.org/api
 * =============================================================================
 */

interface TosDRResult {
    found: boolean;
    grade?: string; // A-E
    score: number; // 0-100 (0 = dangerous/no rating, 100 = safe/A-grade)
    source: 'tosdr' | 'fallback';
    serviceName?: string;
    serviceId?: number;
    points?: { title: string; classification: string }[];
    documents?: { name: string; url: string }[];
    serviceUpdatedAt?: string; // The ToS;DR updated_at this rating came from
    capturedAt?: number; // When our copy of this rating was taken (Unix ms)
}

// Cache for ToS;DR results is no longer needed (100% local)

/**
 * Extract the main/root domain from URL
 * Examples:
 * - www.google.com -> google.com
 * - antigravity.google.com -> google.com
 * - antigravity.google -> google (new-style brand TLD)
 * - example.co.uk -> example.co.uk
 */
function extractMainDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        // Split hostname into parts
        const parts = hostname.split('.');

        // Handle new-style brand TLDs (company owns the TLD itself)
        // For domains like antigravity.google, search ToS;DR for "google"
        // Brand TLDs only (single-owner). 'app', 'dev' and 'page' are public
        // registrable TLDs, so collapsing vercel.app -> "app" was wrong.
        const brandTLDs = ['google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta'];
        if (parts.length === 2 && brandTLDs.includes(parts[1])) {
            return parts[1]; // Return just "google" for antigravity.google
        }

        // Handle common multi-part TLDs (co.uk, com.au, etc.)
        const multiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'org.uk'];
        for (const tld of multiPartTLDs) {
            if (hostname.endsWith('.' + tld)) {
                return parts.slice(-3).join('.');
            }
        }

        // Standard case: return last 2 parts (domain + TLD)
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }

        return hostname;
    } catch {
        return url;
    }
}


/**
 * ToS;DR sends the rating as a plain letter on the list and detail endpoints,
 * but as an object ({ hex, human, letter }) on the search endpoint. Normalising
 * both shapes here is what keeps a lookup from throwing on the object form.
 * Anything that is not an A-E letter, including the string "N/A", is treated as
 * no rating.
 */
function normalizeGrade(rating: unknown): string | undefined {
    const raw = rating && typeof rating === 'object'
        ? (rating as { letter?: unknown; human?: unknown }).letter ?? (rating as { human?: unknown }).human
        : rating;
    if (typeof raw !== 'string') return undefined;
    const grade = raw.trim().toUpperCase();
    return ['A', 'B', 'C', 'D', 'E'].includes(grade) ? grade : undefined;
}

/**
 * Convert ToS;DR grade to risk score (standard: 0 = dangerous, 100 = safe)
 * A = 100 (excellent), B = 80 (good), C = 60 (fair), D = 40 (poor), E = 20 (bad), None = 0 (no rating = dangerous)
 */
function gradeToScore(grade: unknown): number {
    const normalized = normalizeGrade(grade);
    if (!normalized) return 0;

    const gradeMap: Record<string, number> = {
        'A': 100,
        'B': 80,
        'C': 60,
        'D': 40,
        'E': 20
    };

    return gradeMap[normalized] ?? 0;
}

import { getTosDRRecord, getTosdrCatalogMeta } from './services/database-loader';
import { captureError, logEvent } from '../lib/diagnostics';
import { storage } from '../lib/storage';
import { rateLimiters } from '../lib/rate-limiter';
import { fetchWithTimeout } from '../lib/utils';

interface CacheEntry {
    data: TosDRResult;
    timestamp: number;
}

let inMemoryCache: Record<string, CacheEntry> | null = null;

// One-time opt-in prompt for the (default-off) cloud lookup.
let cloudPromptScheduled = false;
async function maybePromptCloudOptIn() {
    if (cloudPromptScheduled) return;
    const { cloudTosdrPrompted } = await chrome.storage.local.get('cloudTosdrPrompted');
    if (cloudTosdrPrompted) {
        cloudPromptScheduled = true;
        return;
    }
    const key = await storage.getVaultKey();
    const id = await storage.addNotification({
        type: 'info',
        title: 'Live Rating Lookup is off',
        message: 'Turn it on to fetch a current rating from tosdr.org when our local data is missing or old. Sends the domain of the site you visit.',
        titleKey: 'Live Rating Lookup is off',
        messageKey: 'Turn it on to fetch a current rating from tosdr.org when our local data is missing or old. Sends the domain of the site you visit.',
        severity: 'info',
        actionUrl: '/overview?openSettings=privacy'
    }, key);
    if (id) {
        cloudPromptScheduled = true;
        await chrome.storage.local.set({ cloudTosdrPrompted: true });
    }
}

async function getCache(): Promise<Record<string, CacheEntry>> {
    if (inMemoryCache) return inMemoryCache;
    const result = await chrome.storage.local.get<Record<string, any>>('tosdr_cache');
    inMemoryCache = result.tosdr_cache || {};
    return inMemoryCache!;
}

async function saveCache(domain: string, entry: CacheEntry) {
    if (!inMemoryCache) inMemoryCache = {};
    inMemoryCache[domain] = entry;
    await chrome.storage.local.set({ tosdr_cache: inMemoryCache });
}

async function fetchFromTosdr(domain: string): Promise<TosDRResult | null> {
    try {
        return await rateLimiters.tosdr.execute(async () => {
            const searchRes = await fetchWithTimeout(`https://api.tosdr.org/search/v4/?query=${encodeURIComponent(domain)}`);
            if (!searchRes.ok) return null;
            const searchData = await searchRes.json();
            
            if (searchData?.parameters?.services?.[0]) {
                const service = searchData.parameters.services[0];
                const detailsRes = await fetchWithTimeout(`https://api.tosdr.org/service/v2/?id=${service.id}`);
                if (!detailsRes.ok) return null;
                const detailsData = await detailsRes.json();
                const details = detailsData?.parameters;
                
                if (details) {
                    // The detail endpoint returns the rating as a letter, while
                    // the search result carries it as an object. Prefer the
                    // detail letter and fall back to the search shape.
                    const grade = normalizeGrade(details.rating) ?? normalizeGrade(service.rating);
                    return {
                        found: true,
                        grade,
                        // A catalogued service with no grade is neutral, not
                        // dangerous: ToS;DR has it on file but gives no verdict.
                        // 50 matches the local "policy link found, no rating" score.
                        score: grade ? gradeToScore(grade) : 50,
                        source: 'tosdr',
                        serviceName: service.name,
                        serviceId: service.id,
                        points: details.points?.map((p: any) => ({ title: p.title, classification: p.case?.classification || p.classification || 'neutral' })) || [],
                        documents: details.documents?.map((d: any) => ({ name: d.name, url: d.url })) || [],
                        serviceUpdatedAt: details.updated_at || service.updated_at || undefined
                    };
                }
            }
            return null;
        });
    } catch (err) {
        captureError('enrich', err, 'tosdr_fetch_failed', { host: domain });
    }
    return null;
}

/**
 * How stale a rating must be before a visit triggers a re-check. This governs
 * only the on-visit path (the "Live rating updates" toggle). It is deliberately
 * independent of `databaseRefreshDays`, which controls the background catalog
 * sweep, so one can be on while the other is off.
 */
const RATING_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check ToS;DR rating using a Hybrid approach (Stale-While-Revalidate).
 */
export async function checkTosDR(url: string): Promise<TosDRResult> {
    const domain = extractMainDomain(url);
    const settings = await storage.getSettings();
    const enableCloud = settings.enableCloudTosdr ?? false;
    if (!enableCloud) await maybePromptCloudOptIn();
    const refreshMs = RATING_RECHECK_MS;
    
    // Helper to trigger background update
    const triggerLazyUpdate = async () => {
        if (!enableCloud) return;
        const fresh = await fetchFromTosdr(domain);
        if (fresh) {
            await saveCache(domain, { data: fresh, timestamp: Date.now() });
        } else {
            // Cache a negative result to avoid spamming the API
            await saveCache(domain, { data: { found: false, score: 0, source: 'fallback' }, timestamp: Date.now() });
        }
    };

    // Negatives (failed lookups) expire far sooner than real ratings, so a
    // transient cloud outage gets retried within a day instead of a week.
    const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

    // 1. Check dynamic cache first
    const cache = await getCache();
    const cachedEntry = Object.prototype.hasOwnProperty.call(cache, domain) ? cache[domain] : undefined;
    
    if (cachedEntry) {
        const isNegative = cachedEntry.data?.found === false;
        const ttlMs = isNegative ? NEGATIVE_TTL_MS : refreshMs;
        const isStale = (Date.now() - cachedEntry.timestamp) > ttlMs;
        if (isStale) {
            logEvent('enrich', 'debug', 'tosdr_cache_stale', 'Cached rating is stale, refreshing', { host: domain, negative: isNegative });
            triggerLazyUpdate(); // fire and forget
        } else {
            logEvent('enrich', 'debug', 'tosdr_cache_hit', 'Cached rating used', { host: domain, score: cachedEntry.data?.score });
        }

        // The bundled seed can be newer than a cached rating. A negative
        // (found:false) result must never shadow a known-good seed rating, and
        // after an extension update the bundle may carry a fresher ToS;DR
        // version than a cloud result cached before the update.
        const cachedVersion = Date.parse(cachedEntry.data?.serviceUpdatedAt || '');
        if (isNegative || Number.isFinite(cachedVersion)) {
            const seedResult = await getTosDRRecord(domain);
            if (seedResult) {
                const seedVersion = Date.parse(seedResult.serviceUpdatedAt || '');
                if (isNegative || (Number.isFinite(seedVersion) && seedVersion > cachedVersion)) {
                    logEvent('enrich', 'debug', 'tosdr_seed_overrode_cache', 'Bundled seed rating was newer than the cached result', { host: domain, negative: isNegative });
                    return { ...(seedResult as TosDRResult), capturedAt: seedResult.lastUpdated || undefined };
                }
            }
        }

        return { ...cachedEntry.data, capturedAt: cachedEntry.timestamp };
    }
    
    // 2. Check local seed database
    const seedResult = await getTosDRRecord(domain);
    
    if (seedResult) {
        // Prefer the rating's own ToS;DR updated_at over the bundle build time.
        // The bundle is rebuilt wholesale, so build time makes every rating look
        // equally stale and re-checks sites whose rating never changed.
        const serviceTimestamp = Date.parse(seedResult.serviceUpdatedAt || '');
        const seedTimestamp = Number.isFinite(serviceTimestamp) ? serviceTimestamp : (seedResult.lastUpdated || 0);
        const isStale = seedTimestamp > 0 && (Date.now() - seedTimestamp) > refreshMs;

        if (isStale || seedTimestamp === 0) {
            logEvent('enrich', 'debug', 'tosdr_seed_stale', 'Bundled seed rating is stale, refreshing', { host: domain, ratingAgeBasis: seedResult.serviceUpdatedAt ? 'serviceUpdatedAt' : 'lastUpdated', timestamp: seedTimestamp });
            triggerLazyUpdate();
        } else {
            logEvent('enrich', 'debug', 'tosdr_seed_used', 'Bundled seed rating used', { host: domain, score: seedResult.score, grade: seedResult.grade });
        }

        return { ...(seedResult as TosDRResult), capturedAt: seedResult.lastUpdated || undefined };
    }
    
    // 3. Not in seed, not in cache
    if (enableCloud) {
        logEvent('enrich', 'debug', 'tosdr_dynamic_fetch', 'No local rating, fetching from ToS;DR', { host: domain });
        const fresh = await fetchFromTosdr(domain);
        if (fresh) {
            await saveCache(domain, { data: fresh, timestamp: Date.now() });
            return { ...fresh, capturedAt: Date.now() };
        }
        
        // Cache failure
        const fallback: TosDRResult = { found: false, score: 0, source: 'fallback' };
        await saveCache(domain, { data: fallback, timestamp: Date.now() });
        return fallback;
    }
    
    logEvent('enrich', 'debug', 'tosdr_no_rating_cloud_disabled', 'No local rating and cloud lookup is disabled', { host: domain });
    return { found: false, score: 0, source: 'fallback' };
}

/**
 * Clear ToS;DR dynamic cache
 */
export async function clearTosDRCache(): Promise<void> {
    inMemoryCache = {};
    await chrome.storage.local.remove('tosdr_cache');
    logEvent('enrich', 'debug', 'tosdr_cache_cleared', 'Dynamic ToS;DR cache cleared');
}

// ---------------------------------------------------------------------------
// CATALOG SYNC
// Periodically pull ratings that changed in ToS;DR since the bundled catalog
// shipped and write them into the lookup cache, so a site the user visits shows
// a current rating even between extension releases.
//
// Unlike a per-domain lookup, this reveals nothing about which sites the user
// visits: it fetches the same fixed catalog pages for every user.
// ---------------------------------------------------------------------------

const CATALOG_ENDPOINT = 'https://api.tosdr.org/service/v3/';
// The catalog is ~21 pages of 500. The cap only guards a runaway loop if the API
// ever changes shape.
const CATALOG_MAX_PAGES = 30;
// A long-overdue bundle could otherwise turn one sync into an hours-long job.
// Whatever is left over is picked up on the next run.
const CATALOG_MAX_DETAILS = 250;
const CATALOG_SYNC_KEY = 'tosdr_catalog_sync';

interface CatalogSyncState {
    baseBundleUpdatedAt: number;
    versions: Record<string, string | undefined>;
    lastSyncedAt: number;
}

/**
 * Fetch every ToS;DR service whose `updated_at` moved since the bundled index
 * was built (or that is new), then cache its rating for each of its domains.
 *
 * Returns null when the refresh schedule is off or no index is bundled, so
 * callers can invoke it unconditionally. Work is persisted as it goes: if the
 * service worker is torn down mid-sweep, the next run resumes where it stopped
 * instead of re-fetching what already applied.
 */
export async function refreshTosdrCatalog(): Promise<{ pages: number; checked: number; updated: number; complete: boolean } | null> {
    const settings = await storage.getSettings();
    if ((settings.databaseRefreshDays ?? 0) === 0) return null;

    const meta = await getTosdrCatalogMeta();
    if (!meta) return null;

    // Seed the version map from the bundle the first time, and re-seed whenever
    // a new bundle ships. Otherwise a service that changed since the bundle
    // would be re-fetched on every sync, because the bundle itself never moves.
    const stored = (await chrome.storage.local.get<Record<string, any>>(CATALOG_SYNC_KEY))[CATALOG_SYNC_KEY] as CatalogSyncState | undefined;
    const versions = new Map<string, string | undefined>(
        stored && stored.baseBundleUpdatedAt === meta.updatedAt
            ? Object.entries(stored.versions || {})
            : [...meta.versions.entries()],
    );
    const persist = () => chrome.storage.local.set({
        [CATALOG_SYNC_KEY]: {
            baseBundleUpdatedAt: meta.updatedAt,
            versions: Object.fromEntries(versions),
            lastSyncedAt: Date.now(),
        } satisfies CatalogSyncState,
    });

    interface ListedService { id: string | number; name: string; rating: unknown; urls?: string[]; updated_at?: string; }

    let pages = 0;
    let checked = 0;
    let updated = 0;
    let complete = false;

    for (let page = 1; page <= CATALOG_MAX_PAGES; page++) {
        let data: any;
        try {
            const res = await rateLimiters.tosdr.execute(() => fetchWithTimeout(`${CATALOG_ENDPOINT}?page=${page}`));
            if (!res.ok) break;
            data = await res.json();
        } catch (err) {
            captureError('enrich', err, 'tosdr_catalog_page_failed', { page });
            break;
        }

        const batch: ListedService[] = data?.services || [];
        if (!batch.length) { complete = true; break; }
        pages++;

        for (const service of batch) {
            checked++;
            const id = String(service.id);
            if (versions.has(id) && versions.get(id) === service.updated_at) continue;
            if (updated >= CATALOG_MAX_DETAILS) continue; // picked up on the next run

            const record = await buildCatalogRecord(service);
            if (!record) continue;

            const domains = [...new Set((service.urls || []).map((u) => extractMainDomain(`https://${u}`)).filter(Boolean))];
            for (const domain of domains) {
                await saveCache(domain, { data: record, timestamp: Date.now() });
            }
            versions.set(id, service.updated_at);
            updated++;
        }

        // Persist progress per page so an interrupted sweep is resumable.
        await persist();

        const pageMeta = data?.page;
        if (pageMeta && pageMeta.current >= pageMeta.end) { complete = true; break; }
    }

    if (!complete) {
        logEvent('enrich', 'debug', 'tosdr_catalog_incomplete', 'ToS;DR catalog sweep was incomplete; will continue later', { pages, checked, updated });
        return { pages, checked, updated, complete: false };
    }

    await persist();
    logEvent('enrich', 'debug', 'tosdr_catalog_synced', 'ToS;DR catalog sync finished', { pages, checked, updated });
    return { pages, checked, updated, complete: true };
}

/** Fetch one service's detail and shape it into a cache record. */
async function buildCatalogRecord(service: { id: string | number; name: string; rating: unknown; updated_at?: string }): Promise<TosDRResult | null> {
    try {
        const res = await rateLimiters.tosdr.execute(() => fetchWithTimeout(`${CATALOG_ENDPOINT}?id=${service.id}`));
        if (!res.ok) return null;
        const body = await res.json();
        // v3 returns fields at the top level; older shapes nest them under `parameters`.
        const detail = body?.parameters ?? body;
        if (!detail) return null;
        const grade = normalizeGrade(detail.rating) ?? normalizeGrade(service.rating);
        return {
            found: true,
            grade,
            score: grade ? gradeToScore(grade) : 50,
            source: 'tosdr',
            serviceName: service.name,
            serviceId: Number(service.id),
            points: (detail.points || []).map((p: any) => ({ title: p.title, classification: p.case?.classification || p.classification || 'neutral' })),
            documents: (detail.documents || []).map((d: any) => ({ name: d.name, url: d.url })),
            serviceUpdatedAt: service.updated_at,
        };
    } catch (err) {
        captureError('enrich', err, 'tosdr_catalog_detail_failed', { serviceId: service.id });
        return null;
    }
}
