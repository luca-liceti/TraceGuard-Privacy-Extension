/**
 * =============================================================================
 * BACKGROUND SERVICE WORKER - The "Brain" of TraceGuard
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the main background script that runs behind the scenes in the browser.
 * Think of it as the "brain" of the TraceGuard extension - it doesn't have a 
 * visible interface, but it's always running and managing everything.
 * 
 * KEY RESPONSIBILITIES:
 * 1. Listens for when the extension is installed or the browser starts up
 * 2. Injects the content script (privacy analyzer) into every webpage you visit
 * 3. Receives messages from other parts of the extension and responds to them
 * 4. Calculates and stores privacy scores for websites
 * 5. Tracks when you enter personal information (PII) on websites
 * 6. Sends notifications when something important happens
 * 
 * HOW IT WORKS:
 * - When you visit a website, this script receives analysis data from the content script
 * - It calculates a "Website Safety Score" (WSS) based on various privacy factors
 * - It updates your "User Privacy Score" (UPS) based on your browsing behavior
 * - It stores all this data so you can view it in the dashboard
 * 
 * IMPORTANT CONCEPTS:
 * - WSS (Website Safety Score): How safe a website is (0-100, higher = safer)
 * - UPS (User Privacy Score): Your overall privacy health (0-100, higher = better)
 * - PII: Personally Identifiable Information (like your email, password, phone number)
 * =============================================================================
 */

import { storage, readBuffer, writeBuffer } from '../lib/storage';
import { recordError } from '../lib/error-log';
import { z } from 'zod';
import { loadBlacklist, checkReputation, refreshBlacklistFromRemote } from './services/reputation';
import { calculateWSS } from '../lib/scoring';
import { SiteRiskData, ScoreHistoryEntry, EnrichedDetectionDetails, FingerprintingDetail, DetectorLogEntry } from '../lib/types';
import { checkTosDR } from './tosdr-api';
import { calculateVisitImpact, calculatePIIPenalty } from '../lib/pii';
import { encryptData, decryptData, importKey } from '../lib/crypto';
import { preWarmDatabases, lookupTrackerDomain } from './services/database-loader';
import { initNetworkMonitor, getAndClearNetworkData, setNetworkMonitorEnabled } from './services/network-monitor';
import { enrichCookies } from './services/cookie-enricher';
import { enrichTrackers } from './services/tracker-enricher';
import { analyzeHeaders, computeHeaderGrade } from './services/header-analyzer';
import { isLocalUrl } from '../lib/utils';
import { runDataMigrations } from './services/migrations';
import i18n from '../lib/i18n';

// Serializes read-modify-write workflows. MV3 can handle messages concurrently;
// without this queue, two visits can overwrite each other's encrypted cache/history.
let telemetryWriteQueue: Promise<void> = Promise.resolve();
function queueTelemetryWrite(task: () => Promise<void>): Promise<void> {
    const next = telemetryWriteQueue.then(task, task);
    telemetryWriteQueue = next.catch(error => console.error('[Storage] Queued write failed:', error));
    return next;
}

async function createNotification(
    notification: Parameters<typeof storage.addNotification>[0],
    key?: CryptoKey | null
) {
    await storage.addNotification(notification, key);
    const settings = await storage.getSettings();
    if (!settings.notifications || settings.notificationLevel === 'silent') return;
    if (settings.notificationLevel === 'balanced' && notification.severity === 'info') return;
    try {
        const params = notification.params ? { ...notification.params } : undefined;
        if (params && typeof params.fieldType === 'string') {
            params.fieldType = i18n.t(params.fieldType);
        }
        const title = notification.titleKey ? i18n.t(notification.titleKey, params) : notification.title;
        const message = notification.messageKey ? i18n.t(notification.messageKey, params) : notification.message;
        await chrome.notifications.create(`notif-${Date.now()}`, {
            type: 'basic', iconUrl: 'src/assets/icons/icon-128.png', title,
            message, priority: notification.severity === 'critical' ? 2 : 1,
        });
    } catch (error) {
        // An OS notification must never prevent the local event from being saved.
        console.warn('[Notifications] Unable to create OS notification:', error);
    }
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
    // Notifications are stored encrypted whenever the vault has been set up,
    // so decrypt before looking up the clicked id. Without this, every click
    // would fall through to the generic dashboard.
    const key = await getCryptoKey();
    const result = await chrome.storage.local.get('notifications');
    const raw = result.notifications;
    let notifications: any[] = [];
    if (typeof raw === 'string') {
        if (key) notifications = (await decryptData<any[]>(key, raw)) || [];
    } else {
        notifications = Array.isArray(raw) ? raw : [];
    }
    const notification = notifications.find((n: any) => n.id === notificationId);
    
    if (notification && notification.actionUrl) {
        chrome.tabs.create({ url: chrome.runtime.getURL(`src/dashboard/index.html#${notification.actionUrl}`) });
    } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
    }
});

const DATABASE_REFRESH_ALARM = 'databaseRefresh';
const CLEANUP_ALARM = 'cleanupLogs';
const DATABASE_REFRESH_OPTIONS = new Set([1, 3, 7, 14, 30]);

async function configureDatabaseRefresh(days: number | undefined) {
    const refreshDays = DATABASE_REFRESH_OPTIONS.has(days ?? 7) ? days ?? 7 : 7;
    await chrome.alarms.create(DATABASE_REFRESH_ALARM, { periodInMinutes: refreshDays * 24 * 60 });
}

// =============================================================================
// TAB TRACKING
// Keeps the global state in sync with the active tab for the UI (Sidebar/Popup)
// =============================================================================
async function syncActiveTabSiteData(tabUrl: string | undefined) {
    if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
        const currentState = await storage.getState();
        if (currentState.currentSite) {
            // Pass only the changed field so concurrent counter writes are never clobbered.
            await storage.updateState({ currentSite: undefined });
        }
        return;
    }
    try {
        const domain = new URL(tabUrl).hostname;
        const key = await getCryptoKey();
        let siteCache: Record<string, import('../lib/types').SiteRiskData> = {};
        
        if (key) {
            const result = await chrome.storage.local.get<Record<string, any>>('siteCache');
            siteCache = typeof result.siteCache === 'string' 
                ? await decryptData(key, result.siteCache) || {} 
                : result.siteCache || {};
        } else {
            siteCache = (await readBuffer<Record<string, SiteRiskData>>('bufferedSiteCache')) || {};
        }

        const siteData = siteCache[domain];
        const currentState = await storage.getState();
        
        // Only update if it actually changed to avoid unnecessary re-renders.
        // Persist only non-sensitive fields to plaintext state — the full
        // analysis lives in the encrypted siteCache.
        if (currentState.currentSite?.domain !== siteData?.domain || currentState.currentSite?.lastAnalyzed !== siteData?.lastAnalyzed) {
            await storage.updateState({ currentSite: siteData ? slimSiteData(siteData) : undefined });
        }
    } catch (error) {
        console.error('[TabTracking] Error syncing site data:', error);
        recordError('Tab tracking sync failed', String(error));
    }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await syncActiveTabSiteData(tab.url);
    } catch (error) {
        console.error('[TabTracking] Error getting activated tab:', error);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        await syncActiveTabSiteData(tab.url);
    }
});

async function refreshPrivacyDatabases() {
    try {
        await preWarmDatabases();
    } catch (error) {
        // Bundled/last-known snapshots remain available when an update is offline.
        console.warn('[DatabaseLoader] Scheduled refresh failed; keeping current data:', error);
    }

    // Best-effort signed threat-feed refresh; bundled snapshot remains on failure.
    try {
        await refreshBlacklistFromRemote();
    } catch (error) {
        console.warn('[Reputation] Threat-feed refresh failed; keeping bundled snapshot:', error);
    }
}

async function getCryptoKey(): Promise<CryptoKey | null> {
    const session = await chrome.storage.session.get<Record<string, any>>('cryptoKeyHex');
    if (session.cryptoKeyHex) {
        return importKey(session.cryptoKeyHex);
    }
    return null;
}

async function flushBufferedTelemetry() {
    const key = await getCryptoKey();
    if (!key) return; // Should not happen since UI just set it

    // Buffers are encrypted with the session buffer key, so decrypt each here.
    const [bufferedPii, bufferedScoreHistory, bufferedSiteCache, bufferedDetectorLogs, bufferedNotifications, bufferedExposure] = await Promise.all([
        readBuffer<any[]>('bufferedPii'),
        readBuffer<any[]>('bufferedScoreHistory'),
        readBuffer<Record<string, SiteRiskData>>('bufferedSiteCache'),
        readBuffer<any[]>('bufferedDetectorLogs'),
        readBuffer<any[]>('bufferedNotifications'),
        readBuffer<Record<string, string[]>>('bufferedExposure'),
    ]);
    const local = await chrome.storage.local.get<Record<string, any>>(['piiDetections', 'scoreHistory', 'siteCache', 'detectorLogs', 'notifications', 'crossSiteExposure']);

    const mergeArray = async (storageKey: string, buffered: any[] | null, cap: number) => {
        if (!buffered || buffered.length === 0) return;
        let existing: any[] = typeof local[storageKey] === 'string'
            ? (await decryptData(key, local[storageKey])) || []
            : (local[storageKey] || []);
        existing = [...existing, ...buffered];
        if (existing.length > cap) existing = existing.slice(-cap);
        await chrome.storage.local.set({ [storageKey]: await encryptData(key, existing) });
    };

    await mergeArray('piiDetections', bufferedPii, 100);
    await mergeArray('scoreHistory', bufferedScoreHistory, 100);
    await mergeArray('detectorLogs', bufferedDetectorLogs, 1000);
    await mergeArray('notifications', bufferedNotifications, 100);

    // Flush Site Cache
    if (bufferedSiteCache && Object.keys(bufferedSiteCache).length > 0) {
        let cache = typeof local.siteCache === 'string' ? await decryptData(key, local.siteCache) || {} : local.siteCache || {};
        cache = { ...cache, ...bufferedSiteCache };
        await chrome.storage.local.set({ siteCache: await encryptData(key, cache) });
    }

    // Flush Cross-Site Exposure
    if (bufferedExposure && Object.keys(bufferedExposure).length > 0) {
        const exposure = typeof local.crossSiteExposure === 'string' ? await decryptData(key, local.crossSiteExposure) || {} : local.crossSiteExposure || {};
        for (const [fieldType, domains] of Object.entries(bufferedExposure)) {
            exposure[fieldType] = Array.from(new Set([...(exposure[fieldType] || []), ...(domains || [])]));
        }
        await chrome.storage.local.set({ crossSiteExposure: await encryptData(key, exposure) });
    }

    // Clear buffers
    await chrome.storage.local.remove(['bufferedPii', 'bufferedScoreHistory', 'bufferedSiteCache', 'bufferedDetectorLogs', 'bufferedNotifications', 'bufferedExposure']);
    console.log('[Vault] Buffered telemetry flushed to encrypted storage.');
}

// This message appears in the browser's developer console to confirm the script is running
console.log('TraceGuard Background Service Worker Running');

// Initialize the network monitor right away to start observing web requests
initNetworkMonitor();

// Honor the master on/off toggle for the network monitor as soon as settings
// are available (and whenever they change below).
storage.getSettings().then((settings) => setNetworkMonitorEnabled(settings.enabled !== false));

// =============================================================================
// EXTENSION LIFECYCLE EVENTS
// These functions run when the extension is installed or the browser opens
// =============================================================================

/**
 * This runs ONCE when you first install the extension, or when the extension is updated.
 * It sets up all the initial data the extension needs to work properly.
 */
chrome.runtime.onInstalled.addListener(async () => {
    console.log('TraceGuard Extension Installed');

    // Run data migrations before initializing anything else
    await runDataMigrations();

    // Load user settings from storage (or use defaults if this is a fresh install)
    const settings = await storage.getSettings();
    await storage.updateSettings(settings);

    // Pre-warm local databases for fast enrichment
    await configureDatabaseRefresh(settings.databaseRefreshDays);
    await chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: 24 * 60 });
    await refreshPrivacyDatabases();
    await preWarmDatabases();

    // Load the app's current state (privacy score, sites analyzed count, etc.)
    const state = await storage.getState();
    await storage.updateState(state);

    // Load the list of known dangerous websites (the "blacklist")
    await loadBlacklist();

    // Set up how the extension opens (popup window vs sidebar)
    await configureDisplayMode(settings.displayMode || 'popup');

    // Sync corrupted/missing state from cache
    await syncStateWithCache();
});

/**
 * This runs every time you open the browser (not just when the extension is installed).
 * It makes sure the extension is ready to work with fresh data.
 */
chrome.runtime.onStartup.addListener(async () => {
    // Run data migrations before initializing anything else
    await runDataMigrations();

    // Reload the blacklist in case it was updated
    await loadBlacklist();

    // Pre-warm local databases
    await preWarmDatabases();

    // Make sure the display mode matches user preferences
    const settings = await storage.getSettings();
    await configureDatabaseRefresh(settings.databaseRefreshDays);
    await chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: 24 * 60 });
    await configureDisplayMode(settings.displayMode || 'popup');

    // Sync corrupted/missing state from cache
    await syncStateWithCache();
});

// =============================================================================
// DISPLAY MODE CONFIGURATION
// Lets users choose between popup (small window) or sidebar (panel on the side)
// =============================================================================

/**
 * Configures whether clicking the extension icon opens a popup or a sidebar.
 * 
 * @param mode - Either 'popup' (small floating window) or 'sidebar' (panel on the side)
 */
async function configureDisplayMode(mode: 'popup' | 'sidebar') {
    if (mode === 'sidebar') {
        // Sidebar mode: Disable the popup and make the sidebar open when you click the icon
        await chrome.action.setPopup({ popup: '' });  // Empty string = no popup
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        console.log('Display mode: Sidebar');
    } else {
        // Popup mode: Enable the popup and disable automatic sidebar opening
        await chrome.action.setPopup({ popup: 'src/popup/index.html' });
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        console.log('Display mode: Popup');
    }
}

// =============================================================================
// STATE RECOVERY / SYNC
// =============================================================================

/**
 * Heals state and scoreHistory if previous dynamic import crashes left them at 0
 * while siteCache correctly accumulated data.
 */
async function syncStateWithCache() {
    try {
        const key = await getCryptoKey();
        if (!key) {
            console.log('[Sync] Vault locked. Skipping sync.');
            return;
        }

        const state = await storage.getState();
        const result = await chrome.storage.local.get<Record<string, any>>(['siteCache', 'scoreHistory']);
        
        let siteCacheData = result.siteCache;
        let historyData = result.scoreHistory;
        
        if (typeof siteCacheData === 'string') {
            siteCacheData = await decryptData(key, siteCacheData) || {};
        }
        if (typeof historyData === 'string') {
            historyData = await decryptData(key, historyData) || [];
        }

        // Failsafe healing for corrupted siteCache
        if (siteCacheData && typeof siteCacheData === 'object' && typeof siteCacheData[0] === 'string') {
            console.warn('[Sync] Detected corrupted siteCache. Healing...');
            siteCacheData = {};
            await chrome.storage.local.set({ siteCache: await encryptData(key, siteCacheData) });
        }

        const siteCache = (siteCacheData || {}) as Record<string, SiteRiskData>;
        const history = (historyData || []) as ScoreHistoryEntry[];
        
        const sites = Object.values(siteCache);
        let updated = false;

        // Sync sitesAnalyzed
        if (sites.length > 0 && state.sitesAnalyzed === 0) {
            console.log('[Sync] Syncing sitesAnalyzed with siteCache...');
            const totalVisits = sites.reduce((sum, site) => sum + (site.visitCount || 1), 0);
            state.sitesAnalyzed = totalVisits;
            
            await storage.updateState(state);
            updated = true;
        }
        
        // Sync scoreHistory
        if (sites.length > 0 && history.length === 0) {
            console.log('[Sync] Rebuilding scoreHistory from siteCache...');
            // Sort by last analyzed
            const sortedSites = sites.filter(s => s.lastAnalyzed).sort((a, b) => Number(a.lastAnalyzed) - Number(b.lastAnalyzed));
            
            let currentUps = 100;
            let streak = 0;
            const newHistory: ScoreHistoryEntry[] = [];
            
            // Replay the history
            for (const site of sortedSites) {
                const impact = calculateVisitImpact(currentUps, site.wss, streak, true);
                currentUps = impact.newUPS;
                streak = impact.newStreak;
                
                newHistory.push({
                    timestamp: Number(site.lastAnalyzed) || Date.now(),
                    ups: currentUps,
                    avgSiteRisk: site.wss,
                    reason: impact.message || `Visited ${site.domain}`
                });
            }
            
            // Keep last 100
            if (newHistory.length > 100) newHistory.splice(0, newHistory.length - 100);
            await chrome.storage.local.set({ scoreHistory: await encryptData(key, newHistory) });
            
            // Update final UPS
            await storage.updateState({
                ...await storage.getState(),
                ups: currentUps,
                safeVisitStreak: streak
            });
            updated = true;
        }

        if (updated) {
            console.log('[Sync] Sync complete.');
        }
    } catch (err) {
        console.error('[Sync] Error syncing state:', err);
        recordError('State sync failed', String(err));
    }
}

// =============================================================================
// CONTENT SCRIPT INJECTION (REMOVED)
// Now using static content_scripts in manifest.json for performance and compliance.
// =============================================================================

// =============================================================================
// MESSAGE HANDLING
// Receives and responds to messages from other parts of the extension
// =============================================================================

/**
 * This is the main "message center" of the extension.
 * Other parts of the extension (content scripts, popup, dashboard) send messages here,
 * and this function decides what to do with each type of message.
 * 
 * Think of it like a receptionist who directs calls to the right department.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (_sender.id !== chrome.runtime.id) {
        console.warn('[Security] Rejected message from unknown sender:', _sender.id);
        return;
    }

    // -------------------------------------------------------------------------
    // REPUTATION CHECK: Is this website known to be dangerous?

    // -------------------------------------------------------------------------
    // REPUTATION CHECK: Is this website known to be dangerous?
    // -------------------------------------------------------------------------
    if (message.type === 'CHECK_REPUTATION') {
        // Get the URL to check (supports both formats for backward compatibility)
        const url = message.url || (message.domain ? `https://${message.domain}` : undefined);

        if (!url || isLocalUrl(url)) {
            console.warn('[Reputation] No URL or domain provided, or is local URL');
            sendResponse({ isBlacklisted: false, score: 100 });  // Assume safe if no URL given
            return true;
        }

        // Check the website's reputation asynchronously
        checkReputation(url).then(reputationResult => {
            const score = typeof reputationResult === 'number' ? reputationResult : reputationResult.score;
            const checks = typeof reputationResult === 'number' ? [] : reputationResult.checks;
            // A score of 0 means the site is blacklisted (dangerous)
            const isBlacklisted = score === 0;
            sendResponse({ isBlacklisted, score, checks });
        }).catch(error => {
            // Fail CLOSED on uncertainty: match checkReputation's own error
            // contract (50 = uncertain), never report a domain as safe (100).
            console.warn('Reputation check failed:', error);
            sendResponse({ isBlacklisted: false, score: 50, checks: ['Reputation check failed — score uncertain'] });
        });

        return true;  // This tells Chrome to wait for our async response
    }

    // -------------------------------------------------------------------------
    // TOSDR CHECK: What's this website's privacy policy rating?
    // ToS;DR stands for "Terms of Service; Didn't Read" - a database of policy ratings
    // -------------------------------------------------------------------------
    if (message.type === 'CHECK_TOSDR') {
        const url = message.url;

        if (!url) {
            console.warn('[ToS;DR] No URL provided');
            sendResponse({ found: false, score: 0, source: 'fallback' });
            return true;
        }

        // Check the ToS;DR database for this website's privacy policy rating
        checkTosDR(url).then(result => {
            sendResponse(result);
        }).catch(error => {
            console.warn('[ToS;DR] Check failed:', error);
            sendResponse({ found: false, score: 0, source: 'fallback' });
        });

        return true;  // Keep the message channel open for the async response
    }

    // -------------------------------------------------------------------------
    // PAGE ANALYSIS RESULT: Process privacy analysis from a webpage
    // This is the main analysis data that comes from the content script
    // -------------------------------------------------------------------------
    if (message.type === 'PAGE_ANALYSIS_RESULT') {
        // Process the analysis in a separate function (it's complex, so we keep it organized)
        queueTelemetryWrite(() => handlePageAnalysis(message, _sender)).then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            recordError('Page analysis failed', String(error));
            sendResponse({ success: false, error: String(error) });
        });
        return true;  // Keep channel open for async response
    }

    // -------------------------------------------------------------------------
    // PII DETECTED: User entered personal information on a website
    // This helps us track potential privacy exposure
    // -------------------------------------------------------------------------
    if (message.type === 'PII_DETECTED') {
        queueTelemetryWrite(() => handlePIIDetection(message)).then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            recordError('PII detection failed', String(error));
            sendResponse({ success: false, error: String(error) });
        });
        return true;  // Keep channel open for async response
    }

    // -------------------------------------------------------------------------
    // UNLOCK VAULT: Flushes buffered telemetry to disk
    // -------------------------------------------------------------------------
    if (message.type === 'UNLOCK_VAULT') {
        storage.getSettings().then(settings => {
            if (settings.autoLockTimeout && settings.autoLockTimeout > 0) {
                chrome.alarms.create('autoLockTimer', { delayInMinutes: settings.autoLockTimeout });
            }
        });
        flushBufferedTelemetry().then(() => sendResponse({ success: true }));
        return true;
    }

    // -------------------------------------------------------------------------
    // SETTINGS CHANGED: User updated their settings in the dashboard
    // We need to apply the new settings right away
    // -------------------------------------------------------------------------
    if (message.type === 'SETTINGS_CHANGED') {
        const newSettings = message.settings;

        if (newSettings.autoLockTimeout > 0) {
            chrome.alarms.create('autoLockTimer', { delayInMinutes: newSettings.autoLockTimeout });
        } else {
            chrome.alarms.clear('autoLockTimer');
        }

        // Update the display mode and refresh schedule immediately.
        setNetworkMonitorEnabled(newSettings.enabled !== false);
        Promise.all([
            configureDisplayMode(newSettings.displayMode || 'popup'),
            configureDatabaseRefresh(newSettings.databaseRefreshDays),
        ])
            .then(() => sendResponse({ success: true }))
            .catch((error) => {
                console.error('Failed to update display mode:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// =============================================================================
// PAGE ANALYSIS HANDLER
// Processes the privacy analysis data received from web pages
// =============================================================================

/**
 * Processes the complete privacy analysis from a webpage.
 * This is one of the most important functions in the extension!
 * 
 * When you visit a website, the content script analyzes it and sends the results here.
 * This function:
 * 1. Gets the website's reputation score
 * 2. Calculates the overall Website Safety Score (WSS)
 * 3. Updates your User Privacy Score (UPS) based on whether the site was safe or risky
 * 4. Stores all the data so you can see it in the dashboard
 * 5. Creates notifications if the site is dangerous
 * 
 * @param message - The analysis data from the content script
 * @param sender - Information about where the message came from
 */
/**
 * Reduces a SiteRiskData record to the non-sensitive fields that are safe to
 * persist in the plaintext `state` (chrome.storage.local). The full analysis
 * (detectionDetails + enrichedDetails) lives only in the encrypted siteCache.
 */
function slimSiteData(site: SiteRiskData): SiteRiskData {
    return {
        domain: site.domain,
        wss: site.wss,
        breakdown: site.breakdown,
        lastAnalyzed: site.lastAnalyzed,
    };
}

const PageAnalysisSchema = z.object({
    url: z.string(),
    isInitialLoad: z.boolean().optional(),
    scores: z.record(z.string(), z.number()),
    detectionDetails: z.record(z.string(), z.any()).optional(),
    rawForEnrichment: z.object({
        cookies:        z.array(z.any()).max(500).optional(),
        trackers:       z.array(z.any()).max(500).optional(),
        fingerprinting: z.array(z.any()).max(200).optional(),
    }).optional()
}).passthrough();

async function handlePageAnalysis(message: any, sender: chrome.runtime.MessageSender) {
    const parsed = PageAnalysisSchema.safeParse(message);
    if (!parsed.success) {
        console.warn('[handlePageAnalysis] Invalid message payload:', parsed.error);
        return;
    }
    const validMessage = parsed.data;

    if (!validMessage.url || isLocalUrl(validMessage.url)) {
        console.warn('[handlePageAnalysis] URL missing or is local URL:', validMessage.url);
        return;
    }
    message = validMessage;

    // A genuine navigation (the content script's initial analysis of a
    // document load) is scoreable. Mutation-triggered re-analyses of the same
    // page (isInitialLoad === false) must not re-apply penalties or duplicate
    // history, logs, counters, or notifications.
    const isNewNavigation = message.isInitialLoad !== false;

    // Honor the master on/off toggle — ignore analysis while paused.
    const preSettings = await storage.getSettings();
    if (!preSettings.enabled) return;

    // Step 1: Check the website's reputation (is it on any blacklists?)
    const reputationResult = await checkReputation(message.url);
    const reputationScore = typeof reputationResult === 'number' ? reputationResult : reputationResult.score;
    const reputationChecks = typeof reputationResult === 'number' ? [] : reputationResult.checks;

    // Combine all the individual detector scores into one object
    const finalScores = { ...message.scores, reputation: reputationScore };

    if (!message.detectionDetails) {
        message.detectionDetails = {};
    }
    message.detectionDetails.reputation = {
        status: reputationScore === 100 ? 'Clean' : 'Suspicious',
        checks: reputationChecks
    };

    // Step 2: Calculate the Website Safety Score (WSS)
    // This combines all 6 detector scores with different weights
    const wss = calculateWSS(finalScores);

    // Extract just the domain name from the full URL
    // For example: "https://www.example.com/page" becomes "www.example.com"
    const domain = new URL(message.url).hostname;
    // Retrieve network data for this tab
    const tabId = sender.tab?.id;
    let networkData = null;
    if (tabId) {
        networkData = await getAndClearNetworkData(tabId);
    }

    // Build enriched data if raw data is provided
    let enrichedDetails: EnrichedDetectionDetails | undefined = undefined;
    if (message.rawForEnrichment) {
        const cookies = await enrichCookies(message.url, message.rawForEnrichment.cookies, networkData?.setCookies || []);
        const trackers = await enrichTrackers(message.url, message.rawForEnrichment.trackers, networkData?.requests || {});
        const headers = analyzeHeaders(networkData?.responseHeaders || []);
        
        const fpRaw = message.rawForEnrichment.fingerprinting || [];
        const fingerprintingItems: FingerprintingDetail[] = await Promise.all(fpRaw.map(async (f: any) => {
            let org = null;
            if (f.scriptUrl) {
                try {
                    const radar = await lookupTrackerDomain(new URL(f.scriptUrl).hostname);
                    org = radar?.owner || null;
                } catch (e) {
                    console.warn('[Enrichment] Fingerprint script lookup failed:', e);
                }
            }
            return {
                technique: f.technique,
                detected: true,
                scriptDomain: f.scriptUrl ? new URL(f.scriptUrl).hostname : null,
                organization: org,
                description: `Detected ${f.technique} fingerprinting attempt`,
                risk: 'medium'
            };
        }));
        
        enrichedDetails = {
            cookies: {
                items: cookies.slice(0, 100), // cap stored detail; summary keeps full totals
                summary: {
                    total: cookies.length,
                    active: cookies.filter(c => c.status === 'active').length,
                    blocked: cookies.filter(c => c.status === 'blocked').length,
                    byCategory: cookies.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {} as Record<string, number>)
                }
            },
            trackers: {
                items: trackers.slice(0, 200), // cap stored detail; summary keeps full totals
                summary: {
                    total: trackers.length,
                    active: trackers.filter(t => t.status === 'active').length,
                    blocked: trackers.filter(t => t.status === 'blocked').length,
                    byCategory: trackers.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {} as Record<string, number>)
                }
            },
            networkRequests: {
                items: (networkData ? Object.values(networkData.requests) : []).slice(0, 200), // cap stored detail
                summary: {
                    total: networkData ? Object.keys(networkData.requests).length : 0,
                    thirdParty: networkData ? Object.values(networkData.requests).filter(r => r.isThirdParty).length : 0,
                    blocked: networkData ? Object.values(networkData.requests).filter(r => r.status === 'blocked').length : 0,
                    trackerRequests: networkData ? Object.values(networkData.requests).filter(r => r.isTracker).length : 0
                }
            },
            headers: {
                items: headers,
                summary: (() => {
                    const { score, grade } = computeHeaderGrade(headers);
                    return {
                        score,
                        present: headers.filter(h => h.present).length,
                        missing: headers.filter(h => !h.present).length,
                        grade
                    };
                })()
            },
            fingerprinting: {
                items: fingerprintingItems.slice(0, 100), // cap stored detail
                summary: {
                    totalAttempts: fpRaw.length,
                    techniques: fpRaw.map((f: any) => f.technique),
                    riskLevel: fpRaw.length > 0 ? 'medium' : 'none'
                }
            },
            capturedAt: Date.now()
        };
    }

    // Step 3: Create a data object with all the site's information
    const siteData: SiteRiskData = {
        domain,                                    // The website's domain name
        wss,                                       // Website Safety Score (0-100, higher = safer)
        breakdown: finalScores,                    // Individual scores for each detector
        lastAnalyzed: Date.now(),                  // When we analyzed it (timestamp)
        detectionDetails: message.detectionDetails,// Detailed info about what was detected
        enrichedDetails                            // NEW: Rich per-item analysis
    };

    // Step 4: Save this site's data to the cache
    const key = await getCryptoKey();
    let siteCache: Record<string, SiteRiskData> = {};
    
    if (key) {
        const result = await chrome.storage.local.get<Record<string, any>>('siteCache');
        siteCache = typeof result.siteCache === 'string' 
            ? await decryptData(key, result.siteCache) || {} 
            : result.siteCache || {};
    } else {
        siteCache = (await readBuffer<Record<string, SiteRiskData>>('bufferedSiteCache')) || {};
    }

    // Keep track of how many times you've visited this site
    const existingSite = siteCache[domain];

    // Determine if this is a unique domain visit today
    const now = Date.now();
    let isUniqueDomain = false;
    if (!existingSite || !existingSite.lastVisit) {
        isUniqueDomain = true;
    } else {
        const lastVisitDate = new Date(existingSite.lastVisit).toDateString();
        const todayDate = new Date(now).toDateString();
        if (lastVisitDate !== todayDate) {
            isUniqueDomain = true;
        }
    }

    // Add visit tracking to the site data. Count one visit per genuine
    // navigation; SPA re-analyses of the same page must not inflate the count.
    const visitCount = (existingSite?.visitCount || 0) + (isNewNavigation ? 1 : 0);
    siteData.visitCount = visitCount;
    siteData.lastVisit = now;  // Current time in milliseconds

    // Save the updated site data
    siteCache[domain] = siteData;
    // LRU-style cap: retain the most recently analyzed 5000 domains.
    const cacheEntries = Object.entries(siteCache);
    if (cacheEntries.length > 5000) {
        cacheEntries.sort(([, a], [, b]) => Number(a.lastAnalyzed) - Number(b.lastAnalyzed));
        for (const [expiredDomain] of cacheEntries.slice(0, cacheEntries.length - 5000)) delete siteCache[expiredDomain];
    }
    
    if (key) {
        await chrome.storage.local.set({ siteCache: await encryptData(key, siteCache) });
    } else {
        await writeBuffer('bufferedSiteCache', siteCache);
    }

    // Step 5: Update the user's privacy state
    const state = await storage.getState();

    // Check if the tab that sent this analysis is the currently active tab
    let isActiveTab = true;
    if (sender.tab?.id) {
        try {
            const currentTab = await chrome.tabs.get(sender.tab.id);
            isActiveTab = currentTab.active;
        } catch (e) {
            // Tab might be closed
            isActiveTab = false;
        }
    }

    // Calculate how this visit affects your User Privacy Score (UPS).
    // Risky sites penalize on EVERY genuine navigation (revisiting a bad site
    // keeps lowering the score); safe sites recover only on the first visit of
    // the day (isUniqueDomain) so recovery can't be farmed by refreshing.
    // SPA re-analyses of the same page never re-score.
    const upsImpact = isNewNavigation
        ? calculateVisitImpact(state.ups || 100, wss, state.safeVisitStreak || 0, isUniqueDomain)
        : null;

    // Save the updated state
    // Count enriched trackers detected on this visit (both active and blocked)
    const newTrackersCount = enrichedDetails ? enrichedDetails.trackers.items.length : 0;
    
    // Only update currentSite if the analysis is from the active tab.
    // Persist only non-sensitive fields to plaintext state — the full analysis
    // lives (encrypted) in siteCache.
    const newCurrentSite = isActiveTab ? slimSiteData(siteData) : state.currentSite;
    
    await storage.updateState({
        ...state,
        currentSite: newCurrentSite,                                             // The site you're currently on (if active tab)
        sitesAnalyzed: state.sitesAnalyzed + (isUniqueDomain ? 1 : 0),           // Increment the counter only for unique sites today
        trackersDetected: (state.trackersDetected || 0) + (isNewNavigation ? newTrackersCount : 0), // Accumulate once per genuine navigation
        ups: upsImpact ? upsImpact.newUPS : (state.ups || 100),                  // Your updated privacy score
        safeVisitStreak: upsImpact ? upsImpact.newStreak : (state.safeVisitStreak || 0) // How many safe sites in a row
    });

    // Step 6: Log the UPS change if there was one (for debugging and history)
    const detectorLogsToWrite: Array<Omit<DetectorLogEntry, 'id' | 'timestamp'>> = [];
    if (upsImpact?.message) {
        detectorLogsToWrite.push({
            detector: 'permissions',
            domain: domain,
            score: 0,
            details: { upsChange: upsImpact.newUPS - (state.ups || 100), newStreak: upsImpact.newStreak },
            message: upsImpact.message
        });
    }

    // Append a score-history point only on a genuine navigation; SPA
    // re-analyses of the same page must not duplicate the chart.
    if (isNewNavigation && upsImpact) {
        let history: ScoreHistoryEntry[] = [];
        if (key) {
            const histResult = await chrome.storage.local.get<Record<string, any>>('scoreHistory');
            history = typeof histResult.scoreHistory === 'string'
                ? await decryptData(key, histResult.scoreHistory) || []
                : histResult.scoreHistory || [];
        } else {
            history = (await readBuffer<ScoreHistoryEntry[]>('bufferedScoreHistory')) || [];
        }
        
        history.push({
            timestamp: Date.now(),
            ups: upsImpact.newUPS,
            avgSiteRisk: wss,
            reason: upsImpact.message || `Visited ${domain}`
        });

        // Keep only the last 100 entries to save storage space
        if (history.length > 100) history.splice(0, history.length - 100);
        
        if (key) {
            await chrome.storage.local.set({ scoreHistory: await encryptData(key, history) });
        } else {
            await writeBuffer('bufferedScoreHistory', history);
        }
    }

    // Step 7: Log detailed information from each detector
    // This creates activity logs that show up in the "Activity Logs" page

    // Bug fix: message.trackingDetails was never sent by the content script.
    // The correct data lives at message.detectionDetails.tracking (count/known/suspicious).
    const trackingDetails = message.detectionDetails?.tracking
        ? {
            trackerCount: message.detectionDetails.tracking.count || 0,
            knownTrackers: Array.isArray(message.detectionDetails.tracking.known)
                ? message.detectionDetails.tracking.known
                : new Array(message.detectionDetails.tracking.known || 0).fill('unknown'),
            suspiciousTrackers: Array.isArray(message.detectionDetails.tracking.suspicious)
                ? message.detectionDetails.tracking.suspicious
                : new Array(message.detectionDetails.tracking.suspicious || 0).fill('unknown')
          }
        : { trackerCount: 0, knownTrackers: [], suspiciousTrackers: [] };
    const trackingMessage = trackingDetails.trackerCount === 0
        ? 'No third-party trackers detected'
        : `${trackingDetails.trackerCount} weighted trackers detected (${trackingDetails.knownTrackers.length} known, ${trackingDetails.suspiciousTrackers.length} suspicious)`;

    // Create human-readable messages for each detector
    const detectorMessages = {
        reputation: reputationScore === 100 ? 'Domain has good reputation' : reputationScore === 0 ? 'Domain blacklisted!' : `Domain reputation score: ${reputationScore}`,
        tracking: trackingMessage,
        cookies: finalScores.cookies >= 80 ? 'No tracking cookies detected' : `Tracking cookies detected (safety: ${finalScores.cookies})`,
        inputs: finalScores.input >= 80 ? 'No sensitive input fields' : `Sensitive input fields detected (safety: ${finalScores.input})`,
        policy: finalScores.policy >= 80 ? 'Good privacy policy' : finalScores.policy <= 25 ? 'No privacy policy found' : `Privacy policy concerns (safety: ${finalScores.policy})`
    };

    // Log each detector's findings to storage (6 logs total, one for each detector)

    // REPUTATION: Is this domain known to be dangerous?
    detectorLogsToWrite.push({
        detector: 'reputation',
        domain,
        score: reputationScore,
        details: { isBlacklisted: reputationScore === 0, status: reputationScore === 100 ? 'Clean' : reputationScore === 0 ? 'Blacklisted' : 'Suspicious' },
        message: detectorMessages.reputation
    });

    // TRACKING: How many third-party trackers are on this page?
    detectorLogsToWrite.push({
        detector: 'tracking',
        domain,
        score: finalScores.tracking,
        details: {
            trackerCount: trackingDetails.trackerCount,
            knownTrackers: trackingDetails.knownTrackers,
            suspiciousTrackers: trackingDetails.suspiciousTrackers
        },
        message: detectorMessages.tracking
    });

    // COOKIES: Are there tracking or third-party cookies?
    detectorLogsToWrite.push({
        detector: 'cookies',
        domain,
        score: finalScores.cookies,
        details: message.detectionDetails?.cookies || {},
        message: detectorMessages.cookies
    });

    // INPUTS: Are there sensitive input fields (password, credit card, etc.)?
    detectorLogsToWrite.push({
        detector: 'inputs',
        domain,
        score: finalScores.input,
        details: message.detectionDetails?.input || {},
        message: detectorMessages.inputs
    });

    // POLICY: What's the privacy policy rating (from ToS;DR)?
    detectorLogsToWrite.push({
        detector: 'policy',
        domain,
        score: finalScores.policy,
        details: message.detectionDetails?.policy || {},
        message: detectorMessages.policy
    });

    // Single batched write: avoids six read-decrypt-encrypt-write cycles of the
    // full (up to 1,000-entry) detector log array per page visit. Only write
    // once per genuine navigation so SPA re-analyses don't spam the journal.
    if (isNewNavigation && detectorLogsToWrite.length > 0) {
        await storage.addDetectorLogs(detectorLogsToWrite, key);
    }

    // Step 8: Create notifications for risky sites
    const settings = await storage.getSettings();
    const threshold = settings.wssThreshold || 50;  // User's custom safety threshold

    // Check if this site is dangerous enough to warn the user
    // WSS is a safety score: lower = more dangerous

    // Notify on each genuine navigation — SPA re-analyses must not spam alerts.
    if (isNewNavigation && wss <= 20) {
        // CRITICAL RISK: Score is 20 or below - this site is very dangerous!
        await createNotification({
            type: 'high_risk_site',
            title: 'Critical Risk Site!',
            titleKey: 'Critical Risk Site!',
            message: `${domain} has been flagged as a critical risk with a safety score of ${wss}`,
            messageKey: '{{domain}} has been flagged as a critical risk with a safety score of {{wss}}',
            params: { domain, wss },
            domain,
            severity: 'critical',
            actionUrl: `/overview?viewSite=${encodeURIComponent(domain)}`
        });
    } else if (isNewNavigation && wss < threshold) {
        // WARNING: Site falls below the user's personal safety threshold
        await createNotification({
            type: 'high_risk_site',
            title: 'High Risk Site Detected',
            titleKey: 'High Risk Site Detected',
            message: `${domain} falls below your safety threshold (Score: ${wss})`,
            messageKey: '{{domain}} falls below your safety threshold (Score: {{wss}})',
            params: { domain, wss },
            domain,
            severity: 'warning',
            actionUrl: `/overview?viewSite=${encodeURIComponent(domain)}`
        });
    }

    // Log completion for debugging purposes
    console.log('Analysis complete for:', domain, 'WSS:', wss);
    console.log('[WSS Calculation] Breakdown:', finalScores);
}

// =============================================================================
// PII DETECTION HANDLER  
// Processes personal information detection events
// =============================================================================

/**
 * Handles when the user enters personal information (PII) on a website.
 * 
 * "PII" stands for Personally Identifiable Information - things like:
 * - Your email address
 * - Your password
 * - Your phone number
 * - Your credit card number
 * 
 * This function:
 * 1. Records that you entered personal info (without storing what you typed!)
 * 2. Applies a penalty to your privacy score (more penalty on risky sites)
 * 3. Tracks which sites have seen your information
 * 4. Creates a notification to keep you informed
 * 
 * IMPORTANT: We NEVER store what you actually typed - only the TYPE of field
 * (e.g., "password field" or "email field"), not the actual values.
 * 
 * @param message - Information about the PII event from the content script
 */
async function handlePIIDetection(message: any) {
    const event = message.data;
    console.log('[TraceGuard] PII event:', event);

    // Read existing PII detections and score history first so we can dedupe
    // repeated events for the same field type on the same site.
    const key = await getCryptoKey();
    let piiDetections: any[] = [];
    let scoreHistory: any[] = [];

    if (key) {
        const storageData = await chrome.storage.local.get<Record<string, any>>(['piiDetections', 'scoreHistory']);
        piiDetections = typeof storageData.piiDetections === 'string'
            ? await decryptData(key, storageData.piiDetections) || []
            : storageData.piiDetections || [];
        scoreHistory = typeof storageData.scoreHistory === 'string'
            ? await decryptData(key, storageData.scoreHistory) || []
            : storageData.scoreHistory || [];
    } else {
        const [piiBuffer, historyBuffer] = await Promise.all([
            readBuffer<any[]>('bufferedPii'),
            readBuffer<any[]>('bufferedScoreHistory'),
        ]);
        piiDetections = piiBuffer || [];
        scoreHistory = historyBuffer || [];
    }

    // Entering the same PII type on the same site is one exposure, not many.
    // Skip duplicates (e.g. a form re-rendering mid-typing) so they can't
    // re-apply penalties or spam notifications.
    if (piiDetections.some((p: any) => p.site === event.site && p.fieldType === event.fieldType)) {
        console.log('[TraceGuard] Skipping duplicate PII event:', event.site, event.fieldType);
        return;
    }

    // Get the current app state (privacy score, etc.)
    const state = await storage.getState();

    // Increment the count of PII events (how many times you've shared personal info)
    const newPiiCount = state.piiEventsCount + 1;

    // Calculate the penalty based on:
    // - What type of info you entered (password = bigger penalty than name)
    // - How safe the current website is (risky site = bigger penalty)
    const siteWSS = state.currentSite?.wss || 50;  // Get current site's safety score (default to 50 if unknown)
    const { newUPS, penalty } = calculatePIIPenalty(state.ups || 100, event.fieldType, siteWSS);
    const scoreImpact = -penalty;  // Negative because it's a penalty

    // Record this PII detection event
    // Note: We only store metadata (field TYPE, site, timestamp) - NOT the actual value you typed!
    piiDetections.push({
        timestamp: event.timestamp,        // When it happened
        site: event.site,                  // Which website
        fieldType: event.fieldType,        // What type of field (password, email, etc.)
        sensitivity: event.sensitivity,   // How sensitive (HIGH, MEDIUM, LOW)
        siteWSS: siteWSS,                 // The site's safety score at the time
        scoreImpact: scoreImpact          // How much this affected your privacy score
    });

    // Add this event to your score history (for the dashboard graph)
    scoreHistory.push({
        timestamp: Date.now(),
        ups: newUPS,
        avgSiteRisk: state.currentSite?.wss || 0,
        reason: `PII entered on ${event.site} (${event.sensitivity} sensitivity)`
    });

    // Keep only the last 100 entries to prevent storage from growing too large
    if (piiDetections.length > 100) piiDetections.splice(0, piiDetections.length - 100);
    if (scoreHistory.length > 100) scoreHistory.splice(0, scoreHistory.length - 100);

    // Save the updated data
    if (key) {
        await chrome.storage.local.set({ 
            piiDetections: await encryptData(key, piiDetections), 
            scoreHistory: await encryptData(key, scoreHistory) 
        });
    } else {
        await Promise.all([
            writeBuffer('bufferedPii', piiDetections),
            writeBuffer('bufferedScoreHistory', scoreHistory),
        ]);
    }

    // Track which sites have received each type of your personal information
    // This enables the "Your email is known to X sites" feature in the dashboard
    await storage.addExposure(event.fieldType, event.site, key);

    // Update your privacy state with the new score
    await storage.updateState({
        ...state,
        piiEventsCount: newPiiCount,  // Total times you've shared PII
        ups: newUPS                    // Your updated privacy score
    });

    console.log(`[TraceGuard] UPS updated: ${state.ups} → ${newUPS} (PII events: ${newPiiCount})`);

    // Create a notification to alert you about the PII detection
    // Severity depends on how sensitive the information was
    const notificationSeverity = event.sensitivity === 'HIGH' ? 'critical'
        : event.sensitivity === 'MEDIUM' ? 'warning'
            : 'info';

    await createNotification({
        type: 'pii_detected',
        title: event.sensitivity === 'HIGH' ? 'Sensitive Data Detected!' : 'Personal Data Entered',
        titleKey: event.sensitivity === 'HIGH' ? 'Sensitive Data Detected!' : 'Personal Data Entered',
        message: `${event.fieldType} entered on ${event.site}${scoreImpact !== 0 ? ` (${scoreImpact} pts)` : ''}`,
        messageKey: scoreImpact !== 0 ? '{{fieldType}} entered on {{site}} ({{scoreImpact}} pts)' : '{{fieldType}} entered on {{site}}',
        params: { fieldType: event.fieldType, site: event.site, scoreImpact },
        domain: event.site,
        severity: notificationSeverity,
        actionUrl: `/overview?viewSite=${encodeURIComponent(event.site)}`
    }, key);

    // Send a toast notification to the webpage (the little popup message in the corner)
    // We only do this if the user has notifications enabled in their settings
    const settings = await storage.getSettings();
    if (settings.notifications) {
        // Send a message to the active browser tab to show a toast notification
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'SHOW_TOAST',
                    data: {
                        title: i18n.t('TraceGuard Alert'),
                        message: i18n.t('Sensitive input detected on {{site}}', { site: event.site }),
                        variant: 'warning'
                    }
                }).catch(error => {
                    // If the toast fails to show, it's not critical - just log it
                    console.warn('Failed to send toast notification:', error);
                });
            }
        });
    }
}

// Auto-lock timer listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'autoLockTimer') {
        console.log('[Lock] Auto-lock timer expired. Locking vault.');
        await chrome.storage.session.remove('cryptoKeyHex');
    } else if (alarm.name === DATABASE_REFRESH_ALARM) {
        await refreshPrivacyDatabases();
    } else if (alarm.name === CLEANUP_ALARM) {
        const key = await getCryptoKey();
        await storage.cleanupOldLogs(key);
    }
});


