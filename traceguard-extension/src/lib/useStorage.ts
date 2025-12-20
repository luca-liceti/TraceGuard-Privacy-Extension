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
 *   Returns: { ups, sitesAnalyzed, trackersDetected, safeVisitStreak, etc. }
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

import { useState, useEffect } from 'react';
import { storage } from './storage';
import { AppState, UserSettings, SiteRiskData } from './types';

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

export function useScoreHistory() {
    const [history, setHistory] = useState<import('./types').ScoreHistoryEntry[]>([]);

    useEffect(() => {
        chrome.storage.local.get('scoreHistory').then(res => {
            setHistory((res.scoreHistory || []) as import('./types').ScoreHistoryEntry[]);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.scoreHistory) {
                setHistory((changes.scoreHistory.newValue || []) as import('./types').ScoreHistoryEntry[]);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return history;
}

export function useActivityLogs() {
    const [logs, setLogs] = useState<import('./types').PIIDetectionEvent[]>([]);

    useEffect(() => {
        chrome.storage.local.get('piiDetections').then(res => {
            setLogs((res.piiDetections || []) as import('./types').PIIDetectionEvent[]);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.piiDetections) {
                setLogs((changes.piiDetections.newValue || []) as import('./types').PIIDetectionEvent[]);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return logs;
}

export function useDetectorLogs() {
    const [logs, setLogs] = useState<import('./types').DetectorLogEntry[]>([]);

    useEffect(() => {
        chrome.storage.local.get('detectorLogs').then(res => {
            setLogs((res.detectorLogs || []) as import('./types').DetectorLogEntry[]);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.detectorLogs) {
                setLogs((changes.detectorLogs.newValue || []) as import('./types').DetectorLogEntry[]);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return logs;
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<import('./types').NotificationEvent[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Initial fetch
        chrome.storage.local.get('notifications').then(res => {
            const notifs = (res.notifications || []) as import('./types').NotificationEvent[];
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.notifications) {
                const notifs = (changes.notifications.newValue || []) as import('./types').NotificationEvent[];
                setNotifications(notifs);
                setUnreadCount(notifs.filter(n => !n.read).length);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
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
    const [siteCache, setSiteCache] = useState<Record<string, SiteRiskData>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initial fetch
        chrome.storage.local.get('siteCache').then(res => {
            setSiteCache((res.siteCache || {}) as Record<string, SiteRiskData>);
            setIsLoading(false);
        });

        // Listen for changes
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && changes.siteCache) {
                setSiteCache(
                    (changes.siteCache.newValue || {}) as Record<string, SiteRiskData>
                );
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Pre-compute the entries array for convenience
    const sites = Object.entries(siteCache);

    return {
        siteCache,
        sites,
        isLoading
    };
}
