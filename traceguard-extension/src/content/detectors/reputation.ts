/**
 * Reputation Detector - Multi-Layer Domain Reputation System
 * 
 * Uses background service for all reputation checks:
 * - Layer 1: User whitelist/blacklist
 * - Layer 2: Static blacklist
 * - Layer 3: URLhaus malware database
 * 
 * Returns: Risk score 0-100 (0 = high risk, 100 = safe)
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
