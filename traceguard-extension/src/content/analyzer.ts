import { detectProtocol } from './detectors/protocol';
import { detectTrackingDetailed } from './detectors/tracking';
import { detectSensitiveInputs } from './detectors/input';
import { detectPrivacyPolicy } from './detectors/policy';
import { detectReputation } from './detectors/reputation';
import { detectCookies } from './detectors/cookie';
import { ScoreBreakdown } from '@/lib/types';

export interface PageAnalysisResult {
    scores: ScoreBreakdown;
    sensitiveFields: ReturnType<typeof detectSensitiveInputs>['fields'];
    trackingDetails?: {
        trackerCount: number;
        knownTrackers: string[];
        suspiciousTrackers: string[];
    };
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
    const cookieScore = detectCookies();

    // Multi-layer reputation check (blacklist + Safe Browsing)
    const reputationScore = await detectReputation();

    // Privacy policy check with ToS;DR API (async)
    const policyScore = await detectPrivacyPolicy();

    return {
        scores: {
            protocol: protocolScore,
            reputation: reputationScore,
            tracking: trackingResult.score,
            cookies: cookieScore,
            input: inputResult.score,
            policy: policyScore
        },
        sensitiveFields: inputResult.fields,
        trackingDetails: {
            trackerCount: trackingResult.trackerCount,
            knownTrackers: trackingResult.knownTrackers,
            suspiciousTrackers: trackingResult.suspiciousTrackers
        }
    };
}
