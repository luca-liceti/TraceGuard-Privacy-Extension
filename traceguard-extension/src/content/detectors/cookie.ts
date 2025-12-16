/**
 * Cookie Detector - Third-Party Cookie Detection
 * 
 * Detects cross-site cookies that may be used for tracking.
 * Note: document.cookie only shows cookies accessible to JavaScript (no HttpOnly cookies).
 * For enhanced detection with full cookie attributes, use chrome.cookies API (planned for v1.1).
 * 
 * Returns: Risk score 0-100 (0 = many third-party cookies, 100 = no third-party cookies)
 */

interface CookieInfo {
    name: string;
    value: string;
    category: 'cross-site-tracker' | 'analytics' | 'third-party' | 'first-party';
    invasivenessWeight: number; // 3x, 2x, 1x, or 0
}

/**
 * Cookie invasiveness categories and their weights
 */
const COOKIE_CATEGORIES = {
    // Cross-site trackers (3x weight) - Most invasive
    CROSS_SITE_TRACKERS: {
        weight: 3,
        patterns: [
            'IDE',          // DoubleClick
            'test_cookie',  // DoubleClick
            'DSID',         // DoubleClick
            '__gads',       // Google Ads
            '__gac',        // Google Ads Conversion
            '_fbp',         // Facebook Pixel
            '_fbc',         // Facebook Conversion
            'fr',           // Facebook
            '__qca',        // Quantcast
            '_pinterest',   // Pinterest
            'MUID',         // Microsoft/Bing
            'ANON',         // Microsoft
            'YSC',          // YouTube
            'VISITOR_INFO', // YouTube
            'GPS',          // YouTube
            '__stripe',     // Stripe tracking
            'intercom',     // Intercom tracking
            '_mkto',        // Marketo
            'bcookie',      // LinkedIn
            'lidc',         // LinkedIn
            'UserMatchHistory', // LinkedIn
        ]
    },
    // Analytics cookies (2x weight) - Moderately invasive
    ANALYTICS: {
        weight: 2,
        patterns: [
            '_ga',          // Google Analytics
            '_gid',         // Google Analytics
            '_gat',         // Google Analytics
            '__utm',        // Google Analytics (legacy)
            'ajs_',         // Segment
            'mp_',          // Mixpanel
            '_hjid',        // Hotjar
            '_dc_gtm',      // Google Tag Manager
            'optimizelyEndUserId', // Optimizely
            '_vwo',         // VWO
            '_clck',        // Clarity
            '_clsk',        // Clarity
        ]
    },
    // Other third-party (1x weight) - Less invasive but still tracking
    OTHER_THIRD_PARTY: {
        weight: 1,
        patterns: [
            'NID',          // Google
            'PREF',         // Google
            '1P_JAR',       // Google
            'CONSENT',      // Google
            'ANID',         // Google
            'APISID',       // Google
            'HSID',         // Google
            'SAPISID',      // Google
            'SID',          // Google
            'SIDCC',        // Google
            'SSID',         // Google
        ]
    }
};

/**
 * Parse document.cookie string into individual cookies with categorization
 */
function parseCookies(): CookieInfo[] {
    const cookieString = document.cookie;
    if (!cookieString || cookieString.trim() === '') {
        return [];
    }

    const cookies: CookieInfo[] = [];

    // Split by semicolon to get individual cookies
    const cookiePairs = cookieString.split(';');

    for (const pair of cookiePairs) {
        const trimmedPair = pair.trim();
        if (!trimmedPair) continue;

        const equalIndex = trimmedPair.indexOf('=');
        if (equalIndex === -1) continue;

        const name = trimmedPair.substring(0, equalIndex).trim();
        const value = trimmedPair.substring(equalIndex + 1).trim();

        // Categorize cookie and get invasiveness weight
        const { category, weight } = categorizeCookie(name, value);

        cookies.push({
            name,
            value,
            category,
            invasivenessWeight: weight
        });
    }

    return cookies;
}

/**
 * Categorize cookie by invasiveness level
 * Returns category and weight multiplier
 */
function categorizeCookie(name: string, value: string): { category: CookieInfo['category']; weight: number } {
    const lowerName = name.toLowerCase();

    // Check cross-site trackers (most invasive)
    for (const pattern of COOKIE_CATEGORIES.CROSS_SITE_TRACKERS.patterns) {
        if (lowerName.includes(pattern.toLowerCase())) {
            return { category: 'cross-site-tracker', weight: COOKIE_CATEGORIES.CROSS_SITE_TRACKERS.weight };
        }
    }

    // Check analytics cookies (moderately invasive)
    for (const pattern of COOKIE_CATEGORIES.ANALYTICS.patterns) {
        if (lowerName.includes(pattern.toLowerCase())) {
            return { category: 'analytics', weight: COOKIE_CATEGORIES.ANALYTICS.weight };
        }
    }

    // Check other third-party cookies
    for (const pattern of COOKIE_CATEGORIES.OTHER_THIRD_PARTY.patterns) {
        if (lowerName.includes(pattern.toLowerCase())) {
            return { category: 'third-party', weight: COOKIE_CATEGORIES.OTHER_THIRD_PARTY.weight };
        }
    }

    // Additional heuristics for unknown cookies
    if (isLikelyThirdPartyCookie(name, value)) {
        return { category: 'third-party', weight: 1 };
    }

    // First-party cookie (not tracking)
    return { category: 'first-party', weight: 0 };
}

/**
 * Heuristic to detect likely third-party tracking cookies (fallback)
 * Based on common naming patterns and known tracking cookie prefixes
 */
function isLikelyThirdPartyCookie(name: string, value: string): boolean {
    const lowerName = name.toLowerCase();

    // Common third-party tracking cookie patterns
    const trackingPatterns = [
        '_ga',      // Google Analytics
        '_gid',     // Google Analytics
        '_gat',     // Google Analytics
        '__utm',    // Google Analytics (legacy)
        '_fbp',     // Facebook Pixel
        '_fbc',     // Facebook Conversion
        'fr',       // Facebook
        '__qca',    // Quantcast
        '_pinterest', // Pinterest
        'IDE',      // DoubleClick
        'test_cookie', // DoubleClick
        'DSID',     // DoubleClick
        'NID',      // Google
        'PREF',     // Google
        '1P_JAR',   // Google
        'CONSENT',  // Google
        'ANID',     // Google
        'APISID',   // Google
        'HSID',     // Google
        'SAPISID',  // Google
        'SID',      // Google
        'SIDCC',    // Google
        'SSID',     // Google
        '__stripe', // Stripe
        'optimizelyEndUserId', // Optimizely
        'ajs_',     // Segment
        'mp_',      // Mixpanel
        '_hjid',    // Hotjar
        '_dc_gtm',  // Google Tag Manager
        'intercom', // Intercom
        '_mkto',    // Marketo
    ];

    // Check if cookie name matches known tracking patterns
    for (const pattern of trackingPatterns) {
        if (lowerName.includes(pattern.toLowerCase())) {
            return true;
        }
    }

    // Additional heuristics:
    // - Very long cookie values often indicate tracking IDs
    // - Cookie names with underscores/dashes often indicate third-party
    if (value.length > 100) {
        return true;
    }

    // Check for common tracking cookie naming conventions
    if (lowerName.startsWith('_') || lowerName.startsWith('__')) {
        // Many tracking cookies start with underscores
        // But exclude common first-party session cookies
        const firstPartyPatterns = ['session', 'csrf', 'xsrf', 'auth', 'token'];
        const isFirstParty = firstPartyPatterns.some(pattern => lowerName.includes(pattern));
        if (!isFirstParty) {
            return true;
        }
    }

    return false;
}

/**
 * Main cookie detection function with weighted invasiveness scoring
 * Returns risk score: 0 (high risk) to 100 (safe)
 */
export function detectCookies(): number {
    try {
        const cookies = parseCookies();

        // Filter tracking cookies (exclude first-party)
        const trackingCookies = cookies.filter(c => c.category !== 'first-party');

        // Calculate weighted invasiveness score
        const totalWeightedScore = trackingCookies.reduce((sum, cookie) => {
            return sum + cookie.invasivenessWeight;
        }, 0);

        // Count by category for detailed logging
        const categoryCounts = {
            'cross-site-tracker': trackingCookies.filter(c => c.category === 'cross-site-tracker').length,
            'analytics': trackingCookies.filter(c => c.category === 'analytics').length,
            'third-party': trackingCookies.filter(c => c.category === 'third-party').length,
        };

        // Always log detection for debugging (even if no cookies found)
        console.log(`[Cookie Detector] Total cookies: ${cookies.length}, Tracking cookies: ${trackingCookies.length} (weighted score: ${totalWeightedScore})`, {
            'Cross-site trackers (3x)': categoryCounts['cross-site-tracker'],
            'Analytics (2x)': categoryCounts['analytics'],
            'Other third-party (1x)': categoryCounts['third-party'],
            'All cookies': cookies.map(c => `${c.name} (${c.category})`),
            'Raw document.cookie length': document.cookie.length
        });

        /**
         * Weighted score calculation:
         * - 0 weighted points = 100 (safe)
         * - 1-5 weighted points = 80 (low risk) - e.g., 2-3 analytics cookies
         * - 6-12 weighted points = 60 (medium risk) - e.g., 1 tracker + 2 analytics
         * - 13-20 weighted points = 40 (high risk) - e.g., 2 trackers + analytics
         * - >20 weighted points = 20 (very high risk) - e.g., multiple trackers
         * 
         * Examples:
         * - 2 Google Analytics cookies (_ga, _gid) = 2x2 = 4 points → 80 (low risk)
         * - 1 Facebook Pixel (_fbp) = 1x3 = 3 points → 80 (low risk)
         * - 1 Facebook + 2 Analytics = 3 + 4 = 7 points → 60 (medium risk)
         * - 2 Facebook + 2 DoubleClick = 6 + 6 = 12 points → 60 (medium risk)
         * - 3 Facebook + 3 DoubleClick + 2 Analytics = 9 + 9 + 4 = 22 points → 20 (very high risk)
         */

        if (totalWeightedScore === 0) return 100;
        if (totalWeightedScore <= 5) return 80;
        if (totalWeightedScore <= 12) return 60;
        if (totalWeightedScore <= 20) return 40;
        return 20;

    } catch (error) {
        console.error('[Cookie Detector] Error detecting cookies:', error);
        // Return neutral score on error
        return 100;
    }
}
