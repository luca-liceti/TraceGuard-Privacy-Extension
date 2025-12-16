/**
 * Policy Detector - Privacy Policy Detection with ToS;DR API
 * 
 * Enhanced implementation using ToS;DR API for reliable privacy policy grading.
 * Falls back to local privacy policy link detection if API unavailable.
 * 
 * Returns: Risk score 0-100 (standard: 0 = dangerous, 100 = safe)
 * - 100 = Excellent/Good privacy policy (ToS;DR grade A/B)
 * - 60 = Fair privacy policy (ToS;DR grade C)
 * - 20-40 = Poor/Bad privacy policy (ToS;DR grade D/E)
 * - 0 = No privacy policy found or no ToS;DR rating
 */

/**
 * Local fallback: Detect privacy policy links on page
 */
function detectLocalPrivacyPolicy(): { found: boolean; links: string[] } {
    const links = document.getElementsByTagName('a');
    const policyLinks: string[] = [];

    for (const link of links) {
        const text = link.innerText.toLowerCase();
        const href = link.href.toLowerCase();

        const isPrivacyLink =
            (text.includes('privacy') && text.includes('policy')) ||
            (href.includes('privacy') && href.includes('policy')) ||
            href.includes('/privacy');

        if (isPrivacyLink) {
            policyLinks.push(link.href);
        }
    }

    return {
        found: policyLinks.length > 0,
        links: policyLinks
    };
}

/**
 * Main policy detection function
 * Uses ToS;DR API with fallback to local detection
 */
export async function detectPrivacyPolicy(): Promise<number> {
    console.log('[Policy Detector] Starting analysis...');
    console.log('[Policy] URL:', window.location.href);

    try {
        // Try ToS;DR API first
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_TOSDR',
            url: window.location.href
        });

        if (response && response.found && response.source === 'tosdr') {
            // ToS;DR API returned a rating
            console.log('[Policy] ToS;DR API result:', {
                service: response.service?.name,
                grade: response.grade,
                score: response.score,
                source: 'ToS;DR API'
            });
            console.log('[Policy] Score calculation:', {
                formula: `ToS;DR grade ${response.grade} → ${response.score}`,
                mapping: 'A=0, B=20, C=40, D=60, E=80',
                score: response.score
            });
            console.log('[Policy] Final Score:', response.score, '(from ToS;DR API)');
            return response.score;
        }

        // ToS;DR API didn't find service, fall back to local detection
        console.log('[Policy] ToS;DR API: No rating found, using local detection fallback');

    } catch (error) {
        console.warn('[Policy] ToS;DR API check failed, using local detection fallback:', error);
    }

    // Fallback: Local privacy policy link detection
    const localResult = detectLocalPrivacyPolicy();

    console.log('[Policy] Local detection result:', {
        found: localResult.found,
        linkCount: localResult.links.length,
        links: localResult.links.length > 0 ? localResult.links : 'none'
    });

    // Score based on local detection (standard: 0 = dangerous, 100 = safe)
    // Policy found = 100 (safe), No policy = 0 (dangerous)
    const score = localResult.found ? 100 : 0;

    console.log('[Policy] Score calculation:', {
        formula: localResult.found
            ? 'Privacy policy link found → 100 (safe)'
            : 'No privacy policy link → 0 (dangerous)',
        score: score,
        source: 'local fallback'
    });
    console.log('[Policy] Final Score:', score, '(from local detection)');

    return score;
}

/**
 * Synchronous version for backward compatibility
 * Only uses local detection (no API call)
 */
export function detectPrivacyPolicySync(): number {
    const localResult = detectLocalPrivacyPolicy();
    return localResult.found ? 100 : 0;
}
