/**
 * =============================================================================
 * NETWORK MONITOR, Observes web requests to detect blocked trackers & headers
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 * Uses chrome.webRequest to observe all network activity per tab.
 * - Records every attempted request (onBeforeRequest)
 * - Detects which requests were blocked by other extensions (onErrorOccurred)
 * - Captures Set-Cookie and security headers (onHeadersReceived)
 * - Does NOT block anything (observational only)
 * =============================================================================
 */

import { NetworkRequestDetail } from '../../lib/types';
import { isLocalUrl } from '../../lib/utils';
import { isTrackerDomain, lookupTrackerDomain, getDisconnectEntity } from './database-loader';
import { parseSetCookie, SetCookieRecord } from '../../lib/set-cookie';

interface TabNetworkData {
    url: string; // The URL of the main frame
    requests: Record<string, NetworkRequestDetail>; // URL -> Detail
    responseHeaders: { name: string; value: string }[];
    setCookies: SetCookieRecord[];
}

// Stores network data per tab
const tabData = new Map<number, TabNetworkData>();

// Mirror of the user's "Enabled" master toggle. When disabled, the monitor
// observes nothing: no requests, cookies, or headers are recorded.
let monitorEnabled = true;

/**
 * Turns the network monitor on/off. Called from the background worker whenever
 * the user toggles the extension's master switch.
 */
export function setNetworkMonitorEnabled(enabled: boolean): void {
    monitorEnabled = enabled;
}

/**
 * Initializes the network monitor listeners.
 */
export function initNetworkMonitor() {
    // 1. Log every attempted request
    chrome.webRequest.onBeforeRequest.addListener(
        (details): undefined => {
            if (!monitorEnabled) return; // Paused, observe nothing
            if (details.tabId < 0) return; // Ignore background requests
            
            // Initialize tab data on main_frame navigation
            if (details.type === 'main_frame') {
                if (isLocalUrl(details.url)) {
                    tabData.delete(details.tabId);
                    return; // Ignore local sites completely
                }

                tabData.set(details.tabId, {
                    url: details.url,
                    requests: {},
                    responseHeaders: [],
                    setCookies: []
                });
                return;
            }

            const data = tabData.get(details.tabId);
            if (!data) return;

            try {
                if (isLocalUrl(details.url)) return;

                // Hard cap: stop recording once we hit 2,000 requests per tab.
                // This prevents memory exhaustion from malicious pages that trigger
                // unlimited unique fetch requests.
                if (Object.keys(data.requests).length >= 2000) return;

                const reqUrl = new URL(details.url);
                const mainUrl = new URL(data.url);
                const isThirdParty = reqUrl.hostname !== mainUrl.hostname && !reqUrl.hostname.endsWith('.' + mainUrl.hostname);

                data.requests[details.url] = {
                    url: reqUrl.origin, // Origin only, never store the request path
                    domain: reqUrl.hostname,
                    resourceType: details.type,
                    organization: null, // Populated during enrichment
                    isTracker: false,   // Populated during enrichment
                    isThirdParty,
                    status: 'completed', // Defaults to completed, updated by onErrorOccurred
                    blockedReason: null,
                    timestamp: details.timeStamp
                };
            } catch (e) {
                // Invalid URL, ignore
            }
        },
        { urls: ['*://*/*'] }
    );

    // 2. Detect blocked requests (e.g., by uBlock Origin)
    chrome.webRequest.onErrorOccurred.addListener(
        (details) => {
            if (!monitorEnabled) return;
            if (details.tabId < 0) return;
            const data = tabData.get(details.tabId);
            if (!data) return;

            const req = data.requests[details.url];
            if (req) {
                req.status = details.error === 'net::ERR_BLOCKED_BY_CLIENT' ? 'blocked' : 'failed';
                req.blockedReason = details.error;
            }
        },
        { urls: ['*://*/*'] }
    );

    // 3. Capture response headers (security headers + Set-Cookie)
    chrome.webRequest.onHeadersReceived.addListener(
        (details): undefined => {
            if (!monitorEnabled) return;
            if (details.tabId < 0) return;
            const data = tabData.get(details.tabId);
            if (!data) return;

            // Only capture security headers for the main document
            if (details.type === 'main_frame' && details.responseHeaders) {
                data.responseHeaders = details.responseHeaders.map(h => ({
                    name: h.name.toLowerCase(),
                    value: h.value || ''
                }));
            }

            // Capture Set-Cookie headers from ANY request. The header carries the
            // full cookie metadata (name, domain, HttpOnly/Secure/SameSite flags,
            // expiry), so no `cookies` permission is needed.
            if (details.responseHeaders) {
                for (const header of details.responseHeaders) {
                    if (header.name.toLowerCase() === 'set-cookie' && header.value) {
                        try {
                            const reqUrl = new URL(details.url);
                            const parsed = parseSetCookie(header.value, reqUrl.hostname);
                            if (parsed) data.setCookies.push(parsed);
                        } catch (e) {
                            // Ignore invalid URLs/headers
                        }
                    }
                }
            }
        },
        { urls: ['*://*/*'] },
        ['responseHeaders', 'extraHeaders'] // extraHeaders required for Set-Cookie in MV3
    );

    // Clean up when tab is closed
    chrome.tabs.onRemoved.addListener((tabId) => {
        tabData.delete(tabId);
    });
}

/**
 * Retrieves the collected network data for a tab, and cleans it up.
 * Call this when page analysis is complete.
 */
export async function getAndClearNetworkData(tabId: number): Promise<TabNetworkData | null> {
    if (!monitorEnabled) return null;
    const data = tabData.get(tabId);
    if (!data) return null;
    
    // Quick enrichment of the network requests using our databases.
    // Parallelize: the database getters are memoized, so awaiting them serially
    // in a 2,000-request loop added up to thousands of sequential microtasks.
    await Promise.all(Object.values(data.requests).map(async (req) => {
        req.isTracker = await isTrackerDomain(req.domain);
        const radar = await lookupTrackerDomain(req.domain);
        const disconnectEntity = await getDisconnectEntity(req.domain);
        req.organization = radar?.owner || radar?.displayName || disconnectEntity || null;
    }));
    
    // We don't delete it immediately in case multiple analysis events fire,
    // but the next main_frame navigation will reset it.
    return data;
}
