/**
 * ToS;DR API Integration
 * 
 * Terms of Service; Didn't Read (ToS;DR) is a project that rates privacy policies
 * and terms of service for various online services.
 * 
 * API Documentation: https://tosdr.org/api
 * No API key required - free and open
 */

import { rateLimiters } from '../lib/rate-limiter';

interface TosDRService {
    id: number;
    name: string;
    rating?: string; // A, B, C, D, E (A = best, E = worst)
    class?: string; // Alternative to rating
}

interface TosDRSearchResult {
    parameters?: {
        query: string;
        services?: TosDRService[];
    };
    services?: TosDRService[];
}

interface TosDRResult {
    found: boolean;
    service?: TosDRService;
    grade?: string; // A-E
    score: number; // 0-100 (0 = best, 100 = worst)
    source: 'tosdr' | 'fallback';
}

// Cache for ToS;DR results (5 minute TTL)
const tosDRCache = new Map<string, { result: TosDRResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        // Remove 'www.' prefix if present
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

/**
 * Convert ToS;DR grade to risk score
 * A = 0 (excellent), B = 20 (good), C = 40 (fair), D = 60 (poor), E = 80 (bad), None = 100 (no rating)
 */
function gradeToScore(grade: string | undefined): number {
    if (!grade) return 100; // No rating = worst score

    const gradeMap: Record<string, number> = {
        'A': 0,   // Excellent privacy policy
        'B': 20,  // Good privacy policy
        'C': 40,  // Fair privacy policy
        'D': 60,  // Poor privacy policy
        'E': 80   // Bad privacy policy
    };

    return gradeMap[grade.toUpperCase()] ?? 100;
}

/**
 * Search for a service by domain
 */
async function searchService(domain: string): Promise<TosDRService | null> {
    try {
        const searchUrl = `https://api.tosdr.org/search/v4/?query=${encodeURIComponent(domain)}`;

        console.log('[ToS;DR] Searching for service:', domain);

        const response = await fetch(searchUrl);
        if (!response.ok) {
            console.warn('[ToS;DR] Search failed:', response.status, response.statusText);
            return null;
        }

        const data: TosDRSearchResult = await response.json();

        // Try to get services from either root level or parameters
        const services = data.services || data.parameters?.services;

        if (!services || services.length === 0) {
            console.log('[ToS;DR] No services found for:', domain);
            return null;
        }

        // Return first matching service
        const service = services[0];
        console.log('[ToS;DR] Found service:', service);
        return service;
    } catch (error) {
        console.error('[ToS;DR] Search error:', error);
        return null;
    }
}

/**
 * Get service details by ID
 */
async function getServiceDetails(serviceId: number): Promise<TosDRService | null> {
    try {
        const detailsUrl = `https://api.tosdr.org/service/v2/${serviceId}`;

        console.log('[ToS;DR] Fetching service details:', serviceId);

        const response = await fetch(detailsUrl);
        if (!response.ok) {
            console.warn('[ToS;DR] Details fetch failed:', response.status, response.statusText);
            return null;
        }

        const data = await response.json();

        if (!data.parameters) {
            console.warn('[ToS;DR] Invalid response format');
            return null;
        }

        console.log('[ToS;DR] Service details:', data.parameters);
        return data.parameters as TosDRService;
    } catch (error) {
        console.error('[ToS;DR] Details fetch error:', error);
        return null;
    }
}

/**
 * Check ToS;DR rating for a domain
 * Returns risk score 0-100 (0 = best, 100 = worst)
 */
export async function checkTosDR(url: string): Promise<TosDRResult> {
    const domain = extractDomain(url);

    // Check cache first
    const cached = tosDRCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('[ToS;DR] Using cached result for:', domain);
        return cached.result;
    }

    try {
        // Use rate limiter to prevent API spam
        const result = await rateLimiters.tosdr.execute(async () => {
            // Search for service
            const service = await searchService(domain);

            if (!service) {
                return {
                    found: false,
                    score: 100, // No rating = assume worst
                    source: 'fallback' as const
                };
            }

            // Get detailed service info if we have an ID
            let detailedService = service;
            if (service.id) {
                const details = await getServiceDetails(service.id);
                if (details) {
                    detailedService = details;
                }
            }

            // Extract grade (prefer 'rating' over 'class')
            const grade = detailedService.rating || detailedService.class;
            const score = gradeToScore(grade);

            return {
                found: true,
                service: detailedService,
                grade: grade,
                score: score,
                source: 'tosdr' as const
            };
        });

        // Cache the result
        tosDRCache.set(domain, {
            result,
            timestamp: Date.now()
        });

        console.log('[ToS;DR] Result for', domain, ':', result);
        return result;

    } catch (error) {
        console.error('[ToS;DR] Check failed:', error);

        // Return fallback result
        const fallbackResult: TosDRResult = {
            found: false,
            score: 100,
            source: 'fallback'
        };

        return fallbackResult;
    }
}

/**
 * Clear ToS;DR cache
 */
export function clearTosDRCache(): void {
    tosDRCache.clear();
    console.log('[ToS;DR] Cache cleared');
}

/**
 * Get cache size
 */
export function getTosDRCacheSize(): number {
    return tosDRCache.size;
}
