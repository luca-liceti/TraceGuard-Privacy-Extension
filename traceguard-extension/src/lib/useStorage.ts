import { useState, useEffect } from 'react';
import { storage } from './storage';
import { AppState, UserSettings } from './types';

export function useAppState() {
    const [state, setState] = useState<AppState | null>(null);

    useEffect(() => {
        // Initial fetch
        storage.getState().then(setState);

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.state) {
                setState(changes.state.newValue as AppState);
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return state;
}

export function useSettings() {
    const [settings, setSettings] = useState<UserSettings | null>(null);

    useEffect(() => {
        storage.getSettings().then(setSettings);

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.settings) {
                setSettings(changes.settings.newValue as UserSettings);
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return settings;
}

export function useScoreHistory() {
    const [history, setHistory] = useState<import('./types').ScoreHistoryEntry[]>([]);

    useEffect(() => {
        chrome.storage.local.get('scoreHistory').then(res => {
            setHistory((res.scoreHistory || []) as import('./types').ScoreHistoryEntry[]);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.scoreHistory) {
                setHistory((changes.scoreHistory.newValue || []) as import('./types').ScoreHistoryEntry[]);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return history;
}

export function useActivityLogs() {
    const [logs, setLogs] = useState<import('./types').PIIDetectionEvent[]>([]);

    useEffect(() => {
        chrome.storage.local.get('piiDetections').then(res => {
            setLogs((res.piiDetections || []) as import('./types').PIIDetectionEvent[]);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.piiDetections) {
                setLogs((changes.piiDetections.newValue || []) as import('./types').PIIDetectionEvent[]);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return logs;
}

export function useDetectorLogs() {
    const [logs, setLogs] = useState<import('./types').DetectorLogEntry[]>([]);

    useEffect(() => {
        chrome.storage.local.get('detectorLogs').then(res => {
            setLogs((res.detectorLogs || []) as import('./types').DetectorLogEntry[]);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.detectorLogs) {
                setLogs((changes.detectorLogs.newValue || []) as import('./types').DetectorLogEntry[]);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    return logs;
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<import('./types').NotificationEvent[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Initial fetch
        chrome.storage.local.get('notifications').then(res => {
            const notifs = (res.notifications || []) as import('./types').NotificationEvent[];
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.notifications) {
                const notifs = (changes.notifications.newValue || []) as import('./types').NotificationEvent[];
                setNotifications(notifs);
                setUnreadCount(notifs.filter(n => !n.read).length);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const markAsRead = async (id: string) => {
        await storage.markAsRead(id);
    };

    const markAllAsRead = async () => {
        await storage.markAllAsRead();
    };

    const clearAll = async () => {
        await storage.clearNotifications();
    };

    const removeNotification = async (id: string) => {
        await storage.removeNotification(id);
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        removeNotification
    };
}

