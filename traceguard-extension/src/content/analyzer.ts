/**
 * =============================================================================
 * PAGE ANALYZER - The Privacy Inspection Coordinator
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the "coordinator" that runs all privacy detectors on a webpage.
 * Think of it like a building inspector who checks electrical, plumbing, and
 * structure - this analyzer checks trackers, cookies, inputs, and policy.
 * 
 * HOW IT WORKS:
 * 1. When called, it runs 5 different detectors (reputation is checked separately)
 * 2. Each detector examines one aspect of the page's privacy
 * 3. Results are collected and packaged together
 * 4. The data is sent back to be scored and stored
 * 
 * THE 5 DETECTION AREAS:
 * 1. Tracking - Are there third-party trackers following you?
 * 2. Inputs - Are there sensitive form fields (password, credit card)?
 * 3. Cookies - Are there tracking or advertising cookies?
 * 4. Policy  - What does the privacy policy say (ToS;DR rating)?
 * 5. Reputation - Is the domain on any blacklists? (checked by background)
 * 
 * Note: Reputation is checked by the background script, not here, because
 * content scripts can't make cross-origin requests to the reputation APIs.
 * =============================================================================
 */

// Import all the individual detector functions
import { detectTrackingDetailed, detectTrackersRaw } from './detectors/tracking'; // Finds trackers
import { detectSensitiveInputs } from './detectors/input';     // Finds sensitive fields
import { detectPrivacyPolicyDetailed } from './detectors/policy';      // Checks privacy policy
import { detectCookiesDetailed, detectCookiesRaw } from './detectors/cookie';    // Analyzes cookies
import { detectFingerprintingAttempts } from './detectors/fingerprinting';
import { ScoreBreakdown } from '@/lib/types';                  // Type definitions

export interface DetectionDetails {
    tracking: { count: number; known: number; suspicious: number };
    cookies: { total: number; tracking: number; thirdParty: number };
    input: { total: number; sensitive: number; types: string[] };
    policy: { 
        grade?: string; 
        source: string; 
        score: number;
        serviceId?: number;
        points?: { title: string; classification: string }[];
    };
}

export interface PageAnalysisResult {
    scores: ScoreBreakdown;
    sensitiveFields: ReturnType<typeof detectSensitiveInputs>['fields'];
    detectionDetails: DetectionDetails;
    rawForEnrichment: {
        cookies: { name: string; value: string }[];
        trackers: { url: string; type: string; domain: string }[];
        fingerprinting: { technique: string; scriptUrl: string | null }[];
    };
}

/**
 * Analyze the current page for privacy and security risks
 * Note: Detector logs are saved by the background worker to avoid duplicates
 */
export async function analyzePage(): Promise<PageAnalysisResult> {
    // Run all detectors
    const trackingResult = detectTrackingDetailed();
    const inputResult = detectSensitiveInputs();
    const cookieResult = detectCookiesDetailed();

    // Reputation check is handled by background service (includes blacklist + URLhaus)
    // We pass a placeholder here; background will overwrite with actual score
    const reputationScore = 100;

    // Privacy policy check with ToS;DR API (async)
    const policyResult = await detectPrivacyPolicyDetailed();

    return {
        scores: {
            reputation: reputationScore,
            tracking: trackingResult.score,
            cookies: cookieResult.score,
            input: inputResult.score,
            policy: policyResult.score
        },
        sensitiveFields: inputResult.fields,
        detectionDetails: {
            tracking: {
                count: trackingResult.trackerCount,
                known: trackingResult.knownTrackers.length,
                suspicious: trackingResult.suspiciousTrackers.length
            },
            cookies: {
                total: cookieResult.total,
                tracking: cookieResult.tracking,
                thirdParty: cookieResult.thirdParty
            },
            input: {
                total: inputResult.fields.high.length + inputResult.fields.medium.length + inputResult.fields.low.length,
                sensitive: inputResult.fields.high.length,
                types: [
                    ...inputResult.fields.high.map(f => f.type),
                    ...inputResult.fields.medium.map(f => f.type),
                    ...inputResult.fields.low.map(f => f.type)
                ].filter((v, i, a) => a.indexOf(v) === i) // unique
            },
            policy: {
                grade: policyResult.grade,
                source: policyResult.source,
                score: policyResult.score,
                serviceId: policyResult.serviceId,
                points: policyResult.points
            }
        },
        rawForEnrichment: {
            cookies: detectCookiesRaw(),
            trackers: typeof detectTrackersRaw === 'function' ? detectTrackersRaw() : [],
            fingerprinting: detectFingerprintingAttempts()
        }
    };
}
