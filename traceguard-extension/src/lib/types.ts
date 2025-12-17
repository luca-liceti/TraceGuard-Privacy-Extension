export interface ScoreBreakdown {
    protocol: number;
    reputation: number;
    tracking: number;
    cookies: number;
    input: number;
    policy: number;
}

export interface SiteRiskData {
    domain: string;
    wss: number;  // Website Safety Score (0 = dangerous, 100 = safe)
    breakdown: ScoreBreakdown;
    lastAnalyzed: string; // ISO Date
    visitCount?: number; // Track number of visits
    lastVisit?: number; // Timestamp
    detectionDetails?: {
        tracking?: { count: number; known: number; suspicious: number };
        cookies?: { total: number; tracking: number; thirdParty: number };
        input?: { total: number; sensitive: number; types: string[] };
        policy?: { grade?: string; source: string };
        reputation?: { checks: string[]; status: string };
    };
}

export type DetectorType = 'protocol' | 'reputation' | 'tracking' | 'cookies' | 'inputs' | 'policy' | 'permissions';

export interface DetectorLogEntry {
    id: string;
    timestamp: number;
    detector: DetectorType;
    domain: string;
    score: number;
    details: Record<string, any>; // Detector-specific details
    message: string; // Human-readable summary
}

export interface UserSettings {
    enabled: boolean;
    notifications: boolean;
    theme: 'light' | 'dark' | 'system';
    whitelist: string[];
    blacklist: string[];
    notificationLevel?: 'silent' | 'balanced' | 'aggressive';
    dataRetention?: number; // days
    wssThreshold?: number; // trigger warnings below this (low safety = warning)
    lowPowerMode?: boolean; // Disable auto-refresh, manual only
    logRetentionDays?: number; // How long to keep logs (0 = forever, until storage full)
    enablePIIDetection?: boolean; // Enable/disable PII detection
    enableTrackerBlocking?: boolean; // Enable/disable tracker blocking (future feature)
    displayMode?: 'popup' | 'sidebar'; // How extension opens
}

export interface ScoreHistoryEntry {
    timestamp: number;
    ups: number;
    avgSiteRisk: number;
    reason: string;
}

export interface PIIDetectionEvent {
    timestamp: number;
    site: string;
    fieldType: string;
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
    siteWSS: number;  // Website Safety Score at time of event
    scoreImpact: number;
}

/**
 * Tracks which sites have received each type of PII
 * Used to show "Your email is known to X sites" in dashboard
 */
export interface CrossSiteExposure {
    [fieldType: string]: string[];  // fieldType -> array of domains
}

export interface AppState {
    ups: number; // User Privacy Score (0 = exposed, 100 = protected)
    sitesAnalyzed: number;
    trackersDetected: number; // Total trackers detected (renamed from trackersBlocked)
    piiEventsCount: number; // Track how many times user has shared PII
    currentSite?: SiteRiskData;
    safeVisitStreak: number; // Consecutive safe visits (WSS > 70)
}

export interface StorageSchema {
    schemaVersion?: number; // For migration handling
    settings: UserSettings;
    state: AppState;
    siteCache: Record<string, SiteRiskData>;
    logs: LogEntry[];
    detectorLogs?: DetectorLogEntry[]; // Unified logs from all detectors
    scoreHistory?: ScoreHistoryEntry[]; // Historical score data for graphing
    piiDetections?: PIIDetectionEvent[]; // PII detection events
    crossSiteExposure?: CrossSiteExposure; // Track PII shared across sites
}

export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'warning' | 'error' | 'block';
    message: string;
    domain?: string;
}
