import { detectProtocol } from './detectors/protocol';
import { detectTrackingDetailed } from './detectors/tracking';
import { detectSensitiveInputs } from './detectors/input';
import { detectPrivacyPolicy } from './detectors/policy';
import { detectCookiesDetailed } from './detectors/cookie';
import { ScoreBreakdown } from '@/lib/types';

export interface DetectionDetails {
    tracking: { count: number; known: number; suspicious: number };
    cookies: { total: number; tracking: number; thirdParty: number };
    input: { total: number; sensitive: number; types: string[] };
    policy: { grade?: string; source: string; score: number };
}

export interface PageAnalysisResult {
    scores: ScoreBreakdown;
    sensitiveFields: ReturnType<typeof detectSensitiveInputs>['fields'];
    detectionDetails: DetectionDetails;
}

/**
 * Analyze the current page for privacy and security risks
 * Note: Detector logs are saved by the background worker to avoid duplicates
 */
export async function analyzePage(): Promise<PageAnalysisResult> {
    // Run all detectors
    const protocolScore = detectProtocol();
    const trackingResult = detectTrackingDetailed();
    const inputResult = detectSensitiveInputs();
    const cookieResult = detectCookiesDetailed();

    // Reputation check is handled by background service (includes blacklist + URLhaus)
    // We pass a placeholder here; background will overwrite with actual score
    const reputationScore = 100;

    // Privacy policy check with ToS;DR API (async)
    const policyScore = await detectPrivacyPolicy();

    // Determine policy source and grade from score
    let policyGrade: string | undefined;
    let policySource = 'fallback';

    // ToS;DR scores: 20 (E), 40 (D), 60 (C), 80 (B), 100 (A)
    if (policyScore === 100) { policyGrade = 'A'; policySource = 'tosdr'; }
    else if (policyScore === 80) { policyGrade = 'B'; policySource = 'tosdr'; }
    else if (policyScore === 60) { policyGrade = 'C'; policySource = 'tosdr'; }
    else if (policyScore === 40) { policyGrade = 'D'; policySource = 'tosdr'; }
    else if (policyScore === 20) { policyGrade = 'E'; policySource = 'tosdr'; }
    // Fallback scores: 50 (has link), 25 (no link)

    return {
        scores: {
            protocol: protocolScore,
            reputation: reputationScore,
            tracking: trackingResult.score,
            cookies: cookieResult.score,
            input: inputResult.score,
            policy: policyScore
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
                grade: policyGrade,
                source: policySource,
                score: policyScore
            }
        }
    };
}
