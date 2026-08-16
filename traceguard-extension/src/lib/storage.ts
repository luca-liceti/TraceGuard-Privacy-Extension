/**
 * =============================================================================
 * STORAGE UTILITY - Saving and Loading Extension Data
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file provides easy ways to save and load data using Chrome's storage.
 * Think of it like a filing cabinet for the extension - we can store settings,
 * logs, site data, and notifications here.
 * 
 * WHY WE NEED THIS:
 * Chrome extensions can't use normal databases. Instead, we use chrome.storage
 * which saves data locally on your computer. This file wraps that API to make
 * it easier to use throughout the extension.
 * 
 * WHAT WE STORE:
 * 1. Settings - Your preferences (theme, notifications, whitelist/blacklist)
 * 2. App State - Your UPS score, sites analyzed count, safe streak
 * 3. Detector Logs - History of what we've detected on sites (ENCRYPTED)
 * 4. Notifications - Alerts and warnings we've shown you (ENCRYPTED)
 * 5. Cross-Site Exposure - Which sites know your email, phone, etc. (ENCRYPTED)
 * 6. Site Cache - Analyzed data about websites you've visited (ENCRYPTED)
 * 
 * ENCRYPTION:
 * Sensitive data (detectorLogs, notifications, crossSiteExposure) is encrypted
 * with the user's vault key when the vault is unlocked. When locked, writes are
 * either deferred (via the background buffer) or skipped. Reads of encrypted
 * fields are handled by the background service worker which has access to the key.
 * 
 * STORAGE LIMITS:
 * Chrome gives extensions about 5MB of local storage. We automatically:
 * - Clean up old logs based on retention settings
 * - Limit logs to 1000 entries max
 * - Limit notifications to 100 entries max
 * =============================================================================
 */

import { StorageSchema, UserSettings, AppState } from './types';
import { encryptData, decryptData, generateAesKey, exportKey, importKey } from './crypto';

// =============================================================================
// PERSISTENT BUFFER (vault locked)
// Telemetry recorded while the vault is locked is buffered in
// chrome.storage.local (encrypted with a persistent buffer key) and flushed
// into the vault-encrypted store when the vault is unlocked. Unlike the old
// chrome.storage.session buffer, these entries survive browser restarts.
// =============================================================================

const BUFFER_KEY = 'bufferKeyHex';

/** Persistent AES key for the locked-vault buffer (stored on disk). */
export async function getBufferKey(): Promise<CryptoKey> {
    const stored = await chrome.storage.local.get<Record<string, any>>(BUFFER_KEY);
    if (stored[BUFFER_KEY]) return importKey(stored[BUFFER_KEY]);
    const key = await generateAesKey();
    await chrome.storage.local.set({ [BUFFER_KEY]: await exportKey(key) });
    return key;
}

/**
 * Reads a buffered value, transparently decrypting it. Also handles values
 * written by older versions in plaintext.
 */
export async function readBuffer<T = any>(name: string): Promise<T | null> {
    const stored = await chrome.storage.local.get<Record<string, any>>(name);
    const raw = stored[name];
    if (raw === undefined) return null;
    if (typeof raw === 'string') {
        const key = await getBufferKey();
        return (await decryptData<T>(key, raw)) ?? null;
    }
    return raw as T;
}

/** Encrypts and writes a value into the persistent buffer. */
export async function writeBuffer(name: string, value: any): Promise<void> {
    const key = await getBufferKey();
    await chrome.storage.local.set({ [name]: await encryptData(key, value) });
}

// =============================================================================
// DEFAULT VALUES
// These are used when data doesn't exist yet (first install)
// =============================================================================

/**
 * Default settings for a new user.
 * These are sensible defaults that work well for most people.
 */
const DEFAULT_SETTINGS: UserSettings = {
    enabled: true,                // Extension is active
    notifications: true,          // Show alerts for risky sites
    theme: 'system',              // Match your OS theme (light/dark)
    whitelist: [],                // Sites you've marked as always safe
    blacklist: [],                // Sites you've marked as always dangerous
    logRetentionDays: 30,         // Days to keep activity logs before auto-deletion
    databaseRefreshDays: 7,
    enableCloudTosdr: false       // Enhanced Policy Analysis (Cloud) defaults to false (privacy-first)
};

/**
 * Default app state for a new user.
 * Everyone starts with a perfect privacy score!
 */
const DEFAULT_STATE: AppState = {
    ups: 100,                     // User Privacy Score (starts at 100)
    sitesAnalyzed: 0,             // Number of sites we've analyzed
    trackersDetected: 0,          // Total trackers found across all sites
    piiEventsCount: 0,            // Times you've entered personal info
    safeVisitStreak: 0            // Consecutive safe site visits
};

/**
 * Shared implementation for addDetectorLog / addDetectorLogs. Reads the
 * encrypted log array once, appends, applies retention + the 1,000-entry cap,
 * and writes back once.
 */
async function persistDetectorLogs(
    newLogs: Array<Omit<import('./types').DetectorLogEntry, 'id' | 'timestamp'>>,
    key?: CryptoKey | null
): Promise<void> {
    const result = await chrome.storage.local.get('detectorLogs');
    const raw = result.detectorLogs;

    // Decrypt existing logs if they are encrypted
    let logs: import('./types').DetectorLogEntry[];
    if (key && typeof raw === 'string') {
        logs = (await decryptData(key, raw)) || [];
    } else if (typeof raw === 'string') {
        // Vault is locked and data is encrypted — buffer the new logs in the
        // encrypted session buffer so they are not lost.
        const buffered = (await readBuffer<import('./types').DetectorLogEntry[]>('bufferedDetectorLogs')) || [];
        const stamped = newLogs.map(log => ({
            ...log,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        }));
        await writeBuffer('bufferedDetectorLogs', [...buffered, ...stamped]);
        return;
    } else {
        logs = (raw || []) as import('./types').DetectorLogEntry[];
    }

    for (const log of newLogs) {
        logs.push({
            ...log,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        });
    }

    // Cleanup old logs based on retention policy
    const settings = await storage.getSettings();
    const retentionDays = settings.logRetentionDays || 0; // 0 = forever
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    let filteredLogs = logs;
    if (retentionDays > 0) {
        filteredLogs = logs.filter(l => (now - l.timestamp) < retentionMs);
    }

    // Keep max 1000 logs, remove oldest if exceeded
    if (filteredLogs.length > 1000) {
        filteredLogs = filteredLogs.slice(-1000);
    }

    // Encrypt on write when key is available
    if (key) {
        await storage.set({ detectorLogs: await encryptData(key, filteredLogs) as any });
    } else {
        await storage.set({ detectorLogs: filteredLogs });
    }
}

export const storage = {
    get: async <K extends keyof StorageSchema>(keys: K | K[]): Promise<Pick<StorageSchema, K>> => {
        return chrome.storage.local.get(keys) as Promise<Pick<StorageSchema, K>>;
    },

    set: async (items: Partial<StorageSchema>): Promise<void> => {
        try {
            await chrome.storage.local.set(items);
        } catch (error: any) {
            if (error?.message?.includes('QUOTA_BYTES') || error?.name === 'QuotaExceededError') {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('QUOTA_EXCEEDED'));
                } else {
                    chrome.runtime.sendMessage({ type: 'QUOTA_EXCEEDED' }).catch(() => {});
                }
                console.error("Storage quota exceeded!", error);
            }
            throw error;
        }
    },

    // Helper to get all settings with defaults applied
    getSettings: async (): Promise<UserSettings> => {
        const result = await chrome.storage.local.get('settings');
        return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    },

    updateSettings: async (settings: Partial<UserSettings>): Promise<void> => {
        const current = await storage.getSettings();
        await storage.set({ settings: { ...current, ...settings } });
    },

    // Helper to get app state with defaults
    getState: async (): Promise<AppState> => {
        const result = await chrome.storage.local.get('state');
        return { ...DEFAULT_STATE, ...(result.state || {}) };
    },

    // Serializes state writes. A shared chain guarantees every caller's write is
    // applied in order and every returned promise resolves exactly once — the
    // previous debounced implementation could orphan a caller's promise (clearing
    // its timer) and permanently hang the telemetry write queue.
    updateState: (function() {
        let chain: Promise<void> = Promise.resolve();
        return (state: Partial<AppState>): Promise<void> => {
            const run = chain.then(async () => {
                const current = await storage.getState();
                await storage.set({ state: { ...current, ...state } });
            });
            // Keep the chain alive even if this write fails, so later writes still run.
            chain = run.catch((error) => console.error('[storage.updateState] Write failed:', error));
            return run;
        };
    })(),

    // ==========================================================================
    // Add a detector log entry.
    // Pass `key` (the vault CryptoKey) to encrypt the log on write.
    // ==========================================================================
    addDetectorLog: async (
        log: Omit<import('./types').DetectorLogEntry, 'id' | 'timestamp'>,
        key?: CryptoKey | null
    ): Promise<void> => {
        await persistDetectorLogs([log], key);
    },

    // Bulk variant: appends many logs with a single read-decrypt-encrypt-write
    // cycle instead of one per entry (used by the page-analysis pipeline).
    addDetectorLogs: async (
        logs: Array<Omit<import('./types').DetectorLogEntry, 'id' | 'timestamp'>>,
        key?: CryptoKey | null
    ): Promise<void> => {
        if (!logs.length) return;
        await persistDetectorLogs(logs, key);
    },

    // Clean up old logs based on retention policy
    cleanupOldLogs: async (key?: CryptoKey | null): Promise<void> => {
        const settings = await storage.getSettings();
        const retentionDays = settings.logRetentionDays || 0;

        if (retentionDays === 0) return; // Keep forever

        const result = await chrome.storage.local.get('detectorLogs');
        const raw = result.detectorLogs;

        let logs: import('./types').DetectorLogEntry[];
        if (key && typeof raw === 'string') {
            logs = (await decryptData(key, raw)) || [];
        } else if (typeof raw === 'string') {
            return; // Can't clean up encrypted data without the key
        } else {
            logs = (raw || []) as import('./types').DetectorLogEntry[];
        }

        const now = Date.now();
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        const filteredLogs = logs.filter(l => (now - l.timestamp) < retentionMs);

        if (key) {
            await storage.set({ detectorLogs: await encryptData(key, filteredLogs) as any });
        } else {
            await storage.set({ detectorLogs: filteredLogs });
        }
    },

    // Get storage usage info
    getStorageUsage: async (): Promise<{ bytesInUse: number; quota: number }> => {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        // With `unlimitedStorage` the quota is effectively unbounded; report 0
        // when Chrome doesn't expose a concrete number so the UI shows only
        // bytes used rather than a fabricated cap.
        const quota = chrome.storage.local.QUOTA_BYTES ?? 0;
        return { bytesInUse, quota };
    },

    // Cross-site exposure tracking methods

    /**
     * Record that a PII type was shared with a specific domain.
     * Pass `key` (the vault CryptoKey) to encrypt the exposure map on write.
     */
    addExposure: async (fieldType: string, domain: string, key?: CryptoKey | null): Promise<void> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const raw = result.crossSiteExposure;

        // Decrypt existing exposure map if it is encrypted
        let exposure: import('./types').CrossSiteExposure;
        if (key && typeof raw === 'string') {
            exposure = (await decryptData(key, raw)) || {};
        } else if (typeof raw === 'string') {
            // Vault locked and data is encrypted — buffer instead of dropping.
            const buffered = (await readBuffer<import('./types').CrossSiteExposure>('bufferedExposure')) || {};
            if (!buffered[fieldType]) buffered[fieldType] = [];
            if (!buffered[fieldType].includes(domain)) {
                buffered[fieldType].push(domain);
                await writeBuffer('bufferedExposure', buffered);
                console.log(`[Cross-Site Exposure] ${fieldType} buffered for ${buffered[fieldType].length} sites (locked)`);
            }
            return;
        } else {
            exposure = (raw || {}) as import('./types').CrossSiteExposure;
        }

        // Initialize array if needed
        if (!exposure[fieldType]) {
            exposure[fieldType] = [];
        }

        // Add domain if not already tracked
        if (!exposure[fieldType].includes(domain)) {
            exposure[fieldType].push(domain);

            if (key) {
                await storage.set({ crossSiteExposure: await encryptData(key, exposure) as any });
            } else {
                await storage.set({ crossSiteExposure: exposure });
            }
            console.log(`[Cross-Site Exposure] ${fieldType} now shared with ${exposure[fieldType].length} sites`);
        }
    },

    /**
     * Get count of sites that have received a specific PII type.
     * Pass `key` to decrypt if the data is stored encrypted.
     */
    getExposureCount: async (fieldType: string, key?: CryptoKey | null): Promise<number> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const raw = result.crossSiteExposure;
        let exposure: import('./types').CrossSiteExposure;
        if (key && typeof raw === 'string') {
            exposure = (await decryptData(key, raw)) || {};
        } else {
            exposure = (typeof raw === 'string' ? {} : raw || {}) as import('./types').CrossSiteExposure;
        }
        return exposure[fieldType]?.length || 0;
    },

    /**
     * Get list of sites that have received a specific PII type.
     * Pass `key` to decrypt if the data is stored encrypted.
     */
    getExposureSites: async (fieldType: string, key?: CryptoKey | null): Promise<string[]> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const raw = result.crossSiteExposure;
        let exposure: import('./types').CrossSiteExposure;
        if (key && typeof raw === 'string') {
            exposure = (await decryptData(key, raw)) || {};
        } else {
            exposure = (typeof raw === 'string' ? {} : raw || {}) as import('./types').CrossSiteExposure;
        }
        return exposure[fieldType] || [];
    },

    /**
     * Get all cross-site exposure data.
     * Pass `key` to decrypt if the data is stored encrypted.
     */
    getAllExposure: async (key?: CryptoKey | null): Promise<import('./types').CrossSiteExposure> => {
        const result = await chrome.storage.local.get('crossSiteExposure');
        const raw = result.crossSiteExposure;
        if (key && typeof raw === 'string') {
            return (await decryptData(key, raw)) || {};
        }
        return (typeof raw === 'string' ? {} : raw || {}) as import('./types').CrossSiteExposure;
    },

    // ============================================
    // Notification Methods
    // ============================================

    /**
     * Add a new notification event.
     * Pass `key` (the vault CryptoKey) to encrypt notifications on write.
     */
    addNotification: async (
        notification: Omit<import('./types').NotificationEvent, 'id' | 'timestamp' | 'read'>,
        key?: CryptoKey | null
    ): Promise<string> => {
        const result = await chrome.storage.local.get('notifications');
        const raw = result.notifications;

        // Decrypt existing notifications if they are encrypted
        let notifications: import('./types').NotificationEvent[];
        if (key && typeof raw === 'string') {
            notifications = (await decryptData(key, raw)) || [];
        } else if (typeof raw === 'string') {
            // Vault locked and data is encrypted — buffer instead of dropping.
            const buffered = (await readBuffer<import('./types').NotificationEvent[]>('bufferedNotifications')) || [];
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newNotification: import('./types').NotificationEvent = {
                ...notification,
                id,
                timestamp: Date.now(),
                read: false
            };
            await writeBuffer('bufferedNotifications', [newNotification, ...buffered].slice(0, 100));
            return id;
        } else {
            notifications = (raw || []) as import('./types').NotificationEvent[];
        }

        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: import('./types').NotificationEvent = {
            ...notification,
            id,
            timestamp: Date.now(),
            read: false
        };

        // Add to beginning (most recent first)
        notifications.unshift(newNotification);

        // Keep max 100 notifications
        const trimmedNotifications = notifications.slice(0, 100);

        if (key) {
            await storage.set({ notifications: await encryptData(key, trimmedNotifications) as any });
        } else {
            await storage.set({ notifications: trimmedNotifications });
        }
        return id;
    },

    /**
     * Get all notifications, optionally limited.
     * Pass `key` to decrypt if the data is stored encrypted.
     */
    getNotifications: async (limit?: number, key?: CryptoKey | null): Promise<import('./types').NotificationEvent[]> => {
        const result = await chrome.storage.local.get('notifications');
        const raw = result.notifications;
        let notifications: import('./types').NotificationEvent[];
        if (key && typeof raw === 'string') {
            notifications = (await decryptData(key, raw)) || [];
        } else {
            notifications = (typeof raw === 'string' ? [] : raw || []) as import('./types').NotificationEvent[];
        }
        return limit ? notifications.slice(0, limit) : notifications;
    },

    /**
     * Get count of unread notifications.
     * Pass `key` to decrypt if the data is stored encrypted.
     */
    getUnreadCount: async (key?: CryptoKey | null): Promise<number> => {
        const notifications = await storage.getNotifications(undefined, key);
        return notifications.filter(n => !n.read).length;
    },

    /**
     * Mark a notification as read.
     * Pass `key` to read and re-encrypt.
     */
    markAsRead: async (id: string, key?: CryptoKey | null): Promise<void> => {
        const notifications = await storage.getNotifications(undefined, key);
        const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
        if (key) {
            await storage.set({ notifications: await encryptData(key, updated) as any });
        } else {
            await storage.set({ notifications: updated });
        }
    },

    /**
     * Mark all notifications as read.
     * Pass `key` to read and re-encrypt.
     */
    markAllAsRead: async (key?: CryptoKey | null): Promise<void> => {
        const notifications = await storage.getNotifications(undefined, key);
        const updated = notifications.map(n => ({ ...n, read: true }));
        if (key) {
            await storage.set({ notifications: await encryptData(key, updated) as any });
        } else {
            await storage.set({ notifications: updated });
        }
    },

    /**
     * Clear all notifications.
     */
    clearNotifications: async (): Promise<void> => {
        await storage.set({ notifications: [] });
    },

    /**
     * Remove a specific notification.
     * Pass `key` to read and re-encrypt.
     */
    removeNotification: async (id: string, key?: CryptoKey | null): Promise<void> => {
        const notifications = await storage.getNotifications(undefined, key);
        const filtered = notifications.filter(n => n.id !== id);
        if (key) {
            await storage.set({ notifications: await encryptData(key, filtered) as any });
        } else {
            await storage.set({ notifications: filtered });
        }
    }
};
