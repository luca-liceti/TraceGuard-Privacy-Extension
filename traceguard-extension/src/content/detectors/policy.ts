/**
 * Policy Detector - Privacy Policy Detection with ToS;DR API
 * 
 * SCORING: Higher = Better (100 = safe, 0 = dangerous)
 * - A = 100 (excellent privacy policy)
 * - B = 80 (good)
 * - C = 60 (fair)
 * - D = 40 (poor)
 * - E = 20 (bad)
 * - Not found = 50 (neutral, unknown)
 */

export interface PolicyDetectionResult {
    score: number;
    source: 'tosdr' | 'local' | 'fallback';
    grade?: string;
    serviceName?: string;
    hasLocalPolicy: boolean;
}

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

    // Also check local policy presence
    const localResult = detectLocalPrivacyPolicy();

    try {
        // Try ToS;DR API first
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_TOSDR',
            url: window.location.href
        });

        console.log('[Policy] ToS;DR response:', response);

        // Check if we got a valid ToS;DR response with a grade
        if (response && response.found && response.grade) {
            console.log('[Policy] ToS;DR API result:', {
                service: response.service?.name,
                grade: response.grade,
                score: response.score,
                source: 'tosdr'
            });

            // Use the score from ToS;DR (already mapped: A=100, B=80, C=60, D=40, E=20)
            console.log(`[Policy] Grade ${response.grade} → Score ${response.score}`);
            return response.score;
        }

        // ToS;DR didn't find a rating
        console.log('[Policy] ToS;DR: No rating found for this domain');

    } catch (error) {
        console.warn('[Policy] ToS;DR API check failed:', error);
    }

    // Fallback: Use local detection with neutral score
    // If we find a privacy policy link, give neutral score (50)
    // If no link found, give low score (25)
    const fallbackScore = localResult.found ? 50 : 25;

    console.log('[Policy] Fallback score:', {
        hasLocalPolicy: localResult.found,
        linkCount: localResult.links.length,
        score: fallbackScore,
        reason: localResult.found
            ? 'Privacy link found but no ToS;DR rating → neutral (50)'
            : 'No privacy link and no ToS;DR rating → low (25)'
    });

    return fallbackScore;
}

/**
 * Enhanced detection that returns full details for the UI
 */
export async function detectPrivacyPolicyDetailed(): Promise<PolicyDetectionResult> {
    const localResult = detectLocalPrivacyPolicy();

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_TOSDR',
            url: window.location.href
        });

        if (response && response.found && response.grade) {
            return {
                score: response.score,
                source: 'tosdr',
                grade: response.grade,
                serviceName: response.service?.name,
                hasLocalPolicy: localResult.found
            };
        }
    } catch (error) {
        console.warn('[Policy] ToS;DR check failed:', error);
    }

    return {
        score: localResult.found ? 50 : 25,
        source: localResult.found ? 'local' : 'fallback',
        hasLocalPolicy: localResult.found
    };
}

/**
 * Synchronous version for backward compatibility
 * Only uses local detection (no API call)
 */
export function detectPrivacyPolicySync(): number {
    const localResult = detectLocalPrivacyPolicy();
    return localResult.found ? 50 : 25;
}
