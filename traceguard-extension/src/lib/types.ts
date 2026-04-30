/**
 * =============================================================================
 * TYPE DEFINITIONS - The Data Blueprints for TraceGuard
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file contains "type definitions" or "interfaces" - they're like blueprints
 * that describe the shape of data we use throughout the extension. Think of them
 * like forms with specific fields that data must fill in.
 * 
 * WHY WE NEED TYPES:
 * TypeScript uses these to catch bugs before the code runs. For example, if we
 * try to access a property that doesn't exist, TypeScript will warn us. It's like
 * spell-check, but for data!
 * 
 * HOW TO READ THIS FILE:
 * - `interface` defines a "shape" of data with named properties
 * - `type` creates an alias for another type
 * - `?` after a property name means it's optional
 * - `number`, `string`, `boolean` are basic data types
 * - `[]` means an array (list) of that type
 * =============================================================================
 */

// =============================================================================
// SCORE BREAKDOWN
// The individual scores from each detector
// =============================================================================

/**
 * Contains the safety score from each of the 6 detectors.
 * Each score ranges from 0 (dangerous) to 100 (safe).
 * 
 * These are combined to calculate the overall Website Safety Score (WSS).
 */
export interface ScoreBreakdown {
    protocol: number;    // Is the connection HTTPS (secure) or HTTP (insecure)?
    reputation: number;  // Is the domain on any blacklists?
    tracking: number;    // How many third-party trackers are on the page?
    cookies: number;     // Are there tracking or third-party cookies?
    input: number;       // Are there sensitive input fields?
    policy: number;      // What's the privacy policy rating?
}

// =============================================================================
// SITE RISK DATA
// Complete information about a website's privacy analysis
// =============================================================================

/**
 * Stores all the analysis data for a single website.
 * This is what we save in the cache for each domain you visit.
 * 
 * SCORING:
 * - wss (Website Safety Score): 0-100, HIGHER = SAFER
 *   - 80-100: Excellent - Very safe
 *   - 60-79:  Good - Generally safe
 *   - 40-59:  Fair - Some concerns
 *   - 20-39:  Poor - Significant risks
 *   - 0-19:   Critical - Avoid entering personal info
 * 
 * NOTE: WRS (Website Risk Score) is DEPRECATED. Use WSS exclusively.
 */
export interface SiteRiskData {
    domain: string;              // The website's domain (e.g., "google.com")
    wss: number;                 // Website Safety Score (0-100, higher = safer)
    breakdown: ScoreBreakdown;   // Individual scores from each detector
    lastAnalyzed: number | string; // When we analyzed it (timestamp or ISO date string)
    visitCount?: number;         // How many times you've visited (optional)
    lastVisit?: number;          // Timestamp of last visit (optional)
    detectionDetails?: {         // Detailed findings from each detector (optional)
        tracking?: { count: number; known: number; suspicious: number };
        cookies?: { total: number; tracking: number; thirdParty: number };
        input?: { total: number; sensitive: number; types: string[] };
        policy?: { grade?: string; source: string };
        reputation?: { checks: string[]; status: string };
    };
}

// =============================================================================
// DETECTOR LOG TYPES
// Types for logging what the detectors find
// =============================================================================

/**
 * The possible detector categories.
 * Each detector is responsible for analyzing one aspect of privacy.
 */
export type DetectorType = 'protocol' | 'reputation' | 'tracking' | 'cookies' | 'inputs' | 'policy' | 'permissions';

/**
 * A single log entry from a detector.
 * These are displayed in the "Activity Logs" page in the dashboard.
 */
export interface DetectorLogEntry {
    id: string;                          // Unique identifier for this log entry
    timestamp: number;                   // When this was logged (Unix timestamp)
    detector: DetectorType;              // Which detector created this log
    domain: string;                      // Which website this is for
    score: number;                       // The score that was calculated
    details: Record<string, any>;        // Extra details (varies by detector)
    message: string;                     // Human-readable description
}

// =============================================================================
// USER SETTINGS
// What preferences the user has configured
// =============================================================================

/**
 * User preferences that can be configured in the Settings page.
 * These are stored in chrome.storage and persist across sessions.
 */
export interface UserSettings {
    enabled: boolean;                    // Is the extension turned on?
    notifications: boolean;              // Should we show alerts?
    theme: 'light' | 'dark' | 'system';  // Color theme preference
    whitelist: string[];                 // Domains the user trusts (always safe)
    blacklist: string[];                 // Domains the user blocked (always danger)
    notificationLevel?: 'silent' | 'balanced' | 'aggressive';  // How often to alert
    dataRetention?: number;              // How many days to keep data
    wssThreshold?: number;               // Safety threshold for warnings
    lowPowerMode?: boolean;              // Reduce background activity
    logRetentionDays?: number;           // How long to keep logs
    enablePIIDetection?: boolean;        // Watch for personal info entry
    enableTrackerBlocking?: boolean;     // Block trackers (future feature)
    displayMode?: 'popup' | 'sidebar';   // How the extension opens
}

// =============================================================================
// HISTORY AND TRACKING
// Types for tracking score changes over time
// =============================================================================

/**
 * A point in the score history graph.
 * Used to show how your privacy score changed over time.
 */
export interface ScoreHistoryEntry {
    timestamp: number;    // When this happened
    ups: number;          // User Privacy Score at this point
    avgSiteRisk: number;  // Average site risk at this point
    reason: string;       // Why the score changed
}

/**
 * Records when you entered personal information on a website.
 * 
 * IMPORTANT: We store the TYPE of field (e.g., "password"), 
 * NOT what you actually typed!
 */
export interface PIIDetectionEvent {
    timestamp: number;              // When it happened
    site: string;                   // Which website
    fieldType: string;              // Type of field (password, email, etc.)
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';  // How sensitive the data is
    siteWSS: number;                // How safe was the site when you entered it
    scoreImpact: number;            // How much this affected your score
}

/**
 * Tracks which sites have received each type of your personal info.
 * Example: { "email": ["google.com", "facebook.com"], "password": ["amazon.com"] }
 * 
 * Used to show "Your email is known to 5 sites" in the dashboard.
 */
export interface CrossSiteExposure {
    [fieldType: string]: string[];  // Map of field type to array of domains
}

// =============================================================================
// APPLICATION STATE
// The current runtime state of the extension
// =============================================================================

/**
 * The current state of the extension - what it's tracking right now.
 * This updates as you browse and gets displayed in the popup/sidebar.
 */
export interface AppState {
    ups: number;                 // Your User Privacy Score (0-100, higher = better)
    sitesAnalyzed: number;       // Total count of sites you've visited
    trackersDetected: number;    // Total trackers found across all sites
    piiEventsCount: number;      // How many times you've entered personal info
    currentSite?: SiteRiskData;  // The site you're currently on (if analyzed)
    safeVisitStreak: number;     // Consecutive safe sites visited (for bonus)
}

// =============================================================================
// STORAGE SCHEMA
// The complete structure of what we store in chrome.storage
// =============================================================================

/**
 * The complete schema for everything stored in chrome.storage.local.
 * This is like the "database schema" for the extension.
 */
export interface StorageSchema {
    schemaVersion?: number;                        // For handling upgrades
    settings: UserSettings;                        // User preferences
    state: AppState;                               // Current runtime state
    siteCache: Record<string, SiteRiskData>;       // Cached site analyses
    logs: LogEntry[];                              // General log entries
    detectorLogs?: DetectorLogEntry[];             // Detector-specific logs
    scoreHistory?: ScoreHistoryEntry[];            // Score changes over time
    piiDetections?: PIIDetectionEvent[];           // PII entry events
    crossSiteExposure?: CrossSiteExposure;         // Which sites know your info
    notifications?: NotificationEvent[];           // Alert notifications
}

// =============================================================================
// LEGACY AND UTILITY TYPES
// =============================================================================

/**
 * A general log entry (older logging system).
 */
export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'warning' | 'error' | 'block';
    message: string;
    domain?: string;
}

/**
 * A notification shown to the user about privacy events.
 * These appear in the notification dropdown in the top navigation.
 */
export interface NotificationEvent {
    id: string;              // Unique identifier
    timestamp: number;       // When it was created
    type: 'high_risk_site' | 'pii_detected' | 'tracker_alert' | 'daily_summary' | 'info';
    title: string;           // Short title for the notification
    message: string;         // Detailed message
    domain?: string;         // Which website it's about (if applicable)
    severity: 'critical' | 'warning' | 'info';  // How urgent is it?
    read: boolean;           // Has the user seen it?
    actionUrl?: string;      // Where to go when clicked
}
