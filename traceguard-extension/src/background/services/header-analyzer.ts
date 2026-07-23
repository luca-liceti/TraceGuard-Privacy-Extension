/**
 * =============================================================================
 * HEADER ANALYZER — Analyzes HTTP security and privacy headers
 * =============================================================================
 */

import { HeaderAnalysisDetail } from '../../lib/types';

export function analyzeHeaders(headers: { name: string; value: string }[]): HeaderAnalysisDetail[] {
    const results: HeaderAnalysisDetail[] = [];
    
    // Helper to find a header value
    const getHeader = (name: string) => headers.find(h => h.name === name)?.value || null;
    
    // 1. Content-Security-Policy (CSP)
    const csp = getHeader('content-security-policy');
    results.push({
        header: 'Content-Security-Policy',
        value: csp,
        present: !!csp,
        rating: csp ? 'good' : 'missing',
        explanation: 'Restricts where scripts, images, and other resources can be loaded from, preventing Cross-Site Scripting (XSS).',
        recommendation: csp ? null : 'Implement a strict CSP.'
    });
    
    // 2. Strict-Transport-Security (HSTS)
    const hsts = getHeader('strict-transport-security');
    let hstsRating: 'good'|'fair'|'poor'|'missing' = 'missing';
    if (hsts) {
        hstsRating = hsts.includes('max-age=') && parseInt(hsts.split('max-age=')[1]) > 86400 ? 'good' : 'fair';
    }
    results.push({
        header: 'Strict-Transport-Security',
        value: hsts,
        present: !!hsts,
        rating: hstsRating,
        explanation: 'Ensures the browser only connects via secure HTTPS.',
        recommendation: hstsRating === 'good' ? null : 'Implement HSTS with a long max-age and includeSubDomains.'
    });
    
    // 3. X-Content-Type-Options
    const xcto = getHeader('x-content-type-options');
    results.push({
        header: 'X-Content-Type-Options',
        value: xcto,
        present: !!xcto,
        rating: xcto === 'nosniff' ? 'good' : 'missing',
        explanation: 'Prevents the browser from MIME-sniffing a response away from the declared content-type.',
        recommendation: xcto === 'nosniff' ? null : 'Set to "nosniff".'
    });
    
    // 4. X-Frame-Options
    const xfo = getHeader('x-frame-options');
    results.push({
        header: 'X-Frame-Options',
        value: xfo,
        present: !!xfo,
        rating: xfo ? 'good' : 'missing',
        explanation: 'Prevents the site from being framed, protecting against clickjacking.',
        recommendation: xfo ? null : 'Use X-Frame-Options or CSP frame-ancestors.'
    });
    
    // 5. Referrer-Policy
    const rp = getHeader('referrer-policy');
    let rpRating: 'good'|'fair'|'poor'|'missing' = 'missing';
    if (rp) {
        const strictPolicies = ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'];
        rpRating = strictPolicies.includes(rp.toLowerCase()) ? 'good' : 'fair';
    }
    results.push({
        header: 'Referrer-Policy',
        value: rp,
        present: !!rp,
        rating: rpRating,
        explanation: 'Controls how much referrer information (the URL you came from) is sent with requests.',
        recommendation: rpRating === 'good' ? null : 'Set to "strict-origin-when-cross-origin" or stricter.'
    });
    
    // 6. Permissions-Policy (formerly Feature-Policy)
    const pp = getHeader('permissions-policy') || getHeader('feature-policy');
    results.push({
        header: 'Permissions-Policy',
        value: pp,
        present: !!pp,
        rating: pp ? 'good' : 'missing',
        explanation: 'Controls which browser features and APIs (camera, microphone, geolocation) can be used.',
        recommendation: pp ? null : 'Implement to restrict access to sensitive APIs.'
    });
    
    return results;
}
