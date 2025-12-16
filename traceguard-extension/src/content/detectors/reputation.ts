/**
 * Reputation Detector - Multi-Layer Domain Reputation System
 * 
 * Layer 1: Local Blacklist (instant, offline)
 * Layer 2: Google Safe Browsing API (built into Chrome)
 * 
 * Note: PhishTank API has been removed as it requires an API key that cannot be safely bundled.
 * This may be added in a future version with a backend proxy server.
 * 
 * Returns: Risk score 0-100 (0 = high risk, 100 = safe)
 */

interface ReputationCheckResult {
    score: number;
    source: 'blacklist' | 'safe-browsing' | 'clean';
    details?: string;
}

// Cache to avoid repeated API calls (5 minute TTL)
const reputationCache = new Map<string, { result: ReputationCheckResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract domain from current URL
 */
function getCurrentDomain(): string {
    try {
        return new URL(window.location.href).hostname;
    } catch {
        return '';
    }
}

/**
 * Check if cached result is still valid
 */
function getCachedResult(domain: string): ReputationCheckResult | null {
    const cached = reputationCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }
    reputationCache.delete(domain);
    return null;
}

/**
 * Cache reputation result
 */
function cacheResult(domain: string, result: ReputationCheckResult): void {
    reputationCache.set(domain, { result, timestamp: Date.now() });
}

/**
 * Layer 1: Check local blacklist via background service
 */
async function checkBlacklist(domain: string): Promise<ReputationCheckResult | null> {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_REPUTATION',
            domain
        });

        if (response && response.isBlacklisted) {
            return {
                score: 0,
                source: 'blacklist',
                details: 'Domain found in local blacklist'
            };
        }
    } catch (error) {
        console.warn('Blacklist check failed:', error);
    }
    return null;
}

/**
 * Layer 2: Check Google Safe Browsing
 * Note: Chrome extensions can use chrome.safeBrowsing API
 */
async function checkSafeBrowsing(url: string): Promise<ReputationCheckResult | null> {
    // Check if chrome.safeBrowsing API is available (type assertion for API availability)
    const safeBrowsing = (chrome as any).safeBrowsing;
    if (!safeBrowsing) {
        console.warn('Safe Browsing API not available');
        return null;
    }

    try {
        // Request Safe Browsing check via background script
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_SAFE_BROWSING',
            url
        });

        if (response && response.threat) {
            // Map threat types to risk scores
            const threatScores: Record<string, number> = {
                'MALWARE': 0,
                'SOCIAL_ENGINEERING': 10,
                'UNWANTED_SOFTWARE': 20,
                'POTENTIALLY_HARMFUL_APPLICATION': 25
            };

            const score = threatScores[response.threat] ?? 15;
            return {
                score,
                source: 'safe-browsing',
                details: `Google Safe Browsing: ${response.threat}`
            };
        }
    } catch (error) {
        console.warn('Safe Browsing check failed:', error);
    }
    return null;
}



/**
 * Main reputation detection function
 * Returns risk score: 0 (high risk) to 100 (safe)
 */
export async function detectReputation(): Promise<number> {
    const domain = getCurrentDomain();
    if (!domain) {
        console.log('[Reputation Detector] No domain found, returning safe score');
        return 100; // Default to safe if no domain
    }

    // Comprehensive console logging
    console.log('[Reputation Detector] Starting analysis...');
    console.log('[Reputation] Domain:', domain);
    console.log('[Reputation] Full URL:', window.location.href);

    // Check cache first
    const cached = getCachedResult(domain);
    if (cached) {
        console.log('[Reputation] Using cached result:', {
            domain: domain,
            source: cached.source,
            score: cached.score,
            details: cached.details,
            cacheAge: `${Math.round((Date.now() - (reputationCache.get(domain)?.timestamp || 0)) / 1000)}s old`
        });
        console.log('[Reputation] Final Score:', cached.score, '(from cache)');
        return cached.score;
    }

    const url = window.location.href;

    console.log('[Reputation] No cache found, checking all layers...');

    // Layer 1: Local Blacklist (fastest, most severe)
    console.log('[Reputation] Layer 1: Checking local blacklist...');
    const blacklistResult = await checkBlacklist(domain);
    if (blacklistResult) {
        cacheResult(domain, blacklistResult);
        console.log('[Reputation] ⚠️ BLACKLISTED:', {
            domain: domain,
            source: 'local blacklist',
            score: blacklistResult.score,
            details: blacklistResult.details
        });
        console.log('[Reputation] Final Score:', blacklistResult.score, '(blacklisted)');
        return blacklistResult.score;
    }
    console.log('[Reputation] Layer 1: Not in blacklist ✓');

    // Layer 2: Google Safe Browsing (comprehensive threat detection)
    console.log('[Reputation] Layer 2: Checking Google Safe Browsing...');
    const safeBrowsingResult = await checkSafeBrowsing(url);
    if (safeBrowsingResult) {
        cacheResult(domain, safeBrowsingResult);
        console.log('[Reputation] ⚠️ THREAT DETECTED:', {
            domain: domain,
            source: 'Google Safe Browsing',
            score: safeBrowsingResult.score,
            details: safeBrowsingResult.details
        });
        console.log('[Reputation] Final Score:', safeBrowsingResult.score, '(Safe Browsing threat)');
        return safeBrowsingResult.score;
    }
    console.log('[Reputation] Layer 2: No threats found ✓');

    // All checks passed - domain is clean
    const cleanResult: ReputationCheckResult = {
        score: 100,
        source: 'clean',
        details: 'No threats detected'
    };
    cacheResult(domain, cleanResult);
    console.log('[Reputation] ✅ CLEAN:', {
        domain: domain,
        allLayersChecked: 'blacklist, Safe Browsing',
        score: cleanResult.score,
        details: cleanResult.details
    });
    console.log('[Reputation] Final Score:', cleanResult.score, '(all checks passed)');
    return cleanResult.score;
}

/**
 * Synchronous version that returns cached or default score
 * Use this when async is not possible
 */
export function detectReputationSync(): number {
    const domain = getCurrentDomain();
    if (!domain) return 100;

    const cached = getCachedResult(domain);
    return cached ? cached.score : 100; // Default to safe if not cached
}
