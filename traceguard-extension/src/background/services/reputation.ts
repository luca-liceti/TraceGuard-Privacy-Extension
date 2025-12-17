interface Blacklist {
    version: string;
    updated: string;
    domains: string[];
}

let staticBlacklist: Set<string> = new Set();

// URLhaus API cache (domain -> {isMalicious: boolean, timestamp: number})
const urlhausCache: Map<string, { isMalicious: boolean; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

/**
 * Load the static blacklist from bundled assets
 */
export async function loadBlacklist() {
    try {
        const url = chrome.runtime.getURL('assets/blacklist.json');
        const response = await fetch(url);
        const data: Blacklist = await response.json();
        staticBlacklist = new Set(data.domains);
        console.log(`[Reputation] Loaded ${staticBlacklist.size} domains into static blacklist`);
    } catch (error) {
        console.error('[Reputation] Failed to load static blacklist:', error);
    }
}

/**
 * Check URLhaus API for malware-associated domains
 * Free API, no key required - https://urlhaus-api.abuse.ch/
 * 
 * @param domain - Domain to check
 * @returns true if domain is known malicious, false otherwise
 */
async function checkURLhaus(domain: string): Promise<boolean> {
    // Check cache first
    const cached = urlhausCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[URLhaus] Cache hit for ${domain}: ${cached.isMalicious ? 'malicious' : 'clean'}`);
        return cached.isMalicious;
    }

    try {
        // URLhaus host lookup API
        const response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `host=${encodeURIComponent(domain)}`
        });

        if (!response.ok) {
            console.warn(`[URLhaus] API returned ${response.status}`);
            return false;
        }

        const data = await response.json();

        // URLhaus returns query_status: "ok" if found, "no_results" if not
        const isMalicious = data.query_status === 'ok' && data.urls && data.urls.length > 0;

        // Cache the result
        urlhausCache.set(domain, { isMalicious, timestamp: Date.now() });

        if (isMalicious) {
            console.log(`[URLhaus] ⚠️ MALICIOUS: ${domain} has ${data.url_count} known malware URLs`);
        } else {
            console.log(`[URLhaus] ✓ Clean: ${domain} not found in malware database`);
        }

        return isMalicious;
    } catch (error) {
        console.warn(`[URLhaus] API check failed for ${domain}:`, error);
        return false; // Fail open - don't block on API errors
    }
}

/**
 * Check domain reputation with multi-layer system
 * 
 * Layer Priority:
 * 1. User Whitelist - Force safe (100)
 * 2. User Blacklist - Force critical (0)
 * 3. Static Blacklist - Known bad domains (0)
 * 4. URLhaus API - Malware database (0)
 * 5. Default - Safe (100)
 * 
 * @param url - The URL to check
 * @returns Reputation score (0 = high risk, 100 = safe)
 */
export async function checkReputation(url: string): Promise<number> {
    try {
        const domain = new URL(url).hostname;

        console.log(`[Reputation] Checking ${domain}...`);

        // Get user's custom whitelist and blacklist from storage
        const result = await chrome.storage.local.get('settings');
        const settings = (result.settings || {}) as { whitelist?: string[]; blacklist?: string[] };
        const userWhitelist: string[] = settings.whitelist || [];
        const userBlacklist: string[] = settings.blacklist || [];

        // LAYER 1: Whitelist takes absolute priority (force safe)
        if (userWhitelist.some(w => domain.includes(w) || w.includes(domain))) {
            console.log(`[Reputation] Layer 1: ${domain} is WHITELISTED → 100 (safe)`);
            return 100;
        }

        // LAYER 2: User blacklist (force critical)
        if (userBlacklist.some(b => domain.includes(b) || b.includes(domain))) {
            console.log(`[Reputation] Layer 2: ${domain} is USER BLACKLISTED → 0 (critical)`);
            return 0;
        }

        // LAYER 3: Static blacklist (known malicious domains)
        if (staticBlacklist.has(domain)) {
            console.log(`[Reputation] Layer 3: ${domain} in STATIC BLACKLIST → 0 (critical)`);
            return 0;
        }

        // LAYER 4: URLhaus API check (malware database)
        try {
            const isMalicious = await checkURLhaus(domain);
            if (isMalicious) {
                console.log(`[Reputation] Layer 4: ${domain} found in URLHAUS → 0 (critical)`);
                return 0;
            }
        } catch (error) {
            console.warn(`[Reputation] URLhaus check failed, continuing...`);
        }

        // LAYER 5: Default - safe
        console.log(`[Reputation] All checks passed for ${domain} → 100 (safe)`);
        return 100;

    } catch (error) {
        console.error('[Reputation] Error checking reputation:', error);
        return 100; // Default to safe if invalid URL
    }
}

/**
 * Synchronous version for backward compatibility
 * Note: This should be phased out in favor of the async version
 * Does NOT include URLhaus check (async only)
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
