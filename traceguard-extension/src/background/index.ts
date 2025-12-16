import { storage } from '../lib/storage';
import { loadBlacklist, checkReputation } from './services/reputation';
import { calculateWRS } from '../lib/scoring';
import { SiteRiskData, ScoreHistoryEntry } from '../lib/types';
import { rateLimiters } from '../lib/rate-limiter';
import contentScriptPath from '../content/index.ts?script';

console.log('TraceGuard Background Service Worker Running');

chrome.runtime.onInstalled.addListener(async () => {
    console.log('TraceGuard Extension Installed');

    // Initialize storage with defaults
    const settings = await storage.getSettings();
    await storage.updateSettings(settings);

    const state = await storage.getState();
    await storage.updateState(state);

    await loadBlacklist();

    // Configure display mode based on settings
    await configureDisplayMode(settings.displayMode || 'popup');
});

chrome.runtime.onStartup.addListener(async () => {
    await loadBlacklist();

    // Configure display mode based on settings
    const settings = await storage.getSettings();
    await configureDisplayMode(settings.displayMode || 'popup');
});

// Helper to configure popup vs sidebar mode
async function configureDisplayMode(mode: 'popup' | 'sidebar') {
    if (mode === 'sidebar') {
        // Disable popup, enable sidepanel on click
        await chrome.action.setPopup({ popup: '' });
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        console.log('Display mode: Sidebar');
    } else {
        // Enable popup, disable sidepanel on click
        await chrome.action.setPopup({ popup: 'src/popup/index.html' });
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        console.log('Display mode: Popup');
    }
}

// Programmatic injection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: [contentScriptPath]
            });
        } catch (err) {
            console.error('Failed to inject content script:', err);
        }
    }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle CHECK_REPUTATION (local blacklist check)
    if (message.type === 'CHECK_REPUTATION') {
        const domain = message.domain;
        checkReputation(`https://${domain}`).then(reputationScore => {
            const isBlacklisted = reputationScore === 0;
            sendResponse({ isBlacklisted, score: reputationScore });
        }).catch(error => {
            console.warn('Reputation check failed:', error);
            sendResponse({ isBlacklisted: false, score: 100 });
        });
        return true; // Keep channel open for async response
    }

    // Handle CHECK_SAFE_BROWSING (Google Safe Browsing API)
    if (message.type === 'CHECK_SAFE_BROWSING') {
        const url = message.url;

        // Check if Safe Browsing API is available (type assertion for API availability)
        const safeBrowsing = (chrome as any).safeBrowsing;
        if (safeBrowsing && safeBrowsing.checkUrl) {
            // Wrap in rate limiter to prevent API quota exhaustion (20 req/min limit)
            rateLimiters.safeBrowsing.execute(async () => {
                return new Promise<any>((resolve) => {
                    safeBrowsing.checkUrl(url, (result: any) => {
                        if (chrome.runtime.lastError) {
                            console.warn('Safe Browsing check error:', chrome.runtime.lastError);
                            resolve(null);
                        } else {
                            resolve(result);
                        }
                    });
                });
            }).then(threat => {
                sendResponse({ threat });
            }).catch(error => {
                console.warn('Safe Browsing rate limit error:', error);
                sendResponse({ threat: null });
            });
            return true; // Keep channel open for async response
        } else {
            // Fallback: Safe Browsing API not available
            console.warn('Safe Browsing API not available in this Chrome version');
            sendResponse({ threat: null });
            return true;
        }
    }

    // Handle CHECK_TOSDR (ToS;DR API check)
    if (message.type === 'CHECK_TOSDR') {
        const url = message.url;

        // Import ToS;DR API dynamically to avoid circular dependencies
        import('./tosdr-api').then(({ checkTosDR }) => {
            checkTosDR(url).then(result => {
                sendResponse(result);
            }).catch(error => {
                console.warn('ToS;DR check failed:', error);
                sendResponse({ found: false, score: 0, source: 'fallback' });
            });
        }).catch(error => {
            console.error('Failed to load ToS;DR API:', error);
            sendResponse({ found: false, score: 0, source: 'fallback' });
        });

        return true; // Keep channel open for async response
    }

    // Handle PAGE_ANALYSIS_RESULT
    if (message.type === 'PAGE_ANALYSIS_RESULT') {
        handlePageAnalysis(message).then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }

    // Handle PII_DETECTED
    if (message.type === 'PII_DETECTED') {
        handlePIIDetection(message).then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }

    // Handle SETTINGS_CHANGED
    if (message.type === 'SETTINGS_CHANGED') {
        const newSettings = message.settings;
        // Update display mode
        configureDisplayMode(newSettings.displayMode || 'popup')
            .then(() => sendResponse({ success: true }))
            .catch((error) => {
                console.error('Failed to update display mode:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// Helper function for page analysis
async function handlePageAnalysis(message: any) {
    const reputationScore = await checkReputation(message.url);
    const finalScores = { ...message.scores, reputation: reputationScore };

    // Calculate WRS
    const wrs = calculateWRS(finalScores);

    // Extract domain from URL
    const domain = new URL(message.url).hostname;

    // Create site risk data
    const siteData: SiteRiskData = {
        domain,
        wrs,
        breakdown: finalScores,
        lastAnalyzed: new Date().toISOString()
    };

    // Store in cache
    const result = await chrome.storage.local.get('siteCache');
    const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;

    // Get existing site data to preserve visit count
    const existingSite = siteCache[domain];
    const visitCount = (existingSite?.visitCount || 0) + 1;

    siteData.visitCount = visitCount;
    siteData.lastVisit = Date.now();

    siteCache[domain] = siteData;
    await chrome.storage.local.set({ siteCache });

    // Update current site in state
    const state = await storage.getState();
    // Calculate UPS Impact (Streak-Based)
    const { calculateVisitImpact } = await import('../lib/pii');
    const upsImpact = calculateVisitImpact(state.ups || 100, wrs, state.safeVisitStreak || 0);

    await storage.updateState({
        ...state,
        currentSite: siteData,
        sitesAnalyzed: state.sitesAnalyzed + 1,
        ups: upsImpact.newUPS,
        safeVisitStreak: upsImpact.newStreak
    });

    // If UPS changed or streak bonus achieved, log it
    if (upsImpact.message) {
        await storage.addDetectorLog({
            detector: 'protocol', // Using protocol as a generic system channel since we lack 'system'
            domain: domain,
            score: 0,
            details: { upsChange: upsImpact.newUPS - (state.ups || 100), newStreak: upsImpact.newStreak },
            message: upsImpact.message
        });

        // Add to history if score changed
        if (upsImpact.newUPS !== state.ups) {
            const history = ((await chrome.storage.local.get('scoreHistory')).scoreHistory || []) as ScoreHistoryEntry[];
            history.push({
                timestamp: Date.now(),
                ups: upsImpact.newUPS,
                avgSiteRisk: wrs,
                reason: upsImpact.message
            });
            // Keep last 100
            if (history.length > 100) history.splice(0, history.length - 100);
            await chrome.storage.local.set({ scoreHistory: history });
        }
    }

    // Store detector logs for all 6 detectors
    const trackingDetails = message.trackingDetails || { trackerCount: 0, knownTrackers: [], suspiciousTrackers: [] };
    const trackingMessage = trackingDetails.trackerCount === 0
        ? 'No third-party trackers detected'
        : `${trackingDetails.trackerCount} weighted trackers detected (${trackingDetails.knownTrackers.length} known, ${trackingDetails.suspiciousTrackers.length} suspicious)`;

    const detectorMessages = {
        protocol: finalScores.protocol === 100 ? 'HTTPS connection (secure)' : 'HTTP connection (insecure)',
        reputation: reputationScore === 100 ? 'Domain has good reputation' : reputationScore === 0 ? 'Domain blacklisted!' : `Domain reputation score: ${reputationScore}`,
        tracking: trackingMessage,
        cookies: finalScores.cookies === 0 ? 'No third-party cookies detected' : `Third-party cookies detected (score: ${finalScores.cookies})`,
        inputs: finalScores.input === 0 ? 'No sensitive input fields detected' : `Sensitive input fields detected (score: ${finalScores.input})`,
        policy: finalScores.policy === 0 ? 'Good privacy policy' : finalScores.policy === 100 ? 'No privacy policy found' : `Privacy policy concerns (score: ${finalScores.policy})`
    };

    // Log each detector's findings
    await storage.addDetectorLog({
        detector: 'protocol',
        domain,
        score: finalScores.protocol,
        details: { isHttps: finalScores.protocol === 100 },
        message: detectorMessages.protocol
    });

    await storage.addDetectorLog({
        detector: 'reputation',
        domain,
        score: reputationScore,
        details: { isBlacklisted: reputationScore === 0 },
        message: detectorMessages.reputation
    });

    await storage.addDetectorLog({
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

    await storage.addDetectorLog({
        detector: 'cookies',
        domain,
        score: finalScores.cookies,
        details: {},
        message: detectorMessages.cookies
    });

    await storage.addDetectorLog({
        detector: 'inputs',
        domain,
        score: finalScores.input,
        details: {},
        message: detectorMessages.inputs
    });

    await storage.addDetectorLog({
        detector: 'policy',
        domain,
        score: finalScores.policy,
        details: {},
        message: detectorMessages.policy
    });

    console.log('Analysis complete for:', domain, 'WRS:', wrs);
    console.log('[WRS Calculation] Breakdown:', finalScores);
}

// Helper function for PII detection
async function handlePIIDetection(message: any) {
    const event = message.data;
    console.log('[TraceGuard] PII event:', event);

    // Get current state
    const state = await storage.getState();

    // Increment PII events count
    const newPiiCount = state.piiEventsCount + 1;

    // Calculate new UPS (Cumulative formatting)
    const { calculatePIIPenalty } = await import('../lib/pii');
    const { newUPS, penalty } = calculatePIIPenalty(state.ups || 100);
    const scoreImpact = -penalty;

    // Store PII detection event
    const storageData = await chrome.storage.local.get(['piiDetections', 'scoreHistory']);
    const piiDetections = (storageData.piiDetections || []) as any[];
    const scoreHistory = (storageData.scoreHistory || []) as any[];

    // Add PII detection event
    piiDetections.push({
        timestamp: event.timestamp,
        site: event.site,
        fieldType: event.fieldType,
        sensitivity: event.sensitivity,
        siteWRS: event.siteWRS,
        scoreImpact: scoreImpact
    });

    // Add score history entry
    scoreHistory.push({
        timestamp: Date.now(),
        ups: newUPS,
        avgSiteRisk: state.currentSite?.wrs || 0,
        reason: `PII entered on ${event.site} (${event.sensitivity} sensitivity)`
    });

    // Keep only last 100 entries
    if (piiDetections.length > 100) piiDetections.splice(0, piiDetections.length - 100);
    if (scoreHistory.length > 100) scoreHistory.splice(0, scoreHistory.length - 100);

    // Save to storage
    await chrome.storage.local.set({ piiDetections, scoreHistory });

    // Update state
    await storage.updateState({
        ...state,
        piiEventsCount: newPiiCount,
        ups: newUPS
    });

    console.log(`[TraceGuard] UPS updated: ${state.ups} → ${newUPS} (PII events: ${newPiiCount})`);

    // Send toast notification to content script (NO OS notifications per architecture rules)
    const settings = await storage.getSettings();
    if (settings.notifications) {
        // Send message to active tab to show Sonner toast
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'SHOW_TOAST',
                    data: {
                        title: 'TraceGuard Alert',
                        message: `Sensitive input detected on ${event.site}`,
                        variant: 'warning'
                    }
                }).catch(error => {
                    console.warn('Failed to send toast notification:', error);
                });
            }
        });
    }
}


