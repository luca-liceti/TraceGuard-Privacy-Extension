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
// Utility: Debounce function to prevent running analysis too often
function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to perform analysis and notify background
async function runAnalysis() {
    try {
        // STEP 1: Analyze the current page for privacy issues
        const result = await analyzePage();

        // STEP 2: Start monitoring sensitive fields for PII entry
        // piiDetector.startMonitoring will clear old listeners and attach new ones
        piiDetector.startMonitoring(result.sensitiveFields);

        // STEP 3: Send the analysis results to the background service worker
        await chrome.runtime.sendMessage({
            type: 'PAGE_ANALYSIS_RESULT',
            url: window.location.href,
            scores: result.scores,
            detectionDetails: result.detectionDetails
        }).catch(() => {
            // If sending fails, ignore it
        });
    } catch (error) {
        console.error('TraceGuard analysis failed:', error);
    }
}

const debouncedAnalysis = debounce(runAnalysis, 1000);

// Run initial analysis
runAnalysis();

// Set up MutationObserver for SPAs (React, Vue, etc.)
const observer = new MutationObserver((mutations) => {
    let shouldReanalyze = false;

    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node as HTMLElement;
                    const tag = el.tagName?.toUpperCase();
                    
                    // Re-analyze if forms, inputs, scripts, or iframes are added
                    if (tag === 'INPUT' || tag === 'FORM' || tag === 'SCRIPT' || tag === 'IFRAME') {
                        shouldReanalyze = true;
                        break;
                    }
                    
                    // Also check if any children are inputs/scripts
                    if (el.querySelector && (el.querySelector('input, form, script, iframe'))) {
                        shouldReanalyze = true;
                        break;
                    }
                }
            }
        }
        if (shouldReanalyze) break;
    }

    if (shouldReanalyze) {
        debouncedAnalysis();
    }
});

// Start observing the document
observer.observe(document.body, { childList: true, subtree: true });

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
    observer.disconnect();
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

