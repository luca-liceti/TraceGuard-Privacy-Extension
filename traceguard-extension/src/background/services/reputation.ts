/**
 * =============================================================================
 * REPUTATION SERVICE - Checking if Websites are Dangerous
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file handles checking if a website is known to be dangerous. Think of it
 * like a security guard checking names against a "do not enter" list.
 * 
 * HOW IT WORKS:
 * The reputation check happens in layers (like multiple security checkpoints):
 * 
 * Layer 1: User Whitelist - Sites you personally trust (always safe = 100)
 * Layer 2: User Blacklist - Sites you personally blocked (always dangerous = 0)
 * Layer 3: Static Blacklist - A built-in list of known bad sites (dangerous = 0)
 * Layer 4: URLhaus API - A live database of malware-hosting sites (dangerous = 0)
 * Layer 5: Default - If nothing bad found, the site is considered safe (= 100)
 * 
 * SCORING:
 * - 100 = Safe (passed all checks)
 * - 0 = Dangerous (found on a blacklist or in malware database)
 * 
 * KEY TERMS:
 * - Blacklist: A list of known dangerous websites to avoid
 * - Whitelist: A list of websites you trust (overrides other checks)
 * - URLhaus: A free online database of websites that host malware
 * - Cache: Temporary storage so we don't have to check the same site repeatedly
 * =============================================================================
 */

// =============================================================================
// TYPE DEFINITIONS
// These define the "shape" of data we work with (like a blueprint)
// =============================================================================

/**
 * Represents the structure of our blacklist file.
 * The blacklist is a list of known dangerous domains loaded from a JSON file.
 */
interface Blacklist {
    version: string;      // Version number of the blacklist (e.g., "1.0.0")
    updated: string;      // When the blacklist was last updated
    domains: string[];    // Array of dangerous domain names
}

// =============================================================================
// MODULE STATE
// Variables that persist across function calls (like the extension's memory)
// =============================================================================

// This Set stores all domains from our built-in blacklist
// A Set is like an array but automatically prevents duplicates and is faster to search
let staticBlacklist: Set<string> = new Set();

// Cache for URLhaus API results now uses chrome.storage.session
// to survive Service Worker terminations.
// How long to keep cached results (1 hour in milliseconds)
// After this time, we'll check the API again to see if anything changed
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// =============================================================================
// BLACKLIST LOADING
// Loads the list of known dangerous sites from our bundled file
// =============================================================================

/**
 * Loads the static blacklist from the extension's assets folder.
 * 
 * This function reads a JSON file that comes bundled with the extension,
 * containing a list of known dangerous domain names. This list is like
 * a "do not visit" list that we check every website against.
 * 
 * This is called when:
 * - The extension is first installed
 * - The browser starts up
 */
export async function loadBlacklist() {
    try {
        // Get the URL to our blacklist file (it's packaged with the extension)
        const url = chrome.runtime.getURL('assets/blacklist.json');

        // Fetch and parse the JSON file
        const response = await fetch(url);
        const data: Blacklist = await response.json();

        // Store domains in a Set for fast lookup
        // (Checking if something is in a Set is much faster than searching an array)
        staticBlacklist = new Set(data.domains);

        console.log(`[Reputation] Loaded ${staticBlacklist.size} domains into static blacklist`);
    } catch (error) {
        console.error('[Reputation] Failed to load static blacklist:', error);
    }
}

// =============================================================================
// URLHAUS API CHECK
// Checks a domain against a live malware database
// =============================================================================

/**
 * Checks if a domain is in the URLhaus malware database.
 * 
 * URLhaus is a free, community-driven project that tracks websites hosting malware.
 * By checking against this database, we can detect newly-discovered dangerous sites
 * that aren't in our static blacklist yet.
 * 
 * HOW IT WORKS:
 * 1. First, check if we recently looked up this domain (use cached result)
 * 2. If not cached, send a request to the URLhaus API
 * 3. The API tells us if this domain has been reported for hosting malware
 * 4. We cache the result so we don't have to ask again for an hour
 * 
 * @param domain - The domain name to check (e.g., "example.com")
 * @returns true if the domain is known to be malicious, false otherwise
 */
async function checkURLhaus(domain: string): Promise<boolean> {
    // STEP 1: Check if we have a recent cached result for this domain
    const session = await chrome.storage.session.get('urlhausCache');
    const cache = session.urlhausCache || {};
    const cached = cache[domain];
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        // Cache hit! We checked this domain recently, so use the cached result
        console.log(`[URLhaus] Cache hit for ${domain}: ${cached.isMalicious ? 'malicious' : 'clean'}`);
        return cached.isMalicious;
    }

    // STEP 2: No cache or cache expired - make an API request
    try {
        // URLhaus provides a free API to check domains
        // Documentation: https://urlhaus-api.abuse.ch/
        const response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `host=${encodeURIComponent(domain)}`  // URL-encode the domain for safety
        });

        // Check if the request succeeded
        if (!response.ok) {
            console.warn(`[URLhaus] API returned ${response.status}`);
            return false;  // If API is down, assume safe (fail-open)
        }

        // Parse the response
        const data = await response.json();

        // STEP 3: Interpret the response
        // URLhaus returns "ok" if the domain is in their database (meaning it's malicious)
        const isMalicious = data.query_status === 'ok' && data.urls && data.urls.length > 0;

        // STEP 4: Cache the result for future lookups
        cache[domain] = { isMalicious, timestamp: Date.now() };
        await chrome.storage.session.set({ urlhausCache: cache });

        // Log the result for debugging
        if (isMalicious) {
            console.log(`[URLhaus] ⚠️ MALICIOUS: ${domain} has ${data.url_count} known malware URLs`);
        } else {
            console.log(`[URLhaus] ✓ Clean: ${domain} not found in malware database`);
        }

        return isMalicious;
    } catch (error) {
        // If something goes wrong (network error, etc.), assume safe
        // This is called "fail-open" - we don't want API issues to block browsing
        console.warn(`[URLhaus] API check failed for ${domain}:`, error);
        return false;
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
