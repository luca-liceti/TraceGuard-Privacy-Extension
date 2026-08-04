/**
 * =============================================================================
 * NETWORK MONITOR — Observes web requests to detect blocked trackers & headers
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
import { isLocalAddress, isLocalUrl } from '../../lib/utils';
import { isTrackerDomain, lookupTrackerDomain } from './database-loader';

interface TabNetworkData {
    url: string; // The URL of the main frame
    requests: Record<string, NetworkRequestDetail>; // URL -> Detail
    responseHeaders: { name: string; value: string }[];
    setCookies: { name: string; value: string; domain: string }[];
}

// Stores network data per tab
const tabData = new Map<number, TabNetworkData>();

/**
 * Initializes the network monitor listeners.
 */
export function initNetworkMonitor() {
    // 1. Log every attempted request
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
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

                const reqUrl = new URL(details.url);
                const mainUrl = new URL(data.url);
                const isThirdParty = reqUrl.hostname !== mainUrl.hostname && !reqUrl.hostname.endsWith('.' + mainUrl.hostname);

                data.requests[details.url] = {
                    url: details.url,
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
        { urls: ['<all_urls>'] }
    );

    // 2. Detect blocked requests (e.g., by uBlock Origin)
    chrome.webRequest.onErrorOccurred.addListener(
        (details) => {
            if (details.tabId < 0) return;
            const data = tabData.get(details.tabId);
            if (!data) return;

            const req = data.requests[details.url];
            if (req) {
                req.status = details.error === 'net::ERR_BLOCKED_BY_CLIENT' ? 'blocked' : 'failed';
                req.blockedReason = details.error;
            }
        },
        { urls: ['<all_urls>'] }
    );

    // 3. Capture response headers (security headers + Set-Cookie)
    chrome.webRequest.onHeadersReceived.addListener(
        (details) => {
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

            // Capture Set-Cookie headers from ANY request
            if (details.responseHeaders) {
                for (const header of details.responseHeaders) {
                    if (header.name.toLowerCase() === 'set-cookie' && header.value) {
                        try {
                            const reqUrl = new URL(details.url);
                            // Very basic parsing just to get name and value for enrichment
                            const parts = header.value.split(';');
                            const nameValue = parts[0].split('=');
                            if (nameValue.length >= 2) {
                                data.setCookies.push({
                                    name: nameValue[0].trim(),
                                    value: nameValue.slice(1).join('=').trim(),
                                    domain: reqUrl.hostname // Default to request host, enrichment will refine
                                });
                            }
                        } catch (e) {
                            // Ignore
                        }
                    }
                }
            }
        },
        { urls: ['<all_urls>'] },
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
    const data = tabData.get(tabId);
    if (!data) return null;
    
    // Quick enrichment of the network requests using our databases
    for (const req of Object.values(data.requests)) {
        req.isTracker = await isTrackerDomain(req.domain);
        const radar = await lookupTrackerDomain(req.domain);
        if (radar && radar.owner) {
            req.organization = radar.owner;
        }
    }
    
    // We don't delete it immediately in case multiple analysis events fire,
    // but the next main_frame navigation will reset it.
    return data;
}
