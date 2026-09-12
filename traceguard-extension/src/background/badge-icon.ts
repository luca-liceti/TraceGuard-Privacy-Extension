/**
 * =============================================================================
 * BADGE ICON - Dynamic WSS Indicator in the Toolbar
 * =============================================================================
 *
 * Uses chrome.action.setBadgeText and setBadgeBackgroundColor to show a
 * color-coded Website Safety Score (WSS) on the extension toolbar icon for
 * each tab individually.
 *
 * Color palette mirrors the thresholds and oklch values in globals.css,
 * expressed as sRGB hex because the badge API accepts CSS color strings:
 *
 *   Excellent (80-100): #22c55e  -- matches --success
 *   Good      (60-79):  #22c55e  -- same green
 *   Fair      (40-59):  #eab308  -- matches --warning
 *   Poor      (20-39):  #f97316  -- matches --alert
 *   Critical   (0-19):  #ef4444  -- matches --destructive
 *   Unknown  (no data): #6b7280  -- neutral grey, shown while a page loads
 *
 * The badge text shows the raw WSS integer so the user can read the exact
 * score at a glance without opening the popup.
 * =============================================================================
 */

import { logEvent, captureError } from '../lib/diagnostics';

// Per-tab WSS cache: cleared when a tab navigates or closes.
const tabWssCache = new Map<number, number>();

/** sRGB hex colors keyed by WSS safety level, derived from globals.css. */
const BADGE_COLORS = {
    excellent: '#22c55e',
    good:      '#22c55e',
    fair:      '#eab308',
    poor:      '#f97316',
    critical:  '#ef4444',
    unknown:   '#6b7280',
} as const;

/** White badge text is readable on all badge background colors above. */
const BADGE_TEXT_COLOR = '#ffffff';

function safetyLevelForWss(wss: number): keyof typeof BADGE_COLORS {
    if (wss >= 80) return 'excellent';
    if (wss >= 60) return 'good';
    if (wss >= 40) return 'fair';
    if (wss >= 20) return 'poor';
    return 'critical';
}

/**
 * Set the badge for a specific tab to reflect its WSS.
 * Stores the score in the per-tab cache so it can be re-applied when
 * the user switches back to that tab.
 */
export async function updateTabBadge(tabId: number, wss: number): Promise<void> {
    tabWssCache.set(tabId, wss);
    const level = safetyLevelForWss(wss);
    const color = BADGE_COLORS[level];
    const text  = String(wss);
    try {
        await Promise.all([
            chrome.action.setBadgeBackgroundColor({ color, tabId }),
            chrome.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR, tabId }),
            chrome.action.setBadgeText({ text, tabId }),
        ]);
        logEvent('badge', 'debug', 'badge_updated', `Badge set to ${wss} (${level}) for tab ${tabId}`, {
            tabId, wss, level,
        });
    } catch (error) {
        captureError('badge', error, 'badge_update_failed');
    }
}

/**
 * Reset the badge for a tab to the neutral grey state (shown while a page
 * loads or when the URL is a browser internal page with no WSS data).
 */
export async function clearTabBadge(tabId: number): Promise<void> {
    tabWssCache.delete(tabId);
    try {
        await Promise.all([
            chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.unknown, tabId }),
            chrome.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR, tabId }),
            chrome.action.setBadgeText({ text: '', tabId }),
        ]);
    } catch (error) {
        // A tab that closes mid-navigation causes a benign "No tab with id" error.
        // Log at warn, not as a captured error, so the durable error log stays clean.
        logEvent('badge', 'warn', 'badge_clear_failed', `Could not clear badge for tab ${tabId}`, {
            tabId, error: String(error),
        });
    }
}

/**
 * Re-apply the cached badge for a tab when the user switches to it.
 * If no WSS is cached (the tab has never been analyzed), nothing is shown.
 */
export async function reapplyTabBadge(tabId: number): Promise<void> {
    const wss = tabWssCache.get(tabId);
    if (wss === undefined) {
        // Tab not yet analyzed: show empty badge so the icon stays clean.
        await clearTabBadge(tabId);
        return;
    }
    await updateTabBadge(tabId, wss);
}

/** Remove the per-tab cache entry when a tab is closed to prevent memory leaks. */
export function evictTabBadge(tabId: number): void {
    tabWssCache.delete(tabId);
}
