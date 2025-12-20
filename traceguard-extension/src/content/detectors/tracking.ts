/**
 * =============================================================================
 * TRACKING DETECTOR - Finding Third-Party Trackers
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This detector finds third-party tracking scripts on webpages. These are
 * little pieces of code that companies use to follow you around the internet
 * and build a profile of your browsing habits.
 * 
 * WHAT IS A TRACKER?
 * Trackers are scripts loaded from external domains that collect data about you:
 * - Google Analytics: Knows which pages you visit
 * - Facebook Pixel: Tracks you across sites showing FB ads
 * - Ad networks: Build profiles to show targeted ads
 * 
 * HOW WE DETECT THEM:
 * 1. We check all external scripts, images, and iframes on the page
 * 2. We compare their domains against a list of known trackers
 * 3. We also look for suspicious keywords like "track", "pixel", "analytics"
 * 
 * SCORING MATH:
 * We use a logarithmic formula so the score decreases smoothly:
 * - Known trackers count 5x (they're definitely tracking you)
 * - Suspicious domains count 2x (might be tracking)
 * Formula: 100 - 15 × log₂(weighted_count + 1)
 * 
 * EXAMPLES:
 * - 0 trackers → Score: 100 (perfect!)
 * - 1 known tracker → Score: ~61
 * - 5 known trackers → Score: ~29
 * 
 * TRACKER DATABASE:
 * Based on research from:
 * - EFF Privacy Badger
 * - Disconnect.me
 * - Industry research on ad/analytics networks
 * =============================================================================
 */

// =============================================================================
// KNOWN TRACKER DATABASE
// A comprehensive list of domains known to track users
// =============================================================================

// Comprehensive list of known tracking domains
// Based on EFF Privacy Badger, Disconnect.me, and industry research
const KNOWN_TRACKERS = new Set([
    // Google Analytics & Ads - The most common trackers on the web
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    'googlesyndication.com',
    'doubleclick.net',
    'googleadservices.com',
    'googletag.com',
    'googletagservice.com',

    // Facebook/Meta - Tracks you across all sites with Facebook buttons or pixels
    'facebook.com',
    'facebook.net',
    'fbcdn.net',
    'connect.facebook.net',

    // Amazon - Tracks shopping behavior
    'amazon-adsystem.com',
    'assoc-amazon.com',

    // Microsoft - Analytics and ads
    'bing.com',
    'clarity.ms',

    // Adobe - Analytics suite
    'omtrdc.net',
    'demdex.net',
    '2o7.net',

    // Twitter/X - Social tracking
    'twitter.com',
    'twimg.com',
    't.co',

    // Common Analytics Services - Tools websites use to analyze visitors
    'hotjar.com',
    'mixpanel.com',
    'segment.com',
    'amplitude.com',
    'heap.io',
    'fullstory.com',
    'logrocket.com',
    'newrelic.com',
    'datadoghq.com',
    'sentry.io',

    // Ad Networks - These show and track ads
    'adnxs.com',
    'adsrvr.org',
    'advertising.com',
    'adform.net',
    'criteo.com',
    'outbrain.com',
    'taboola.com',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'indexww.com',
    'casalemedia.com',
    'contextweb.com',
    'smartadserver.com',

    // CDNs with tracking capabilities
    'cloudflare.com',
    'akamaihd.net',

    // Other tracking services
    'quantserve.com',
    'scorecardresearch.com',
    'chartbeat.com',
    'crazyegg.com',
    'mouseflow.com',
    'clicktale.com',
    'inspectlet.com',
    'luckyorange.com',
    'sessioncam.com',
    'smartlook.com',
]);

// Keywords that suggest a script might be a tracker
const TRACKING_KEYWORDS = [
    'ads', 'analytics', 'pixel', 'tracker', 'metric', 'telemetry',
    'tag', 'beacon', 'track', 'stat', 'collect', 'monitor'
];

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * The result of tracking detection.
 */
export interface TrackingDetectionResult {
    score: number;               // Safety score (0-100, higher = safer)
    trackerCount: number;        // Weighted count of trackers found
    knownTrackers: string[];     // Domains from our known tracker list
    suspiciousTrackers: string[]; // Domains with suspicious keywords
}

export function detectTracking(): number {
    const result = detectTrackingDetailed();

    // Log detailed breakdown to console
    console.log('[Tracking Detector] Starting analysis...');
    console.log('[Tracking] Found trackers:', {
        total: result.trackerCount,
        known: result.knownTrackers.length,
        suspicious: result.suspiciousTrackers.length
    });

    if (result.knownTrackers.length > 0) {
        console.log('[Tracking] Known trackers detected:', result.knownTrackers);
    }

    if (result.suspiciousTrackers.length > 0) {
        console.log('[Tracking] Suspicious third-party domains:', result.suspiciousTrackers);
    }

    console.log('[Tracking] Score calculation:', {
        trackerCount: result.trackerCount,
        score: result.score,
        formula: getScoreFormula(result.trackerCount)
    });

    return result.score;
}

export function detectTrackingDetailed(): TrackingDetectionResult {
    const scripts = document.getElementsByTagName('script');
    const iframes = document.getElementsByTagName('iframe');
    const images = document.getElementsByTagName('img');

    const knownTrackers = new Set<string>();
    const suspiciousTrackers = new Set<string>();
    const currentHost = window.location.hostname;

    const checkUrl = (urlStr: string) => {
        try {
            const url = new URL(urlStr, window.location.href);
            const hostname = url.hostname;

            // Skip same-origin
            if (hostname === currentHost || hostname === '') {
                return;
            }

            // Check against known tracker list
            if (KNOWN_TRACKERS.has(hostname)) {
                knownTrackers.add(hostname);
                return;
            }

            // Check for partial matches (e.g., subdomain.google-analytics.com)
            for (const tracker of KNOWN_TRACKERS) {
                if (hostname.includes(tracker)) {
                    knownTrackers.add(hostname);
                    return;
                }
            }

            // Check for tracking keywords in hostname or path
            const fullUrl = hostname + url.pathname;
            if (TRACKING_KEYWORDS.some(keyword => fullUrl.toLowerCase().includes(keyword))) {
                suspiciousTrackers.add(hostname);
            }
        } catch {
            // Ignore invalid URLs
        }
    };

    // Check all external resources
    for (const script of scripts) {
        if (script.src) checkUrl(script.src);
    }

    for (const iframe of iframes) {
        if (iframe.src) checkUrl(iframe.src);
    }

    for (const img of images) {
        if (img.src) checkUrl(img.src);
    }

    // Weighted count: Known trackers = 5x, Suspicious = 2x (updated weights for v3.0)
    const weightedCount = (knownTrackers.size * 5) + (suspiciousTrackers.size * 2);

    // Logarithmic score calculation (v3.0)
    // Formula: max(0, 100 - K × log2(weightedCount + 1))
    // K = 15 provides good sensitivity
    // 
    // Examples:
    // 0 trackers → 100 - 15×log2(1) = 100
    // 1 known (5 weighted) → 100 - 15×log2(6) ≈ 61
    // 2 known (10 weighted) → 100 - 15×log2(11) ≈ 48
    // 5 known (25 weighted) → 100 - 15×log2(26) ≈ 29

    const K = 15;
    const score = weightedCount === 0
        ? 100
        : Math.max(0, Math.round(100 - (K * Math.log2(weightedCount + 1))));

    return {
        score,
        trackerCount: weightedCount,
        knownTrackers: Array.from(knownTrackers),
        suspiciousTrackers: Array.from(suspiciousTrackers)
    };
}

function getScoreFormula(trackerCount: number): string {
    if (trackerCount === 0) return '0 weighted → 100 (safe)';
    const score = Math.max(0, Math.round(100 - (15 * Math.log2(trackerCount + 1))));
    return `max(0, 100 - 15×log2(${trackerCount}+1)) = ${score}`;
}

