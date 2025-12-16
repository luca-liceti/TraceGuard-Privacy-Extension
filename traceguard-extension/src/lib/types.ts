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
    wrs: number;
    breakdown: ScoreBreakdown;
    lastAnalyzed: string; // ISO Date
    visitCount?: number; // Track number of visits
    lastVisit?: number; // Timestamp
}

export type DetectorType = 'protocol' | 'reputation' | 'tracking' | 'cookies' | 'inputs' | 'policy';

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
    wrsThreshold?: number; // trigger warnings above this
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
    siteWRS: number;
    scoreImpact: number;
}

export interface AppState {
    ups: number; // User Privacy Score
    sitesAnalyzed: number;
    trackersBlocked: number;
    piiEventsCount: number; // Track how many times user has shared PII
    currentSite?: SiteRiskData;
    safeVisitStreak: number; // Consecutive safe visits (WRS < 30)
}

export interface StorageSchema {
    schemaVersion?: number; // For migration handling
    settings: UserSettings;
    state: AppState;
    siteCache: Record<string, SiteRiskData>;
    logs: LogEntry[];
    detectorLogs?: DetectorLogEntry[]; // Unified logs from all 6 detectors
    scoreHistory?: ScoreHistoryEntry[]; // Historical score data for graphing
    piiDetections?: PIIDetectionEvent[]; // PII detection events
}

export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'warning' | 'error' | 'block';
    message: string;
    domain?: string;
}
