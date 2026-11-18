/**
 * =============================================================================
 * USE STORAGE - React Hooks for Chrome Storage
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file provides React hooks that make it easy to use Chrome's storage
 * in React components. Instead of manually loading data, these hooks handle
 * everything automatically - including real-time updates!
 * 
 * WHAT ARE REACT HOOKS?
 * Hooks are special functions in React that let components access features
 * like state and side effects. Hooks start with "use" (like useState, useEffect).
 * 
 * HOOKS PROVIDED:
 * 
 * useAppState() - Get the extension's main state
 *   Returns: { ups, sitesAnalyzed, trackersDetected, piiEventsCount, etc. }
 * 
 * useSettings() - Get user preferences
 *   Returns: { theme, notifications, whitelist, blacklist, etc. }
 * 
 * useScoreHistory() - Get UPS score history over time
 *   Returns: Array of { timestamp, ups } entries
 * 
 * useActivityLogs() - Get PII detection events
 *   Returns: Array of PII detection entries
 *
 * useExposureReport() - Get the aggregated footprint ledger
 *   Returns: { report, isLoading } - what you handed over, and who saw you
 * 
 * useDetectorLogs() - Get detector scan logs
 *   Returns: Array of detector log entries for each site visit
 * 
 * useNotifications() - Get and manage notification events
 *   Returns: { notifications, unreadCount, markAsRead, markAllAsRead, clearAll }
 * 
 * HOW THEY WORK:
 * 1. Initial Load: When a component mounts, the hook fetches data from storage
 * 2. Subscribe: The hook sets up a listener for storage changes
 * 3. Auto-Update: When data changes anywhere, the component updates automatically
 * 4. Cleanup: When the component unmounts, the listener is removed
 * 
 * EXAMPLE USAGE:
 * ```tsx
 * function MyComponent() {
 *     const state = useAppState();
 *     return <div>Your UPS: {state?.ups}</div>;
 * }
 * ```
 * =============================================================================
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from './storage';
import { AppState, UserSettings, SiteRiskData, CrossSiteExposure, PIIDetectionEvent } from './types';
import { buildExposureReport, ExposureReport } from './exposure';
import { importKey, decryptData } from './crypto';
import {
    SITE_CACHE_PREFIX,
    decryptSiteCacheShard,
    flattenSiteCacheShards,
    parseSiteCacheShardKey,
    readSiteCacheShards,
    readSiteEntry,
    siteCacheShard,
    siteCacheShardKey,
} from './site-cache';
import { logEvent } from './diagnostics';
import { POLICY_REPORT_CACHE_KEY, readCachedPolicyReports } from './ai/policy-report-cache';

async function getSessionKey(): Promise<CryptoKey | null> {
    try {
        const session = await chrome.storage.session.get<{ cryptoKeyHex?: string }>('cryptoKeyHex');
        return session.cryptoKeyHex ? importKey(session.cryptoKeyHex) : null;
    } catch (error) {
        logEvent('storage', 'warn', 'vault_key_unavailable', error instanceof Error ? error.message : String(error));
        return null;
    }
}

// Helper to decrypt data if it was encrypted
async function decryptIfNeeded(data: any): Promise<any> {
    if (typeof data !== 'string') return data;
    try {
        const session = await chrome.storage.session.get<{ cryptoKeyHex?: string }>('cryptoKeyHex');
        if (!session.cryptoKeyHex) return null; // Vault is locked
        const key = await importKey(session.cryptoKeyHex);
        return await decryptData(key, data);
    } catch (e) {
        logEvent('storage', 'warn', 'vault_decrypt_failed', e instanceof Error ? e.message : String(e));
        return null;
    }
}

// =============================================================================
// APP STATE HOOK
// Gets and subscribes to the main application state
// =============================================================================

/**
 * Hook to access the extension's current state.
 * Automatically updates when state changes anywhere in the extension.
 * 
 * @returns AppState object or null while loading
 */
export function useAppState() {
    const [state, setState] = useState<AppState | null>(null);

    useEffect(() => {
        // Initial fetch - get current state from storage
        storage.getState().then(setState);

        // Listen for changes - update state when storage changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.state) {
                setState(changes.state.newValue as AppState);
            }
        };

        // Subscribe to storage changes
        chrome.storage.onChanged.addListener(listener);

        // Cleanup: unsubscribe when component unmounts
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return state;
}

// =============================================================================
// SETTINGS HOOK
// Gets and subscribes to user preferences
// =============================================================================

/**
 * Hook to access user settings/preferences.
 * Automatically updates when settings change.
 * 
 * @returns UserSettings object or null while loading
 */
export function useSettings() {
    const [settings, setSettings] = useState<UserSettings | null>(null);

    useEffect(() => {
        storage.getSettings().then(setSettings);

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.settings) {
                setSettings(changes.settings.newValue as UserSettings);
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return settings;
}

export function useUserName() {
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        chrome.storage.local.get<{ userName?: string }>('userName').then(res => {
            setUserName(res.userName || null);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.userName) {
                setUserName((changes.userName.newValue as string | undefined) || null);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return userName;
}

export function useScoreHistory() {
    const [history, setHistory] = useState<import('./types').ScoreHistoryEntry[] | null>(null);
    const lastUpdateRef = useRef<number>(0);

    useEffect(() => {
        let isMounted = true;
        // Capture timestamp BEFORE fetch to correctly guard against stale data
        const fetchTimestamp = Date.now();
        chrome.storage.local.get('scoreHistory').then(async res => {
            const decrypted = await decryptIfNeeded(res.scoreHistory);
            if (isMounted && fetchTimestamp >= lastUpdateRef.current) {
                lastUpdateRef.current = fetchTimestamp;
                setHistory((decrypted || []) as import('./types').ScoreHistoryEntry[]);
            }
        });

        const listener = async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.scoreHistory) {
                const timestamp = Date.now();
                const decrypted = await decryptIfNeeded(changes.scoreHistory.newValue);
                if (isMounted && timestamp >= lastUpdateRef.current) {
                    lastUpdateRef.current = timestamp;
                    setHistory((decrypted || []) as import('./types').ScoreHistoryEntry[]);
                }
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    return history;
}

export function useActivityLogs() {
    const [logs, setLogs] = useState<import('./types').PIIDetectionEvent[]>([]);
    const lastUpdateRef = useRef<number>(0);

    useEffect(() => {
        let isMounted = true;
        // Capture timestamp BEFORE fetch to correctly guard against stale data
        const fetchTimestamp = Date.now();
        chrome.storage.local.get('piiDetections').then(async res => {
            const decrypted = await decryptIfNeeded(res.piiDetections);
            if (isMounted && fetchTimestamp >= lastUpdateRef.current) {
                lastUpdateRef.current = fetchTimestamp;
                setLogs((decrypted || []) as import('./types').PIIDetectionEvent[]);
            }
        });

        const listener = async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.piiDetections) {
                const timestamp = Date.now();
                const decrypted = await decryptIfNeeded(changes.piiDetections.newValue);
                if (isMounted && timestamp >= lastUpdateRef.current) {
                    lastUpdateRef.current = timestamp;
                    setLogs((decrypted || []) as import('./types').PIIDetectionEvent[]);
                }
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    return logs;
}

// =============================================================================
// FOOTPRINT LEDGER HOOK
// Reads the three stored inputs and aggregates them into the ledger.
// =============================================================================

/** Narrow decrypted storage into the shapes the aggregation expects. */
function asObject<T extends object>(value: any): T {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value as T : {} as T;
}

function asArray<T>(value: any): T[] {
    return Array.isArray(value) ? value as T[] : [];
}

/**
 * Hook to access the footprint ledger.
 *
 * Reads `crossSiteExposure`, `piiDetections` and `siteCache` (each may be
 * encrypted), decrypts them, and aggregates them with `buildExposureReport`.
 * The aggregation itself is pure, so all of the logic worth testing lives in
 * `exposure.ts` rather than here.
 *
 * The raw `siteCache` and `piiEvents` are returned with the report so a page
 * that also builds the weekly digest from the same records does not decrypt
 * every shard and the personal-info list a second time.
 *
 * @returns { report, siteCache, piiEvents, isLoading }
 */
export function useExposureReport(): {
    report: ExposureReport;
    siteCache: Record<string, SiteRiskData>;
    piiEvents: PIIDetectionEvent[];
    isLoading: boolean;
} {
    const [exposure, setExposure] = useState<CrossSiteExposure>({});
    const [piiEvents, setPiiEvents] = useState<PIIDetectionEvent[]>([]);
    // The site cache has its own subscription; reuse it instead of decrypting
    // every shard a second time here.
    const { siteCache, isLoading: isSiteCacheLoading } = useSiteCache();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const load = async (raw: Record<string, any>) => {
            const [decryptedExposure, decryptedPii] = await Promise.all([
                decryptIfNeeded(raw.crossSiteExposure),
                decryptIfNeeded(raw.piiDetections),
            ]);
            if (!isMounted) return;
            setExposure(asObject<CrossSiteExposure>(decryptedExposure));
            setPiiEvents(asArray<PIIDetectionEvent>(decryptedPii));
            setIsLoading(false);
        };

        chrome.storage.local
            .get(['crossSiteExposure', 'piiDetections'])
            .then(load)
            .catch((error) => {
                // A read failure must not leave the page spinning forever; show an
                // empty ledger instead. The deterministic view is the product, and
                // it is honest about there being nothing to show.
                logEvent('storage', 'warn', 'exposure_read_failed', error instanceof Error ? error.message : String(error));
                if (isMounted) setIsLoading(false);
            });

        const listener = async (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName !== 'local') return;
            const touched = ['crossSiteExposure', 'piiDetections'];
            if (!touched.some(k => changes[k])) return;
            await load(await chrome.storage.local.get(touched));
        };

        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    // Aggregating on every render of a large site cache would be wasteful; the
    // inputs only change when the storage listener above fires.
    const report = useMemo(
        () => buildExposureReport({ exposure, piiEvents, siteCache }),
        [exposure, piiEvents, siteCache]
    );

    return { report, siteCache, piiEvents, isLoading: isLoading || isSiteCacheLoading };
}

/**
 * Reads the timestamped personal-info events without building the full
 * footprint report. The weekly digest needs only this list and the site cache;
 * keeping it separate avoids aggregating every exposure on each dashboard load.
 */
export function usePiiEvents(): { piiEvents: PIIDetectionEvent[]; isLoading: boolean } {
    const [piiEvents, setPiiEvents] = useState<PIIDetectionEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const load = async (raw: Record<string, any>) => {
            const decrypted = await decryptIfNeeded(raw.piiDetections);
            if (!isMounted) return;
            setPiiEvents(asArray<PIIDetectionEvent>(decrypted));
            setIsLoading(false);
        };

        chrome.storage.local
            .get('piiDetections')
            .then(load)
            .catch((error) => {
                logEvent('storage', 'warn', 'pii_events_read_failed', error instanceof Error ? error.message : String(error));
                if (isMounted) setIsLoading(false);
            });

        const listener = async (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName !== 'local' || !changes.piiDetections) return;
            await load(await chrome.storage.local.get('piiDetections'));
        };

        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    return { piiEvents, isLoading };
}

export function useDetectorLogs() {
    const [logs, setLogs] = useState<import('./types').DetectorLogEntry[]>([]);

    useEffect(() => {
        let isMounted = true;
        chrome.storage.local.get('detectorLogs').then(async res => {
            // detectorLogs may be encrypted; decrypt if needed
            const decrypted = await decryptIfNeeded(res.detectorLogs);
            if (isMounted) {
                setLogs((decrypted || []) as import('./types').DetectorLogEntry[]);
            }
        });

        const listener = async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.detectorLogs) {
                const decrypted = await decryptIfNeeded(changes.detectorLogs.newValue);
                if (isMounted) {
                    setLogs((decrypted || []) as import('./types').DetectorLogEntry[]);
                }
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    return logs;
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<import('./types').NotificationEvent[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        let isMounted = true;
        // Initial fetch, notifications may now be encrypted
        chrome.storage.local.get('notifications').then(async res => {
            const decrypted = await decryptIfNeeded(res.notifications);
            const notifs = (decrypted || []) as import('./types').NotificationEvent[];
            if (isMounted) {
                setNotifications(notifs);
                setUnreadCount(notifs.filter(n => !n.read).length);
            }
        });

        // Listen for changes
        const listener = async (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.notifications) {
                const decrypted = await decryptIfNeeded(changes.notifications.newValue);
                const notifs = (decrypted || []) as import('./types').NotificationEvent[];
                if (isMounted) {
                    setNotifications(notifs);
                    setUnreadCount(notifs.filter(n => !n.read).length);
                }
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    const markAsRead = async (id: string) => {
        await storage.markAsRead(id);
    };

    const markAllAsRead = async () => {
        await storage.markAllAsRead();
    };

    const clearAll = async () => {
        await storage.clearNotifications();
    };

    const removeNotification = async (id: string) => {
        await storage.removeNotification(id);
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        removeNotification
    };
}

// =============================================================================
// SITE CACHE HOOK
// Gets and subscribes to the analyzed sites cache
// =============================================================================

/**
 * Hook to access the site cache (all analyzed websites).
 * This replaces the duplicate data loading pattern that was in:
 * - website-safety.tsx
 * - sites-analyzed.tsx
 * - trackers.tsx
 * - overview.tsx
 * 
 * @returns Object containing:
 *   - siteCache: Record of domain -> SiteRiskData
 *   - sites: Array of [domain, data] entries for easy iteration
 *   - isLoading: Whether the initial load is still in progress
 */
export function useSiteCache() {
    const [shards, setShards] = useState<Record<number, Record<string, SiteRiskData>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const shardsRef = useRef(shards);

    useEffect(() => {
        let isMounted = true;

        const loadAll = async () => {
            const key = await getSessionKey();
            const next = await readSiteCacheShards(key);
            if (!isMounted) return;
            shardsRef.current = next;
            setShards(next);
            setIsLoading(false);
        };

        loadAll().catch((error) => {
            logEvent('storage', 'warn', 'site_cache_read_failed', error instanceof Error ? error.message : String(error));
            if (isMounted) setIsLoading(false);
        });

        // A shard change decrypts only that shard. A legacy `siteCache` change
        // means the one-time migration is still running, so reload everything.
        const listener = async (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName !== 'local') return;
            if (changes.siteCache) {
                await loadAll();
                return;
            }
            const touched = Object.keys(changes).filter(key => key.startsWith(SITE_CACHE_PREFIX));
            if (touched.length === 0) return;

            const key = await getSessionKey();
            const next = { ...shardsRef.current };
            for (const storageKey of touched) {
                const shard = parseSiteCacheShardKey(storageKey);
                if (shard === null) continue;
                const raw = changes[storageKey].newValue;
                next[shard] = raw === undefined
                    ? {}
                    : await decryptSiteCacheShard(raw, key, shard);
            }
            if (!isMounted) return;
            shardsRef.current = next;
            setShards(next);
        };

        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    // Flattening is cheap and only runs when a shard changed.
    const siteCache = useMemo(() => flattenSiteCacheShards(shards), [shards]);
    const sites = Object.entries(siteCache);

    return {
        siteCache,
        sites,
        isLoading
    };
}

/**
 * Policy grades this device generated for a site, keyed by domain.
 *
 * A site's own record only carries a ToS;DR rating. The local report lives in
 * its own cache, written by the side panel and the dashboard's details panel,
 * so a list that shows a grade (the activity log) reads it here. The hook
 * follows the cache, so a report that finishes while the dashboard is open
 * replaces `N/A` without a reload.
 */
export function useLocalPolicyGrades(): Record<string, string> {
    const [grades, setGrades] = useState<Record<string, string>>({});

    useEffect(() => {
        let isMounted = true;

        const load = () => {
            readCachedPolicyReports().then((reports) => {
                if (!isMounted) return;
                const next: Record<string, string> = {};
                for (const [domain, report] of Object.entries(reports)) {
                    if (report?.grade) next[domain] = report.grade;
                }
                setGrades(next);
            });
        };

        load();

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes[POLICY_REPORT_CACHE_KEY]) load();
        };

        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    return grades;
}

/**
 * Returns the full (decrypted) SiteRiskData for the currently active site,
 * read from the encrypted siteCache rather than the plaintext `state`.
 * `state.currentSite` is intentionally slimmed to non-sensitive fields, so
 * detailed breakdowns (detectionDetails/enrichedDetails) must come from here.
 */
export function useCurrentSite(): SiteRiskData | undefined {
    const state = useAppState();
    const [site, setSite] = useState<SiteRiskData | undefined>(undefined);
    const domain = state?.currentSite?.domain;
    const shardKey = domain ? siteCacheShardKey(siteCacheShard(domain)) : null;

    useEffect(() => {
        if (!domain) {
            setSite(undefined);
            return;
        }
        let isMounted = true;

        const load = async () => {
            const key = await getSessionKey();
            const entry = await readSiteEntry(domain, key);
            if (isMounted) setSite(entry);
        };

        load().catch((error) => {
            logEvent('storage', 'warn', 'current_site_read_failed', error instanceof Error ? error.message : String(error));
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName !== 'local') return;
            // `siteCache` is the legacy key removed by the one-time migration.
            if (changes.siteCache || (shardKey && changes[shardKey])) load();
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            isMounted = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, [domain, shardKey]);

    return site;
}
