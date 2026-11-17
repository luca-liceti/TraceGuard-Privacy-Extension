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
import { showPIIConfirmCard } from './pii-confirm';  // "Is this website safe?" popup
import { showToast } from './toast';                 // In-page toast notifications
import { isLocalUrl } from '../lib/utils'; // Helps identify local network addresses
import { findReadablePolicyText, POLICY_PAGE_MARKER } from '../lib/ai/policy-text';
import { captureError, installGlobalErrorHandlers, logEvent, setDevMode, setDiagnosticContext } from '../lib/diagnostics';


// =============================================================================
// MAIN ANALYSIS - Runs immediately when the page loads
// =============================================================================

/**
 * This is an "IIFE" (Immediately Invoked Function Expression)
 * It runs the page analysis as soon as this script loads.
 * The 'async' keyword lets us use 'await' for operations that take time.
 */
/**
 * The background marks a rendered policy fallback tab with this fragment.
 * Analysis is skipped there so reading a policy does not record its domain as a
 * visited site. Most policy captures now use tab-free static HTML fetching.
 */
const POLICY_CAPTURE_HASH = '#tg-policy-capture';
const isPolicyCaptureTab = window.location.hash === POLICY_CAPTURE_HASH;

// Utility: Debounce function to prevent running analysis too often
function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
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
async function runAnalysis(isInitialLoad: boolean) {
    // A capture tab exists only to be read, never to be scored or journalled.
    if (isPolicyCaptureTab) {
        return;
    }

    // Skip analysis on local addresses
    if (isLocalUrl(window.location.href)) {
        return;
    }

    try {
        // Respect the user's master on/off toggle, pause journaling when disabled.
        const { settings } = await chrome.storage.local.get<{ settings?: any }>('settings');
        // Verbose logging and the session mirror are opt-in, so the setting has
        // to be applied here too. Without it every debug event from the page half
        // of the pipeline, including each detector's observations, is dropped, and
        // nothing the content script sees can reach an exported bundle.
        setDevMode(settings?.devMode === true);

        if (settings?.enabled === false) {
            logEvent('content', 'debug', 'analysis_skipped', 'Analysis skipped: extension disabled', { host: window.location.hostname });
            return;
        }

        logEvent('content', 'debug', 'analysis_started', isInitialLoad ? 'Initial page analysis' : 'Re-analysis', {
            host: window.location.hostname,
        });

        // STEP 1: Analyze the current page for privacy issues
        const result = await analyzePage();

        // STEP 2: Start monitoring sensitive fields for PII entry (unless disabled)
        // piiDetector.startMonitoring will clear old listeners and attach new ones
        if (settings?.enablePIIDetection !== false) {
            piiDetector.startMonitoring(result.sensitiveFields, result.pageContext);
        } else {
            piiDetector.stopMonitoring();
        }

        // STEP 3: Send the analysis results to the background service worker
        await chrome.runtime.sendMessage({
            type: 'PAGE_ANALYSIS_RESULT',
            isInitialLoad,
            url: window.location.href,
            scores: result.scores,
            detectionDetails: result.detectionDetails,
            rawForEnrichment: result.rawForEnrichment
        }).catch((error) => {
            // The worker can be restarting, which makes this transient and
            // expected, so it goes to the session log as a warning rather than
            // into the durable error log.
            logEvent('content', 'warn', 'analysis_send_failed', 'Could not deliver page analysis to the background worker', {
                error: String(error),
                host: window.location.hostname,
            });
        });
    } catch (error) {
        captureError('content', error, 'page_analysis_failed', { host: window.location.hostname });
    }
}

const debouncedAnalysis = debounce(runAnalysis, 1000);

// Capture uncaught errors thrown anywhere in this content script into the
// shared diagnostics stream, so an unwritten catch cannot hide a failure.
installGlobalErrorHandlers();
setDiagnosticContext('content');

// Run initial analysis (a genuine document load)
runAnalysis(true);

// Set up MutationObserver for SPAs (React, Vue, etc.).
//
// Busy pages can emit thousands of DOM mutations a second; running a full scan
// on every batch would jank the main thread. We coalesce bursts with a pending
// flag and defer the actual (already-debounced) re-analysis to idle time, so a
// storm of mutations schedules at most one scan.
let pendingReanalysis = false;
const scheduleReanalysis = () => {
    if (pendingReanalysis) return;
    pendingReanalysis = true;
    const run = () => {
        pendingReanalysis = false;
        debouncedAnalysis(false);
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 2000 });
    } else {
        setTimeout(run, 250);
    }
};

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = node as HTMLElement;
            const tag = el.tagName?.toUpperCase();

            // Re-analyze if forms, inputs, scripts, or iframes are added
            if (tag === 'INPUT' || tag === 'FORM' || tag === 'SCRIPT' || tag === 'IFRAME') {
                scheduleReanalysis();
                return;
            }

            // Also check if any children are inputs/scripts
            if (el.querySelector && el.querySelector('input, form, script, iframe')) {
                scheduleReanalysis();
                return;
            }
        }
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Candidate policy links on this page, ranked by the background. The list is
    // returned raw and bounded; ordering rules live in lib/policy-links.ts.
    if (message?.type === 'FIND_POLICY_LINKS') {
        if (sender.id !== chrome.runtime.id) {
            sendResponse({ ok: false, reason: 'untrusted-sender' });
            return false;
        }
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
            .slice(0, 400)
            .map((anchor) => ({
                href: anchor.href,
                text: (anchor.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
            }));
        sendResponse({ ok: true, pageUrl: window.location.href, links });
        return false;
    }

    if (message?.type === 'GET_PRIVACY_POLICY_TEXT') {
        if (sender.id !== chrome.runtime.id) {
            sendResponse({ ok: false, reason: 'untrusted-sender' });
            return false;
        }
        let pageUrl: URL;
        try {
            pageUrl = new URL(window.location.href);
        } catch {
            sendResponse({ ok: false, reason: 'invalid-page-url' });
            return false;
        }
        if (pageUrl.protocol !== 'https:' && pageUrl.protocol !== 'http:') {
            sendResponse({ ok: false, reason: 'invalid-page-url' });
            return false;
        }
        // Terms and cookie pages are valid sources too: a ToS;DR document list
        // often points at the terms, and the text check below still requires
        // policy vocabulary before anything is returned.
        const policyPage = POLICY_PAGE_MARKER.test(`${pageUrl.pathname} ${document.title}`);
        if (!policyPage) {
            sendResponse({ ok: false, reason: 'not-policy-page' });
            return false;
        }
        const containers = Array.from(document.querySelectorAll<HTMLElement>('main, article, [role="main"]'))
            .map((element) => element.innerText);
        // Some policy pages use generic divs rather than semantic main/article
        // containers, so use rendered body text as a validated fallback.
        const policyText = findReadablePolicyText(containers, document.body?.innerText ?? '');
        if (!policyText) {
            sendResponse({ ok: false, reason: 'no-readable-policy-content' });
            return false;
        }
        sendResponse({
            ok: true,
            // The capture marker is an internal detail; the report cites the page.
            url: `${pageUrl.origin}${pageUrl.pathname}${pageUrl.search}`,
            title: document.title,
            text: policyText,
        });
        return false;
    }

    // Handle the "Is this website safe?" confirmation popup from the background
    if (message.type === 'SHOW_PII_CONFIRM') {
        showPIIConfirmCard(message.data);
        sendResponse({ success: true });
        return true;
    }

    // Handle toast notification requests from the background
    if (message.type === 'SHOW_TOAST') {
        const { title, message: toastMessage, variant } = message.data;
        showToast({ title, message: toastMessage, variant });
        sendResponse({ success: true });
    }

    // Return true to indicate we might send an async response
    return true;
});

