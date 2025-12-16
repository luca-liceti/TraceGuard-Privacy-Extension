interface Blacklist {
    version: string;
    updated: string;
    domains: string[];
}

let staticBlacklist: Set<string> = new Set();

/**
 * Load the static blacklist from bundled assets
 */
export async function loadBlacklist() {
    try {
        const url = chrome.runtime.getURL('assets/blacklist.json');
        const response = await fetch(url);
        const data: Blacklist = await response.json();
        staticBlacklist = new Set(data.domains);
        console.log(`Loaded ${staticBlacklist.size} domains into static blacklist.`);
    } catch (error) {
        console.error('Failed to load static blacklist:', error);
    }
}

/**
 * Check domain reputation with user whitelist/blacklist override
 * 
 * Override Rules:
 * - If whitelisted: Force WRS to 0 (Safe) - bypasses all other checks
 * - If blacklisted: Force WRS to 100 (Critical) - bypasses all other checks
 * - Otherwise: Check static blacklist, then default to safe
 * 
 * @param url - The URL to check
 * @returns Reputation score (0 = high risk, 100 = safe)
 */
export async function checkReputation(url: string): Promise<number> {
    try {
        const domain = new URL(url).hostname;

        // Get user's custom whitelist and blacklist from storage
        const result = await chrome.storage.local.get(['whitelist', 'blacklist']);
        const userWhitelist: string[] = (result.whitelist as string[]) || [];
        const userBlacklist: string[] = (result.blacklist as string[]) || [];

        // OVERRIDE RULE 1: Whitelist takes absolute priority (force safe)
        if (userWhitelist.includes(domain)) {
            console.log(`[Reputation] Domain ${domain} is WHITELISTED by user - forcing safe (100)`);
            return 100;
        }

        // OVERRIDE RULE 2: User blacklist takes second priority (force critical)
        if (userBlacklist.includes(domain)) {
            console.log(`[Reputation] Domain ${domain} is BLACKLISTED by user - forcing critical (0)`);
            return 0;
        }

        // Check static blacklist
        if (staticBlacklist.has(domain)) {
            console.log(`[Reputation] Domain ${domain} found in static blacklist - high risk (0)`);
            return 0;
        }

        // Default: safe
        return 100;
    } catch {
        return 100; // Default to safe if invalid URL
    }
}

/**
 * Synchronous version for backward compatibility
 * Note: This should be phased out in favor of the async version
 */
export function checkReputationSync(url: string): number {
    try {
        const domain = new URL(url).hostname;
        if (staticBlacklist.has(domain)) {
            return 0;
        }
        return 100;
    } catch {
        return 100;
    }
}
