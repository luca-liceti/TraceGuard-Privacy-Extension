// Comprehensive list of known tracking domains
// Based on EFF Privacy Badger, Disconnect.me, and industry research
const KNOWN_TRACKERS = new Set([
    // Google Analytics & Ads
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    'googlesyndication.com',
    'doubleclick.net',
    'googleadservices.com',
    'googletag.com',
    'googletagservice.com',

    // Facebook/Meta
    'facebook.com',
    'facebook.net',
    'fbcdn.net',
    'connect.facebook.net',

    // Amazon
    'amazon-adsystem.com',
    'assoc-amazon.com',

    // Microsoft
    'bing.com',
    'clarity.ms',

    // Adobe
    'omtrdc.net',
    'demdex.net',
    '2o7.net',

    // Twitter/X
    'twitter.com',
    'twimg.com',
    't.co',

    // Common Analytics
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

    // Ad Networks
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

    // CDNs with tracking
    'cloudflare.com',
    'akamaihd.net',

    // Other trackers
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

const TRACKING_KEYWORDS = [
    'ads', 'analytics', 'pixel', 'tracker', 'metric', 'telemetry',
    'tag', 'beacon', 'track', 'stat', 'collect', 'monitor'
];

export interface TrackingDetectionResult {
    score: number;
    trackerCount: number;
    knownTrackers: string[];
    suspiciousTrackers: string[];
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

