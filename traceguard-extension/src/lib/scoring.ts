import { ScoreBreakdown } from './types';

/**
 * Calculate Website Risk Score (WRS) using 6-context weighted formula
 * 
 * Enhanced WRS Formula (v2.0):
 * - Protocol: 25% (HTTP/HTTPS check)
 * - Reputation: 25% (Domain reputation - blacklist + Safe Browsing)
 * - Tracking: 20% (Third-party tracking - EFF lists)
 * - Cookies: 15% (Third-party cookies - NEW in v2)
 * - Inputs: 10% (Sensitive input fields)
 * - Policy: 5% (Privacy policy quality)
 * 
 * Total: 100%
 */
export function calculateWRS(breakdown: ScoreBreakdown): number {
    // Six-context weighted formula (v2.0)
    const weights = {
        protocol: 0.25,    // HTTP/HTTPS check - Increased importance
        reputation: 0.25,  // Domain reputation - Balanced with protocol
        tracking: 0.20,    // Third-party tracking - Keep high
        cookies: 0.15,     // Third-party cookies - NEW context
        input: 0.10,       // Sensitive input fields - Reduced
        policy: 0.05       // Privacy policy quality - Reduced
    };

    // Calculate weighted contributions
    const contributions = {
        protocol: breakdown.protocol * weights.protocol,
        reputation: breakdown.reputation * weights.reputation,
        tracking: breakdown.tracking * weights.tracking,
        cookies: breakdown.cookies * weights.cookies,
        input: breakdown.input * weights.input,
        policy: breakdown.policy * weights.policy
    };

    // Sum all contributions
    const totalWeightedScore =
        contributions.protocol +
        contributions.reputation +
        contributions.tracking +
        contributions.cookies +
        contributions.input +
        contributions.policy;

    const finalScore = Math.round(totalWeightedScore);

    // Comprehensive console logging for transparency
    console.log('[WRS Calculation] Starting calculation...');
    console.log('[WRS] Context Scores:', {
        protocol: { score: breakdown.protocol, weight: weights.protocol, contribution: contributions.protocol.toFixed(2) },
        reputation: { score: breakdown.reputation, weight: weights.reputation, contribution: contributions.reputation.toFixed(2) },
        tracking: { score: breakdown.tracking, weight: weights.tracking, contribution: contributions.tracking.toFixed(2) },
        cookies: { score: breakdown.cookies, weight: weights.cookies, contribution: contributions.cookies.toFixed(2) },
        input: { score: breakdown.input, weight: weights.input, contribution: contributions.input.toFixed(2) },
        policy: { score: breakdown.policy, weight: weights.policy, contribution: contributions.policy.toFixed(2) }
    });
    console.log('[WRS] Formula:',
        `(${breakdown.protocol} × ${weights.protocol}) + ` +
        `(${breakdown.reputation} × ${weights.reputation}) + ` +
        `(${breakdown.tracking} × ${weights.tracking}) + ` +
        `(${breakdown.cookies} × ${weights.cookies}) + ` +
        `(${breakdown.input} × ${weights.input}) + ` +
        `(${breakdown.policy} × ${weights.policy})`
    );
    console.log('[WRS] Calculation:',
        `${contributions.protocol.toFixed(2)} + ` +
        `${contributions.reputation.toFixed(2)} + ` +
        `${contributions.tracking.toFixed(2)} + ` +
        `${contributions.cookies.toFixed(2)} + ` +
        `${contributions.input.toFixed(2)} + ` +
        `${contributions.policy.toFixed(2)} = ${totalWeightedScore.toFixed(2)}`
    );
    console.log('[WRS] Final Score:', finalScore, '(rounded from', totalWeightedScore.toFixed(2) + ')');

    return finalScore;
}

// Re-export UPS calculation
export { calculateUPS } from './pii';
