/**
 * =============================================================================
 * ToS;DR API INTEGRATION - Privacy Policy Ratings
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file integrates with ToS;DR (Terms of Service; Didn't Read) - a community
 * project that reads privacy policies so you don't have to! They grade policies
 * from A (best) to E (worst), like school grades.
 * 
 * WHAT IS ToS;DR?
 * ToS;DR (tosdr.org) is a volunteer project where people read the long, boring
 * legal documents (Terms of Service, Privacy Policies) for popular websites
 * and summarize the good, bad, and ugly parts. Then they give each site a grade.
 * 
 * HOW WE USE IT:
 * 1. When you visit a website, we send the domain to ToS;DR's API
 * 2. They tell us if they have a rating for that site
 * 3. We convert their grade (A-E) to a score (100, 80, 60, 40, 20)
 * 4. That score contributes to the Website Safety Score (WSS)
 * 
 * SCORING CONVERSION:
 * - Grade A = 100 (Excellent - respects your privacy)
 * - Grade B = 80 (Good - mostly fair terms)
 * - Grade C = 60 (Fair - some concerns)
 * - Grade D = 40 (Poor - problematic terms)
 * - Grade E = 20 (Bad - serious privacy issues)
 * - No rating = 0 (Unknown - can't evaluate)
 * 
 * CACHING:
 * Results are cached for 5 minutes to avoid hammering the API.
 * The cache is stored in memory and clears when the extension reloads.
 * 
 * API INFO:
 * - URL: https://api.tosdr.org/search/v4/
 * - No API key required (free and open)
 * - Documentation: https://tosdr.org/api
 * =============================================================================
 */

interface TosDRResult {
    found: boolean;
    grade?: string; // A-E
    score: number; // 0-100 (0 = dangerous/no rating, 100 = safe/A-grade)
    source: 'tosdr' | 'fallback';
    serviceName?: string;
}

// Cache for ToS;DR results now uses chrome.storage.session
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract the main/root domain from URL
 * Examples:
 * - www.google.com -> google.com
 * - antigravity.google.com -> google.com
 * - antigravity.google -> google (new-style brand TLD)
 * - example.co.uk -> example.co.uk
 */
function extractMainDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        // Split hostname into parts
        const parts = hostname.split('.');

        // Handle new-style brand TLDs (company owns the TLD itself)
        // For domains like antigravity.google, search ToS;DR for "google"
        const brandTLDs = ['google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta', 'app', 'dev', 'page'];
        if (parts.length === 2 && brandTLDs.includes(parts[1])) {
            return parts[1]; // Return just "google" for antigravity.google
        }

        // Handle common multi-part TLDs (co.uk, com.au, etc.)
        const multiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'org.uk'];
        for (const tld of multiPartTLDs) {
            if (hostname.endsWith('.' + tld)) {
                return parts.slice(-3).join('.');
            }
        }

        // Standard case: return last 2 parts (domain + TLD)
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }

        return hostname;
    } catch {
        return url;
    }
}


/**
 * Convert ToS;DR grade to risk score (standard: 0 = dangerous, 100 = safe)
 * A = 100 (excellent), B = 80 (good), C = 60 (fair), D = 40 (poor), E = 20 (bad), None = 0 (no rating = dangerous)
 */
function gradeToScore(grade: string | undefined): number {
    if (!grade) return 0;

    const gradeMap: Record<string, number> = {
        'A': 100,
        'B': 80,
        'C': 60,
        'D': 40,
        'E': 20
    };

    return gradeMap[grade.toUpperCase()] ?? 0;
}

/**
 * Check ToS;DR rating for a domain
 * Simplified: Just use the search API which returns full service info with rating
 */
export async function checkTosDR(url: string): Promise<TosDRResult> {
    const domain = extractMainDomain(url);

    console.log(`[ToS;DR] Checking domain: ${domain} (from ${url})`);

    // Check cache first
    const session = await chrome.storage.session.get('tosDRCache');
    const cache = session.tosDRCache || {};
    const cached = cache[domain];
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[ToS;DR] Cache hit:', cached.result);
        return cached.result;
    }

    try {
        const searchUrl = `https://api.tosdr.org/search/v4/?query=${encodeURIComponent(domain)}`;
        console.log('[ToS;DR] Fetching:', searchUrl);

        const response = await fetch(searchUrl);

        if (!response.ok) {
            console.warn('[ToS;DR] API error:', response.status);
            return { found: false, score: 0, source: 'fallback' };
        }

        const data = await response.json();
        console.log('[ToS;DR] API response:', JSON.stringify(data).slice(0, 500));

        // Get services from response
        const services = data.parameters?.services || data.services;

        if (!services || services.length === 0) {
            console.log('[ToS;DR] No services found for:', domain);
            const fallback: TosDRResult = { found: false, score: 0, source: 'fallback' };
            cache[domain] = { result: fallback, timestamp: Date.now() };
            await chrome.storage.session.set({ tosDRCache: cache });
            return fallback;
        }

        // Get first service
        const service = services[0];
        console.log('[ToS;DR] Service found:', service.name, 'Rating:', service.rating);

        // Extract grade - handle rating object {hex, human, letter}
        let grade: string | undefined;
        if (service.rating) {
            if (typeof service.rating === 'object') {
                grade = service.rating.letter || service.rating.human;
            } else if (typeof service.rating === 'string') {
                grade = service.rating;
            }
        }

        const score = gradeToScore(grade);
        console.log(`[ToS;DR] Grade: ${grade} -> Score: ${score}`);

        const result: TosDRResult = {
            found: true,
            grade: grade,
            score: score,
            source: 'tosdr',
            serviceName: service.name
        };

        // Cache the result
        cache[domain] = { result, timestamp: Date.now() };
        await chrome.storage.session.set({ tosDRCache: cache });

        return result;

    } catch (error) {
        console.error('[ToS;DR] Error:', error);
        return { found: false, score: 0, source: 'fallback' };
    }
}

/**
 * Clear ToS;DR cache
 */
export async function clearTosDRCache(): Promise<void> {
    await chrome.storage.session.remove('tosDRCache');
    console.log('[ToS;DR] Cache cleared');
}
