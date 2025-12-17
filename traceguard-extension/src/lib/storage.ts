import { StorageSchema, UserSettings, AppState } from './types';

const DEFAULT_SETTINGS: UserSettings = {
    enabled: true,
    notifications: true,
    theme: 'system',
    whitelist: [],
    blacklist: [],
    lowPowerMode: false,
    logRetentionDays: 0 // 0 = forever, until storage full
};

const DEFAULT_STATE: AppState = {
    ups: 100,
    sitesAnalyzed: 0,
    trackersDetected: 0,
    piiEventsCount: 0,
    safeVisitStreak: 0
};

export const storage = {
    get: async <K extends keyof StorageSchema>(keys: K | K[]): Promise<Pick<StorageSchema, K>> => {
        return chrome.storage.local.get(keys) as Promise<Pick<StorageSchema, K>>;
    },

    set: async (items: Partial<StorageSchema>): Promise<void> => {
        return chrome.storage.local.set(items);
    },

    // Helper to get all settings with defaults applied
    getSettings: async (): Promise<UserSettings> => {
        const result = await chrome.storage.local.get('settings');
        return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    },

    updateSettings: async (settings: Partial<UserSettings>): Promise<void> => {
        const current = await storage.getSettings();
        await chrome.storage.local.set({ settings: { ...current, ...settings } });
    },

    // Helper to get app state with defaults
    getState: async (): Promise<AppState> => {
        const result = await chrome.storage.local.get('state');
        return { ...DEFAULT_STATE, ...(result.state || {}) };
    },

    updateState: async (state: Partial<AppState>): Promise<void> => {
        const current = await storage.getState();
        await chrome.storage.local.set({ state: { ...current, ...state } });
    },

    // Add a detector log entry
    addDetectorLog: async (log: Omit<import('./types').DetectorLogEntry, 'id' | 'timestamp'>): Promise<void> => {
        const result = await chrome.storage.local.get('detectorLogs');
        const logs = (result.detectorLogs || []) as import('./types').DetectorLogEntry[];

        const newLog: import('./types').DetectorLogEntry = {
            ...log,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        };

        logs.push(newLog);

        // Check storage quota and cleanup if needed
        const settings = await storage.getSettings();
        const retentionDays = settings.logRetentionDays || 0; // 0 = forever

        // Cleanup old logs based on retention policy
        const now = Date.now();
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

        let filteredLogs = logs;
        if (retentionDays > 0) {
            filteredLogs = logs.filter(l => (now - l.timestamp) < retentionMs);
        }

        // Check storage usage and limit to prevent quota issues
        // Keep max 1000 logs, remove oldest if exceeded
        if (filteredLogs.length > 1000) {
            filteredLogs = filteredLogs.slice(-1000);
        }

        await chrome.storage.local.set({ detectorLogs: filteredLogs });
    },

    // Clean up old logs based on retention policy
    cleanupOldLogs: async (): Promise<void> => {
        const settings = await storage.getSettings();
        const retentionDays = settings.logRetentionDays || 0;

        if (retentionDays === 0) return; // Keep forever

        const result = await chrome.storage.local.get('detectorLogs');
        const logs = (result.detectorLogs || []) as import('./types').DetectorLogEntry[];

        const now = Date.now();
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

        const filteredLogs = logs.filter(l => (now - l.timestamp) < retentionMs);

        await chrome.storage.local.set({ detectorLogs: filteredLogs });
    },

    // Get storage usage info
    getStorageUsage: async (): Promise<{ bytesInUse: number; quota: number }> => {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        return { bytesInUse, quota };
    },

    // Cross-site exposure tracking methods

    /**
     * Record that a PII type was shared with a specific domain
     * Used to track "Your email is known to X sites"
     */
    addExposure: async (fieldType: string, domain: string): Promise<void> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const exposure = (result.crossSiteExposure || {}) as import('./types').CrossSiteExposure;

        // Initialize array if needed
        if (!exposure[fieldType]) {
            exposure[fieldType] = [];
        }

        // Add domain if not already tracked
        if (!exposure[fieldType].includes(domain)) {
            exposure[fieldType].push(domain);
            await chrome.storage.local.set({ crossSiteExposure: exposure });
            console.log(`[Cross-Site Exposure] ${fieldType} now shared with ${exposure[fieldType].length} sites`);
        }
    },

    /**
     * Get count of sites that have received a specific PII type
     */
    getExposureCount: async (fieldType: string): Promise<number> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const exposure = (result.crossSiteExposure || {}) as import('./types').CrossSiteExposure;
        return exposure[fieldType]?.length || 0;
    },

    /**
     * Get list of sites that have received a specific PII type
     */
    getExposureSites: async (fieldType: string): Promise<string[]> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const exposure = (result.crossSiteExposure || {}) as import('./types').CrossSiteExposure;
        return exposure[fieldType] || [];
    },

    /**
     * Get all cross-site exposure data
     */
    getAllExposure: async (): Promise<import('./types').CrossSiteExposure> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        return (result.crossSiteExposure || {}) as import('./types').CrossSiteExposure;
    },

    // ============================================
    // Notification Methods
    // ============================================

    /**
     * Add a new notification event
     */
    addNotification: async (notification: Omit<import('./types').NotificationEvent, 'id' | 'timestamp' | 'read'>): Promise<void> => {
        const result = await chrome.storage.local.get('notifications');
        const notifications = (result.notifications || []) as import('./types').NotificationEvent[];

        const newNotification: import('./types').NotificationEvent = {
            ...notification,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            read: false
        };

        // Add to beginning (most recent first)
        notifications.unshift(newNotification);

        // Keep max 100 notifications
        const trimmedNotifications = notifications.slice(0, 100);

        await chrome.storage.local.set({ notifications: trimmedNotifications });
        console.log(`[Notification] Added: ${notification.title}`);
    },

    /**
     * Get all notifications, optionally limited
     */
    getNotifications: async (limit?: number): Promise<import('./types').NotificationEvent[]> => {
        const result = await chrome.storage.local.get('notifications');
        const notifications = (result.notifications || []) as import('./types').NotificationEvent[];
        return limit ? notifications.slice(0, limit) : notifications;
    },

    /**
     * Get count of unread notifications
     */
    getUnreadCount: async (): Promise<number> => {
        const result = await chrome.storage.local.get('notifications');
        const notifications = (result.notifications || []) as import('./types').NotificationEvent[];
        return notifications.filter(n => !n.read).length;
    },

    /**
     * Mark a notification as read
     */
    markAsRead: async (id: string): Promise<void> => {
        const result = await chrome.storage.local.get('notifications');
        const notifications = (result.notifications || []) as import('./types').NotificationEvent[];

        const updatedNotifications = notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        );

        await chrome.storage.local.set({ notifications: updatedNotifications });
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead: async (): Promise<void> => {
        const result = await chrome.storage.local.get('notifications');
        const notifications = (result.notifications || []) as import('./types').NotificationEvent[];

        const updatedNotifications = notifications.map(n => ({ ...n, read: true }));

        await chrome.storage.local.set({ notifications: updatedNotifications });
    },

    /**
     * Clear all notifications
     */
    clearNotifications: async (): Promise<void> => {
        await chrome.storage.local.set({ notifications: [] });
    },

    /**
     * Remove a specific notification
     */
    removeNotification: async (id: string): Promise<void> => {
        const result = await chrome.storage.local.get('notifications');
        const notifications = (result.notifications || []) as import('./types').NotificationEvent[];

        const filteredNotifications = notifications.filter(n => n.id !== id);

        await chrome.storage.local.set({ notifications: filteredNotifications });
    }
};

