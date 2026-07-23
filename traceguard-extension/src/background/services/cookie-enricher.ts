/**
 * =============================================================================
 * COOKIE ENRICHER — Identifies cookies and assigns metadata
 * =============================================================================
 */

import { CookieDetail } from '../../lib/types';
import { lookupCookie, lookupTrackerDomain } from './database-loader';

export async function enrichCookies(
    url: string,
    rawDomCookies: { name: string; value: string }[],
    networkSetCookies: { name: string; value: string; domain: string }[]
): Promise<CookieDetail[]> {
    const enriched: CookieDetail[] = [];
    const seenNames = new Set<string>();
    
    // 1. Get cookies directly from Chrome's cookie store (includes HttpOnly)
    let storeCookies: chrome.cookies.Cookie[] = [];
    try {
        storeCookies = await chrome.cookies.getAll({ url });
    } catch (e) {
        console.warn('Failed to get chrome.cookies:', e);
    }
    
    const pageHost = new URL(url).hostname;
    
    // Helper to process a cookie
    const processCookie = async (name: string, value: string, domain: string, httpOnly: boolean, secure: boolean, sameSite: string, expirationDate: number | null, status: 'active' | 'blocked' = 'active') => {
        if (seenNames.has(name)) return;
        seenNames.add(name);
        
        // Lookup in Cookie Database
        const dbEntry = await lookupCookie(name);
        
        // Determine first/third party
        const isThirdParty = domain !== pageHost && !domain.endsWith('.' + pageHost) && !pageHost.endsWith(domain);
        
        // Try to get organization from domain if DB doesn't have it
        let org = dbEntry?.dataController || null;
        if (!org && isThirdParty) {
            const radar = await lookupTrackerDomain(domain);
            if (radar?.owner) org = radar.owner;
        }
        
        // Determine category and invasiveness
        let category: CookieDetail['category'] = 'unclassified';
        let weight = 0;
        
        if (dbEntry) {
            category = dbEntry.category as CookieDetail['category'];
            if (category === 'marketing') weight = 3;
            else if (category === 'analytics') weight = 2;
            else if (category === 'functional') weight = 1;
        } else {
            // Heuristics
            if (isThirdParty) {
                category = 'unclassified';
                weight = 1;
                // Basic cross-site tracking heuristic
                if (name.length > 5 && value.length > 20 && !httpOnly) {
                    category = 'marketing';
                    weight = 2;
                }
            } else {
                category = 'necessary';
            }
        }
        
        enriched.push({
            name,
            domain,
            value: value.length > 50 ? value.substring(0, 50) + '...' : value,
            category,
            organization: org,
            platform: dbEntry?.platform || null,
            purpose: dbEntry?.description || null,
            retentionPeriod: dbEntry?.retentionPeriod || (expirationDate ? 'Persistent' : 'Session'),
            privacyUrl: dbEntry?.privacyUrl || null,
            httpOnly,
            secure,
            sameSite,
            expirationDate,
            isThirdParty,
            invasivenessWeight: weight,
            status
        });
    };
    
    // Process store cookies (highest priority, most accurate metadata)
    for (const c of storeCookies) {
        await processCookie(
            c.name, c.value, c.domain, c.httpOnly, c.secure, 
            c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : c.sameSite === 'strict' ? 'Strict' : 'unspecified',
            c.expirationDate || null,
            'active'
        );
    }
    
    // Process Network Set-Cookies (might catch blocked ones)
    for (const c of networkSetCookies) {
        if (!seenNames.has(c.name)) {
            // If it's in Set-Cookie but not in chrome.cookies, it might have been blocked or is session
            await processCookie(c.name, c.value, c.domain, false, false, 'unspecified', null, 'active');
        }
    }
    
    // Process DOM cookies (fallback)
    for (const c of rawDomCookies) {
        if (!seenNames.has(c.name)) {
            await processCookie(c.name, c.value, pageHost, false, false, 'unspecified', null, 'active');
        }
    }
    
    return enriched;
}
