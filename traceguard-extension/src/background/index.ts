import { storage } from '../lib/storage';
import { loadBlacklist, checkReputation } from './services/reputation';
import { calculateWSS } from '../lib/scoring';
import { SiteRiskData, ScoreHistoryEntry } from '../lib/types';
import contentScriptPath from '../content/index.ts?script';
import { checkTosDR } from './tosdr-api';

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
    // Handle CHECK_REPUTATION (blacklist + URLhaus check)
    if (message.type === 'CHECK_REPUTATION') {
        // Support both message.url and message.domain for backward compatibility
        const url = message.url || (message.domain ? `https://${message.domain}` : undefined);
        if (!url) {
            console.warn('[Reputation] No URL or domain provided');
            sendResponse({ isBlacklisted: false, score: 100 });
            return true;
        }
        checkReputation(url).then(reputationScore => {
            const isBlacklisted = reputationScore === 0;
            sendResponse({ isBlacklisted, score: reputationScore });
        }).catch(error => {
            console.warn('Reputation check failed:', error);
            sendResponse({ isBlacklisted: false, score: 100 });
        });
        return true;
    }

    // Note: Safe Browsing check removed - URLhaus is now used directly in reputation service

    // Handle CHECK_TOSDR (ToS;DR API check)
    if (message.type === 'CHECK_TOSDR') {
        const url = message.url;
        if (!url) {
            console.warn('[ToS;DR] No URL provided');
            sendResponse({ found: false, score: 0, source: 'fallback' });
            return true;
        }

        checkTosDR(url).then(result => {
            sendResponse(result);
        }).catch(error => {
            console.warn('[ToS;DR] Check failed:', error);
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

    // Calculate WSS (Website Safety Score)
    const wss = calculateWSS(finalScores);

    // Extract domain from URL
    const domain = new URL(message.url).hostname;

    // Create site risk data with detection details
    const siteData: SiteRiskData = {
        domain,
        wss,
        breakdown: finalScores,
        lastAnalyzed: new Date().toISOString(),
        detectionDetails: message.detectionDetails
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
    // Calculate UPS Impact using new penalty/recovery system
    const { calculateVisitImpact } = await import('../lib/pii');
    const upsImpact = calculateVisitImpact(state.ups || 100, wss, state.safeVisitStreak || 0);

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
                avgSiteRisk: wss, // Now stores safety (high = safe)
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
        cookies: finalScores.cookies >= 80 ? 'No tracking cookies detected' : `Tracking cookies detected (safety: ${finalScores.cookies})`,
        inputs: finalScores.input >= 80 ? 'No sensitive input fields' : `Sensitive input fields detected (safety: ${finalScores.input})`,
        policy: finalScores.policy >= 80 ? 'Good privacy policy' : finalScores.policy <= 25 ? 'No privacy policy found' : `Privacy policy concerns (safety: ${finalScores.policy})`
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

    console.log('Analysis complete for:', domain, 'WSS:', wss);
    console.log('[WSS Calculation] Breakdown:', finalScores);
}

// Helper function for PII detection
async function handlePIIDetection(message: any) {
    const event = message.data;
    console.log('[TraceGuard] PII event:', event);

    // Get current state
    const state = await storage.getState();

    // Increment PII events count
    const newPiiCount = state.piiEventsCount + 1;

    // Calculate new UPS using granular penalty system
    const { calculatePIIPenalty } = await import('../lib/pii');
    const siteWSS = state.currentSite?.wss || 50; // Use current site WSS or default to 50
    const { newUPS, penalty } = calculatePIIPenalty(state.ups || 100, event.fieldType, siteWSS);
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
        siteWSS: siteWSS,
        scoreImpact: scoreImpact
    });

    // Add score history entry
    scoreHistory.push({
        timestamp: Date.now(),
        ups: newUPS,
        avgSiteRisk: state.currentSite?.wss || 0,
        reason: `PII entered on ${event.site} (${event.sensitivity} sensitivity)`
    });

    // Keep only last 100 entries
    if (piiDetections.length > 100) piiDetections.splice(0, piiDetections.length - 100);
    if (scoreHistory.length > 100) scoreHistory.splice(0, scoreHistory.length - 100);

    // Save to storage
    await chrome.storage.local.set({ piiDetections, scoreHistory });

    // Track cross-site exposure (which sites have received this PII type)
    await storage.addExposure(event.fieldType, event.site);

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


