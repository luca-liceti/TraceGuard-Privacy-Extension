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

// Import helper modules that this file needs to work
import { storage } from '../lib/storage';  // Helps us save and load data
import { loadBlacklist, checkReputation } from './services/reputation';  // Checks if websites are dangerous
import { calculateWSS } from '../lib/scoring';  // Calculates website safety scores
import { SiteRiskData, ScoreHistoryEntry } from '../lib/types';  // Type definitions (like a template for data)
import contentScriptPath from '../content/index.ts?script';  // The script that analyzes webpages
import { checkTosDR } from './tosdr-api';  // Checks privacy policy ratings

// This message appears in the browser's developer console to confirm the script is running
console.log('TraceGuard Background Service Worker Running');

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

    // Load user settings from storage (or use defaults if this is a fresh install)
    const settings = await storage.getSettings();
    await storage.updateSettings(settings);

    // Load the app's current state (privacy score, sites analyzed count, etc.)
    const state = await storage.getState();
    await storage.updateState(state);

    // Load the list of known dangerous websites (the "blacklist")
    await loadBlacklist();

    // Set up how the extension opens (popup window vs sidebar)
    await configureDisplayMode(settings.displayMode || 'popup');
});

/**
 * This runs every time you open the browser (not just when the extension is installed).
 * It makes sure the extension is ready to work with fresh data.
 */
chrome.runtime.onStartup.addListener(async () => {
    // Reload the blacklist in case it was updated
    await loadBlacklist();

    // Make sure the display mode matches user preferences
    const settings = await storage.getSettings();
    await configureDisplayMode(settings.displayMode || 'popup');
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
// CONTENT SCRIPT INJECTION
// Automatically runs our privacy analyzer on every webpage you visit
// =============================================================================

/**
 * This listens for when a webpage finishes loading.
 * When that happens, we inject our "content script" which analyzes the page for privacy issues.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only run when the page is fully loaded ('complete') and it's a normal webpage
    // We skip chrome:// pages because we can't (and don't need to) inject scripts there
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        try {
            // Inject our content script into the webpage
            // This is like putting a privacy inspector on the page
            await chrome.scripting.executeScript({
                target: { tabId },
                files: [contentScriptPath]
            });
        } catch (err) {
            // Sometimes injection fails (e.g., on special browser pages) - that's okay
            console.error('Failed to inject content script:', err);
        }
    }
});

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

    // -------------------------------------------------------------------------
    // REPUTATION CHECK: Is this website known to be dangerous?
    // -------------------------------------------------------------------------
    if (message.type === 'CHECK_REPUTATION') {
        // Get the URL to check (supports both formats for backward compatibility)
        const url = message.url || (message.domain ? `https://${message.domain}` : undefined);

        if (!url) {
            console.warn('[Reputation] No URL or domain provided');
            sendResponse({ isBlacklisted: false, score: 100 });  // Assume safe if no URL given
            return true;
        }

        // Check the website's reputation asynchronously
        checkReputation(url).then(reputationScore => {
            // A score of 0 means the site is blacklisted (dangerous)
            const isBlacklisted = reputationScore === 0;
            sendResponse({ isBlacklisted, score: reputationScore });
        }).catch(error => {
            console.warn('Reputation check failed:', error);
            sendResponse({ isBlacklisted: false, score: 100 });  // Fail-safe: assume safe
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
        handlePageAnalysis(message).then(() => {
            sendResponse({ success: true });
        });
        return true;  // Keep channel open for async response
    }

    // -------------------------------------------------------------------------
    // PII DETECTED: User entered personal information on a website
    // This helps us track potential privacy exposure
    // -------------------------------------------------------------------------
    if (message.type === 'PII_DETECTED') {
        handlePIIDetection(message).then(() => {
            sendResponse({ success: true });
        });
        return true;  // Keep channel open for async response
    }

    // -------------------------------------------------------------------------
    // SETTINGS CHANGED: User updated their settings in the dashboard
    // We need to apply the new settings right away
    // -------------------------------------------------------------------------
    if (message.type === 'SETTINGS_CHANGED') {
        const newSettings = message.settings;

        // Update the display mode (popup vs sidebar)
        configureDisplayMode(newSettings.displayMode || 'popup')
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
 */
async function handlePageAnalysis(message: any) {
    // Step 1: Check the website's reputation (is it on any blacklists?)
    const reputationScore = await checkReputation(message.url);

    // Combine all the individual detector scores into one object
    const finalScores = { ...message.scores, reputation: reputationScore };

    // Step 2: Calculate the Website Safety Score (WSS)
    // This combines all 6 detector scores with different weights
    const wss = calculateWSS(finalScores);

    // Extract just the domain name from the full URL
    // For example: "https://www.example.com/page" becomes "www.example.com"
    const domain = new URL(message.url).hostname;

    // Step 3: Create a data object with all the site's information
    const siteData: SiteRiskData = {
        domain,                                    // The website's domain name
        wss,                                       // Website Safety Score (0-100, higher = safer)
        breakdown: finalScores,                    // Individual scores for each detector
        lastAnalyzed: Date.now(),                  // When we analyzed it (timestamp)
        detectionDetails: message.detectionDetails // Detailed info about what was detected
    };

    // Step 4: Save this site's data to the cache
    // We store data for each domain so we can show it later in the dashboard
    const result = await chrome.storage.local.get('siteCache');
    const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;

    // Keep track of how many times you've visited this site
    const existingSite = siteCache[domain];
    const visitCount = (existingSite?.visitCount || 0) + 1;

    // Add visit tracking to the site data
    siteData.visitCount = visitCount;
    siteData.lastVisit = Date.now();  // Current time in milliseconds

    // Save the updated site data
    siteCache[domain] = siteData;
    await chrome.storage.local.set({ siteCache });

    // Step 5: Update the user's privacy state
    const state = await storage.getState();

    // Calculate how this visit affects your User Privacy Score (UPS)
    // Safe sites give you a recovery bonus, risky sites apply a penalty
    const { calculateVisitImpact } = await import('../lib/pii');
    const upsImpact = calculateVisitImpact(state.ups || 100, wss, state.safeVisitStreak || 0);

    // Save the updated state
    await storage.updateState({
        ...state,
        currentSite: siteData,                          // The site you're currently on
        sitesAnalyzed: state.sitesAnalyzed + 1,        // Increment the counter
        ups: upsImpact.newUPS,                         // Your updated privacy score
        safeVisitStreak: upsImpact.newStreak           // How many safe sites in a row
    });

    // Step 6: Log the UPS change if there was one (for debugging and history)
    if (upsImpact.message) {
        await storage.addDetectorLog({
            detector: 'protocol',  // Using 'protocol' as a catch-all for system messages
            domain: domain,
            score: 0,
            details: { upsChange: upsImpact.newUPS - (state.ups || 100), newStreak: upsImpact.newStreak },
            message: upsImpact.message
        });

        // Add to the score history graph if the score changed
        if (upsImpact.newUPS !== state.ups) {
            const history = ((await chrome.storage.local.get('scoreHistory')).scoreHistory || []) as ScoreHistoryEntry[];
            history.push({
                timestamp: Date.now(),
                ups: upsImpact.newUPS,
                avgSiteRisk: wss,
                reason: upsImpact.message
            });

            // Keep only the last 100 entries to save storage space
            if (history.length > 100) history.splice(0, history.length - 100);
            await chrome.storage.local.set({ scoreHistory: history });
        }
    }

    // Step 7: Log detailed information from each detector
    // This creates activity logs that show up in the "Activity Logs" page

    // Get tracking details (or use empty defaults if not available)
    const trackingDetails = message.trackingDetails || { trackerCount: 0, knownTrackers: [], suspiciousTrackers: [] };
    const trackingMessage = trackingDetails.trackerCount === 0
        ? 'No third-party trackers detected'
        : `${trackingDetails.trackerCount} weighted trackers detected (${trackingDetails.knownTrackers.length} known, ${trackingDetails.suspiciousTrackers.length} suspicious)`;

    // Create human-readable messages for each detector
    const detectorMessages = {
        protocol: finalScores.protocol === 100 ? 'HTTPS connection (secure)' : 'HTTP connection (insecure)',
        reputation: reputationScore === 100 ? 'Domain has good reputation' : reputationScore === 0 ? 'Domain blacklisted!' : `Domain reputation score: ${reputationScore}`,
        tracking: trackingMessage,
        cookies: finalScores.cookies >= 80 ? 'No tracking cookies detected' : `Tracking cookies detected (safety: ${finalScores.cookies})`,
        inputs: finalScores.input >= 80 ? 'No sensitive input fields' : `Sensitive input fields detected (safety: ${finalScores.input})`,
        policy: finalScores.policy >= 80 ? 'Good privacy policy' : finalScores.policy <= 25 ? 'No privacy policy found' : `Privacy policy concerns (safety: ${finalScores.policy})`
    };

    // Log each detector's findings to storage (6 logs total, one for each detector)

    // PROTOCOL: Is the connection secure (HTTPS) or not (HTTP)?
    await storage.addDetectorLog({
        detector: 'protocol',
        domain,
        score: finalScores.protocol,
        details: { isHttps: finalScores.protocol === 100 },
        message: detectorMessages.protocol
    });

    // REPUTATION: Is this domain known to be dangerous?
    await storage.addDetectorLog({
        detector: 'reputation',
        domain,
        score: reputationScore,
        details: { isBlacklisted: reputationScore === 0 },
        message: detectorMessages.reputation
    });

    // TRACKING: How many third-party trackers are on this page?
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

    // COOKIES: Are there tracking or third-party cookies?
    await storage.addDetectorLog({
        detector: 'cookies',
        domain,
        score: finalScores.cookies,
        details: {},
        message: detectorMessages.cookies
    });

    // INPUTS: Are there sensitive input fields (password, credit card, etc.)?
    await storage.addDetectorLog({
        detector: 'inputs',
        domain,
        score: finalScores.input,
        details: {},
        message: detectorMessages.inputs
    });

    // POLICY: What's the privacy policy rating (from ToS;DR)?
    await storage.addDetectorLog({
        detector: 'policy',
        domain,
        score: finalScores.policy,
        details: {},
        message: detectorMessages.policy
    });

    // Step 8: Create notifications for risky sites
    const settings = await storage.getSettings();
    const threshold = settings.wssThreshold || 50;  // User's custom safety threshold

    // Check if this site is dangerous enough to warn the user
    // WSS is a safety score: lower = more dangerous
    if (wss <= 20) {
        // CRITICAL RISK: Score is 20 or below - this site is very dangerous!
        await storage.addNotification({
            type: 'high_risk_site',
            title: 'Critical Risk Site!',
            message: `${domain} has been flagged as a critical risk with a safety score of ${wss}`,
            domain,
            severity: 'critical',
            actionUrl: '/website-safety'  // Link to more details
        });
    } else if (wss < threshold) {
        // WARNING: Site falls below the user's personal safety threshold
        await storage.addNotification({
            type: 'high_risk_site',
            title: 'High Risk Site Detected',
            message: `${domain} falls below your safety threshold (Score: ${wss})`,
            domain,
            severity: 'warning',
            actionUrl: '/website-safety'
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

    // Get the current app state (privacy score, etc.)
    const state = await storage.getState();

    // Increment the count of PII events (how many times you've shared personal info)
    const newPiiCount = state.piiEventsCount + 1;

    // Calculate the penalty based on:
    // - What type of info you entered (password = bigger penalty than name)
    // - How safe the current website is (risky site = bigger penalty)
    const { calculatePIIPenalty } = await import('../lib/pii');
    const siteWSS = state.currentSite?.wss || 50;  // Get current site's safety score (default to 50 if unknown)
    const { newUPS, penalty } = calculatePIIPenalty(state.ups || 100, event.fieldType, siteWSS);
    const scoreImpact = -penalty;  // Negative because it's a penalty

    // Get existing stored data for PII detections and score history
    const storageData = await chrome.storage.local.get(['piiDetections', 'scoreHistory']);
    const piiDetections = (storageData.piiDetections || []) as any[];
    const scoreHistory = (storageData.scoreHistory || []) as any[];

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
    await chrome.storage.local.set({ piiDetections, scoreHistory });

    // Track which sites have received each type of your personal information
    // This enables the "Your email is known to X sites" feature in the dashboard
    await storage.addExposure(event.fieldType, event.site);

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

    await storage.addNotification({
        type: 'pii_detected',
        title: event.sensitivity === 'HIGH' ? 'Sensitive Data Detected!' : 'Personal Data Entered',
        message: `${event.fieldType} entered on ${event.site}${scoreImpact !== 0 ? ` (${scoreImpact} pts)` : ''}`,
        domain: event.site,
        severity: notificationSeverity,
        actionUrl: '/activity-logs'  // Where to go for more details
    });

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
                        title: 'TraceGuard Alert',
                        message: `Sensitive input detected on ${event.site}`,
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


