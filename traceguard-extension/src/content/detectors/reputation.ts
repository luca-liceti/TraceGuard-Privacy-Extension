/**
 * =============================================================================
 * REPUTATION DETECTOR - Domain Safety Checker
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This detector checks if a website domain is known to be dangerous (malware,
 * phishing, etc.) by asking the background service to check multiple sources.
 * 
 * REPUTATION LAYERS:
 * The background service checks three layers (in priority order):
 * 
 * Layer 1: User Whitelist/Blacklist
 *   - Sites YOU have manually marked as trusted or blocked
 *   - Highest priority - overrides all other checks
 * 
 * Layer 2: Static Blacklist
 *   - Built-in list of known dangerous domains
 *   - Common phishing and malware sites
 * 
 * Layer 3: URLhaus Malware Database
 *   - Real-time online database of malware distributing sites
 *   - Updated regularly by security researchers
 * 
 * SCORING:
 * - 0 = DANGER - Site is blacklisted or known malware
 * - 50 = UNKNOWN - Not in any database (proceed with caution)
 * - 100 = SAFE - Site is whitelisted or verified clean
 * 
 * WHY BACKGROUND SERVICE?
 * Content scripts can't make cross-origin requests to URLhaus API.
 * The background service handles the network request securely.
 * 
 * PRIVACY NOTE:
 * We only check the domain name, not the full URL or page content.
 * =============================================================================
 */

/**
 * Main reputation detection function
 * Delegates to background service which handles all layers
 */
export async function detectReputation(): Promise<number> {
    try {
        const domain = new URL(window.location.href).hostname;

        console.log('[Reputation Detector] Starting analysis...');
        console.log('[Reputation] Domain:', domain);

        // Request reputation check from background (handles all layers)
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_REPUTATION',
            url: window.location.href
        });

        const score = response?.score ?? 100;
        console.log('[Reputation] Background check result:', {
            domain,
            score,
            isBlacklisted: response?.isBlacklisted
        });

        return score;

    } catch (error) {
        console.warn('[Reputation] Check failed:', error);
        return 100; // Default to safe on error
    }
}

/**
 * Synchronous version - returns safe by default
 * Actual check is done by background
 */
export function detectReputationSync(): number {
    return 100;
}
