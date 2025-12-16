import { detectProtocol } from './detectors/protocol';
import { detectTrackingDetailed } from './detectors/tracking';
import { detectSensitiveInputs } from './detectors/input';
import { detectPrivacyPolicy } from './detectors/policy';
import { detectReputation } from './detectors/reputation';
import { detectCookies } from './detectors/cookie';
import { ScoreBreakdown, DetectorLogEntry } from '@/lib/types';

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
 * Save detector log entry to chrome.storage for activity logs
 */
async function saveDetectorLog(log: Omit<DetectorLogEntry, 'id'>): Promise<void> {
    try {
        const result = await chrome.storage.local.get('detectorLogs');
        const logs = (result.detectorLogs || []) as DetectorLogEntry[];

        // Add unique ID
        const logWithId: DetectorLogEntry = {
            ...log,
            id: `${log.detector}-${log.domain}-${log.timestamp}`
        };

        // Add to beginning of array (most recent first)
        logs.unshift(logWithId);

        // Limit to 1000 most recent logs to prevent storage bloat
        const trimmedLogs = logs.slice(0, 1000);

        await chrome.storage.local.set({ detectorLogs: trimmedLogs });

        console.log(`[Analyzer] Saved ${log.detector} log to storage`);
    } catch (error) {
        console.error('[Analyzer] Failed to save detector log:', error);
    }
}

/**
 * Get human-readable message for detector result
 */
function getDetectorMessage(detector: string, score: number, details?: any): string {
    switch (detector) {
        case 'protocol':
            return score === 100 ? 'Secure HTTPS connection' : 'Insecure HTTP connection';
        case 'reputation':
            if (score === 0) return 'Domain blacklisted or malicious';
            if (score <= 20) return 'Known threat detected';
            if (score === 100) return 'Clean reputation';
            return `Reputation score: ${score}`;
        case 'tracking':
            const trackerCount = details?.trackerCount || 0;
            if (trackerCount === 0) return 'No trackers detected';
            return `${trackerCount} tracker(s) detected`;
        case 'cookies':
            if (score === 100) return 'No tracking cookies';
            if (score >= 80) return 'Few tracking cookies';
            if (score >= 60) return 'Moderate tracking cookies';
            return 'Many tracking cookies';
        case 'inputs':
            if (score === 0) return 'High-sensitivity inputs (passwords, credit cards)';
            if (score === 50) return 'Medium-sensitivity inputs (email, phone)';
            return 'No sensitive inputs detected';
        case 'policy':
            if (score <= 20) return 'Excellent privacy policy (ToS;DR A/B)';
            if (score <= 40) return 'Fair privacy policy (ToS;DR C)';
            if (score <= 80) return 'Poor privacy policy (ToS;DR D/E)';
            return 'No privacy policy found';
        default:
            return `Score: ${score}`;
    }
}

export async function analyzePage(): Promise<PageAnalysisResult> {
    const domain = window.location.hostname;
    const timestamp = Date.now();

    // Run all detectors
    const protocolScore = detectProtocol();
    const trackingResult = detectTrackingDetailed();
    const inputResult = detectSensitiveInputs();
    const cookieScore = detectCookies();

    // Multi-layer reputation check (blacklist + Safe Browsing + PhishTank)
    const reputationScore = await detectReputation();

    // Privacy policy check with ToS;DR API (async)
    const policyScore = await detectPrivacyPolicy();

    // Save all detector logs to storage (async, non-blocking)
    const logPromises = [
        saveDetectorLog({
            timestamp,
            detector: 'protocol',
            domain,
            score: protocolScore,
            message: getDetectorMessage('protocol', protocolScore),
            details: { protocol: window.location.protocol }
        }),
        saveDetectorLog({
            timestamp,
            detector: 'reputation',
            domain,
            score: reputationScore,
            message: getDetectorMessage('reputation', reputationScore),
            details: {}
        }),
        saveDetectorLog({
            timestamp,
            detector: 'tracking',
            domain,
            score: trackingResult.score,
            message: getDetectorMessage('tracking', trackingResult.score, { trackerCount: trackingResult.trackerCount }),
            details: {
                trackerCount: trackingResult.trackerCount,
                knownTrackers: trackingResult.knownTrackers,
                suspiciousTrackers: trackingResult.suspiciousTrackers
            }
        }),
        saveDetectorLog({
            timestamp,
            detector: 'cookies',
            domain,
            score: cookieScore,
            message: getDetectorMessage('cookies', cookieScore),
            details: {}
        }),
        saveDetectorLog({
            timestamp,
            detector: 'inputs',
            domain,
            score: inputResult.score,
            message: getDetectorMessage('inputs', inputResult.score),
            details: {
                highCount: inputResult.fields.high.length,
                mediumCount: inputResult.fields.medium.length,
                lowCount: inputResult.fields.low.length
            }
        }),
        saveDetectorLog({
            timestamp,
            detector: 'policy',
            domain,
            score: policyScore,
            message: getDetectorMessage('policy', policyScore),
            details: {}
        })
    ];

    // Save logs in background (don't await to avoid blocking)
    Promise.all(logPromises).catch(err => {
        console.error('[Analyzer] Failed to save detector logs:', err);
    });

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
