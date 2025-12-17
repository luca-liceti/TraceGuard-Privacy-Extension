/**
 * ToS;DR API Integration
 * 
 * Terms of Service; Didn't Read (ToS;DR) is a project that rates privacy policies
 * and terms of service for various online services.
 * 
 * API Documentation: https://tosdr.org/api
 * No API key required - free and open
 */

interface TosDRResult {
    found: boolean;
    grade?: string; // A-E
    score: number; // 0-100 (0 = dangerous/no rating, 100 = safe/A-grade)
    source: 'tosdr' | 'fallback';
    serviceName?: string;
}

// Cache for ToS;DR results (5 minute TTL)
const tosDRCache = new Map<string, { result: TosDRResult; timestamp: number }>();
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
    const cached = tosDRCache.get(domain);
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
            tosDRCache.set(domain, { result: fallback, timestamp: Date.now() });
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
        tosDRCache.set(domain, { result, timestamp: Date.now() });

        return result;

    } catch (error) {
        console.error('[ToS;DR] Error:', error);
        return { found: false, score: 0, source: 'fallback' };
    }
}

/**
 * Clear ToS;DR cache
 */
export function clearTosDRCache(): void {
    tosDRCache.clear();
    console.log('[ToS;DR] Cache cleared');
}
