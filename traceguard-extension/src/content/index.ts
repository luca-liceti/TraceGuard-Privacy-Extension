/**
 * =============================================================================
 * CONTENT SCRIPT - The Privacy Inspector on Every Web Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the "content script" - a special script that runs INSIDE every webpage
 * you visit. Unlike the background script, this code can directly interact with
 * the webpage's content (HTML, forms, cookies, etc.).
 * 
 * Think of it like an undercover inspector that examines each webpage for privacy issues.
 * 
 * KEY RESPONSIBILITIES:
 * 1. Analyze the current webpage for privacy and security risks
 * 2. Detect sensitive input fields (password, email, credit card, etc.)
 * 3. Report findings back to the background service worker
 * 4. Listen for notifications to show on the page
 * 5. Clean up when you leave the page
 * 
 * HOW IT WORKS:
 * 1. When you visit any webpage, this script automatically runs
 * 2. It imports the page analyzer and runs a complete privacy scan
 * 3. The scan checks for: HTTPS, trackers, cookies, sensitive forms, etc.
 * 4. Results are sent to the background script for scoring
 * 5. If you start typing in a sensitive field, it watches (without seeing your data)
 * 
 * PRIVACY NOTE:
 * This script detects sensitive fields but NEVER reads what you type into them.
 * It only knows "this is a password field" - not your actual password!
 * =============================================================================
 */

// Import the modules we need
import { analyzePage } from './analyzer';      // Runs all the privacy detectors
import { piiDetector } from './pii-detector';  // Monitors sensitive input fields

// Log that we've started (helpful for debugging)
console.log('TraceGuard Content Script Loaded');

// =============================================================================
// MAIN ANALYSIS - Runs immediately when the page loads
// =============================================================================

/**
 * This is an "IIFE" (Immediately Invoked Function Expression)
 * It runs the page analysis as soon as this script loads.
 * The 'async' keyword lets us use 'await' for operations that take time.
 */
(async () => {
    try {
        // STEP 1: Analyze the current page for privacy issues
        // This runs all 6 detectors: protocol, reputation, tracking, cookies, inputs, policy
        const result = await analyzePage();

        // STEP 2: Start monitoring sensitive fields for PII entry
        // This sets up listeners on password fields, email fields, etc.
        // When you start typing, it notifies the background (but doesn't read what you type!)
        piiDetector.startMonitoring(result.sensitiveFields);

        // STEP 3: Send the analysis results to the background service worker
        // The background will calculate the Website Safety Score and store the data
        await chrome.runtime.sendMessage({
            type: 'PAGE_ANALYSIS_RESULT',
            url: window.location.href,
            scores: result.scores,
            detectionDetails: result.detectionDetails
        }).catch(() => {
            // If sending fails (e.g., extension reloaded), just ignore it
            // This is not a critical error
        });
    } catch (error) {
        // If something goes wrong, log it but don't break the webpage
        console.error('TraceGuard analysis failed:', error);
    }
})();

// =============================================================================
// CLEANUP - Runs when you leave the page
// =============================================================================

/**
 * When you navigate away from this page (close tab, go to another site, etc.),
 * we need to stop monitoring the input fields to prevent memory leaks
 * and unnecessary processing.
 */
window.addEventListener('beforeunload', () => {
    // Stop watching all the input fields on this page
    piiDetector.stopMonitoring();
});

// =============================================================================
// MESSAGE LISTENER - Receives messages from the background script
// =============================================================================

/**
 * Listen for messages from the background script.
 * Currently, this is used to show toast notifications on the webpage
 * when something important happens (like PII detection on a risky site).
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle toast notification requests from the background
    if (message.type === 'SHOW_TOAST') {
        const { title, message: toastMessage, variant } = message.data;

        // NOTE: Full toast UI would require injecting a React component
        // For now, we just log to the console
        // In a future version, we could inject a shadow DOM element with a toast UI
        console.log(`[TraceGuard ${variant?.toUpperCase() || 'INFO'}] ${title}: ${toastMessage}`);

        // TODO: In a future update, inject a lightweight toast notification
        // This would create a small popup in the corner of the page

        sendResponse({ success: true });
    }

    // Return true to indicate we might send an async response
    return true;
});

