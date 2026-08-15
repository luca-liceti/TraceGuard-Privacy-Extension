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
    serviceId?: number;
    points?: { title: string; classification: string }[];
    documents?: { name: string; url: string }[];
}

// Cache for ToS;DR results is no longer needed (100% local)

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

import { getTosDRMap } from './services/database-loader';

/**
 * Check ToS;DR rating for a domain using the bundled local database
 */
export async function checkTosDR(url: string): Promise<TosDRResult> {
    const domain = extractMainDomain(url);
    console.log(`[ToS;DR] Checking domain locally: ${domain} (from ${url})`);

    const tosdrData = await getTosDRMap();
    // Use hasOwnProperty guard to prevent prototype pollution.
    // A domain like "__proto__" or "constructor" must not reach the Object prototype chain.
    const result = Object.prototype.hasOwnProperty.call(tosdrData, domain) ? tosdrData[domain] : undefined;

    if (result) {
        console.log(`[ToS;DR] Found local rating for ${domain}: Score ${result.score}`);
        return result as TosDRResult;
    }

    console.log(`[ToS;DR] No local rating found for: ${domain}`);
    return { found: false, score: 0, source: 'fallback' };
}

/**
 * Clear ToS;DR cache (No-op now that it's local)
 */
export async function clearTosDRCache(): Promise<void> {
    console.log('[ToS;DR] Local database used, no cache to clear');
}
