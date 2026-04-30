/**
 * =============================================================================
 * SAFETY UTILITIES - Unified Score and Safety Evaluation Functions
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file provides a SINGLE SOURCE OF TRUTH for how we evaluate and display
 * safety scores throughout the TraceGuard dashboard. Before this file existed,
 * each page had its own slightly different version of these functions!
 * 
 * SCORING TERMINOLOGY (STANDARDIZED):
 * - WSS (Website Safety Score): 0-100 where HIGHER = SAFER (PRIMARY METRIC)
 * - UPS (User Privacy Score): 0-100 where HIGHER = BETTER privacy habits
 * 
 * NOTE: WRS (Website Risk Score) is DEPRECATED. Use WSS exclusively.
 * 
 * STANDARDIZED WSS THRESHOLDS (higher = safer):
 * - Excellent: 80-100 - Very safe, trustworthy site
 * - Good:      60-79  - Generally safe
 * - Fair:      40-59  - Some concerns, be cautious
 * - Poor:      20-39  - Significant risks
 * - Critical:  0-19   - Major security concerns, avoid PII
 * 
 * For UPS (higher = better):
 * - Excellent: 90-100
 * - Good:      70-89
 * - Fair:      50-69
 * - Poor:      30-49
 * - Critical:  0-29
 * =============================================================================
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Safety levels for WSS-based evaluations (higher = safer)
 */
export type SafetyLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * @deprecated Use SafetyLevel instead. WRS is deprecated.
 */
export type RiskLevel = SafetyLevel;

/**
 * Status levels for UPS/positive scores (higher = better)
 */
export type ScoreStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * Configuration for a safety level including colors and labels
 */
export interface SafetyConfig {
    level: SafetyLevel;
    label: string;
    description: string;
    color: string;      // Text color class
    bgColor: string;    // Background color class
    borderColor: string; // Border color class
}

/**
 * @deprecated Use SafetyConfig instead
 */
export type RiskConfig = SafetyConfig;

/**
 * Configuration for a score status (for positive scores like UPS)
 */
export interface StatusConfig {
    status: ScoreStatus;
    label: string;
    description: string;
    color: string;
    bgColor: string;
}

// =============================================================================
// SAFETY LEVEL CONFIGURATIONS
// Used for WSS (higher = safer)
// =============================================================================

export const SAFETY_CONFIGS: Record<SafetyLevel, SafetyConfig> = {
    excellent: {
        level: 'excellent',
        label: 'Excellent',
        description: 'Very safe and trustworthy site',
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
    },
    good: {
        level: 'good',
        label: 'Good',
        description: 'Generally safe browsing',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
    },
    fair: {
        level: 'fair',
        label: 'Fair',
        description: 'Some concerns found - be cautious',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
    },
    poor: {
        level: 'poor',
        label: 'Poor',
        description: 'Significant risks detected - proceed with caution',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
    },
    critical: {
        level: 'critical',
        label: 'Critical',
        description: 'Major security concerns - avoid entering personal information',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
    },
};

/**
 * @deprecated Use SAFETY_CONFIGS instead. Provided for backward compatibility.
 */
export const RISK_CONFIGS = SAFETY_CONFIGS;

// =============================================================================
// SCORE STATUS CONFIGURATIONS
// Used for UPS and similar "higher = better" scores
// =============================================================================

export const STATUS_CONFIGS: Record<ScoreStatus, StatusConfig> = {
    excellent: {
        status: 'excellent',
        label: 'Excellent',
        description: 'Your browsing habits are excellent!',
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
    },
    good: {
        status: 'good',
        label: 'Good',
        description: 'Good privacy practices, keep it up!',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
    },
    fair: {
        status: 'fair',
        label: 'Fair',
        description: 'Room for improvement in privacy.',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
    },
    poor: {
        status: 'poor',
        label: 'Poor',
        description: 'Consider reviewing your browsing habits.',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
    },
    critical: {
        status: 'critical',
        label: 'Critical',
        description: 'Immediate attention recommended.',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
    },
};

// =============================================================================
// WSS EVALUATION FUNCTIONS (Website Safety Score - higher = safer)
// =============================================================================

/**
 * Get the safety level for a WSS score.
 * WSS ranges from 0-100 where higher = safer.
 * 
 * @param wss - Website Safety Score (0-100)
 * @returns The safety level key
 */
export function getSafetyLevel(wss: number): SafetyLevel {
    if (wss >= 80) return 'excellent';
    if (wss >= 60) return 'good';
    if (wss >= 40) return 'fair';
    if (wss >= 20) return 'poor';
    return 'critical';
}

/**
 * Get the full safety configuration for a WSS score.
 * This includes label, colors, and description.
 * 
 * @param wss - Website Safety Score (0-100)
 * @returns Complete safety configuration object
 */
export function getSafetyConfig(wss: number): SafetyConfig {
    return SAFETY_CONFIGS[getSafetyLevel(wss)];
}

/**
 * Get just the color class for a WSS score.
 * Useful when you only need the text color.
 * 
 * @param wss - Website Safety Score (0-100)
 * @returns Tailwind text color class
 */
export function getSafetyColor(wss: number): string {
    return getSafetyConfig(wss).color;
}

/**
 * @deprecated Use getSafetyLevel instead. WRS is deprecated.
 * Provided for backward compatibility - converts WSS to old WRS logic.
 */
export function getRiskLevel(wssOrWrs: number): SafetyLevel {
    // Assume the input is already WSS (higher = safer)
    return getSafetyLevel(wssOrWrs);
}

/**
 * @deprecated Use getSafetyConfig instead. WRS is deprecated.
 */
export function getRiskConfig(wss: number): SafetyConfig {
    return getSafetyConfig(wss);
}

/**
 * @deprecated Use getSafetyColor instead. WRS is deprecated.
 */
export function getRiskColor(wss: number): string {
    return getSafetyColor(wss);
}

// =============================================================================
// SCORE STATUS FUNCTIONS (for UPS - higher = better)
// =============================================================================

/**
 * Get the status level for a UPS score.
 * UPS ranges from 0-100 where higher = better privacy.
 * 
 * @param ups - User Privacy Score (0-100)
 * @returns The status level key
 */
export function getScoreStatus(ups: number): ScoreStatus {
    if (ups >= 90) return 'excellent';
    if (ups >= 70) return 'good';
    if (ups >= 50) return 'fair';
    if (ups >= 30) return 'poor';
    return 'critical';
}

/**
 * Get the full status configuration for a UPS score.
 * This includes label, colors, and description.
 * 
 * @param ups - User Privacy Score (0-100)
 * @returns Complete status configuration object
 */
export function getStatusConfig(ups: number): StatusConfig {
    return STATUS_CONFIGS[getScoreStatus(ups)];
}

/**
 * Get just the color class for a UPS score.
 * 
 * @param ups - User Privacy Score (0-100)
 * @returns Tailwind text color class
 */
export function getScoreColor(ups: number): string {
    return getStatusConfig(ups).color;
}

// =============================================================================
// CONVERSION UTILITIES (DEPRECATED - WSS is now the only metric)
// =============================================================================

/**
 * @deprecated WRS is deprecated. Use WSS directly.
 * Convert WSS (safety) to WRS (risk).
 */
export function wssToWrs(wss: number): number {
    console.warn('wssToWrs is deprecated. Use WSS directly.');
    return 100 - wss;
}

/**
 * @deprecated WRS is deprecated. Use WSS directly.
 * Convert WRS (risk) to WSS (safety).
 */
export function wrsToWss(wrs: number): number {
    console.warn('wrsToWss is deprecated. Use WSS directly.');
    return 100 - wrs;
}

// =============================================================================
// TRACKING SCORE UTILITIES
// Tracking scores use an inverted scale (higher tracking score = more trackers = worse)
// We invert it when displaying to align with WSS (higher = better)
// =============================================================================

/**
 * Get safety level for tracking.
 * Note: Tracking score internally is 0-100 where higher = more trackers (worse).
 * This function inverts it to align with WSS semantics.
 * 
 * @param trackingScore - Tracking score (0-100, higher = more trackers)
 * @returns Safety level (aligned with WSS - excellent = few/no trackers)
 */
export function getTrackingLevel(trackingScore: number): SafetyLevel {
    // Invert: high tracking score = low safety
    const safetyfied = 100 - trackingScore;
    return getSafetyLevel(safetyfied);
}

/**
 * Get color for tracking score display.
 * 
 * @param trackingScore - Tracking score (0-100, higher = more trackers)
 * @returns Tailwind text color class
 */
export function getTrackingColor(trackingScore: number): string {
    return SAFETY_CONFIGS[getTrackingLevel(trackingScore)].color;
}
