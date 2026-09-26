import { describe, it, expect } from 'vitest';
import {
    evaluateNotificationBudget,
    readShownNotifications,
    NOTIFICATION_DOMAIN_COOLDOWN_MS,
    NOTIFICATION_SESSION_CAP,
    type ShownNotification,
} from './notification-budget';

const NOW = 1_800_000_000_000;

const settings = (overrides: Partial<{ notifications: boolean; notificationLevel: 'silent' | 'balanced' | 'aggressive' }> = {}) => ({
    notifications: true,
    notificationLevel: 'balanced' as const,
    ...overrides,
});

const shown = (entries: Array<Partial<ShownNotification>> = []): ShownNotification[] =>
    entries.map((entry) => ({ domain: 'example.com', severity: 'warning', at: NOW - 1000, ...entry }));

describe('evaluateNotificationBudget', () => {
    it('shows a warning for a domain that has not been warned about', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'warning',
            shown: [],
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(true);
        expect(decision.reason).toBeNull();
        expect(decision.next).toEqual([{ domain: 'example.com', severity: 'warning', at: NOW }]);
    });

    it('never shows anything when notifications are turned off', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'critical',
            shown: [],
            now: NOW,
            settings: settings({ notifications: false }),
        });

        expect(decision.show).toBe(false);
        expect(decision.reason).toBe('notifications_off');
    });

    it('never shows anything at the silent level', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'critical',
            shown: [],
            now: NOW,
            settings: settings({ notificationLevel: 'silent' }),
        });

        expect(decision.show).toBe(false);
        expect(decision.reason).toBe('level_silent');
    });

    it('drops informational notices at the balanced level but keeps them at aggressive', () => {
        const base = { domain: 'example.com', severity: 'info' as const, shown: [], now: NOW };

        expect(evaluateNotificationBudget({ ...base, settings: settings() }).reason).toBe('level_balanced_info');
        expect(evaluateNotificationBudget({ ...base, settings: settings({ notificationLevel: 'aggressive' }) }).show).toBe(true);
    });

    it('warns about a domain only once per session', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'warning',
            shown: shown([{ domain: 'example.com', severity: 'warning' }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(false);
        expect(decision.reason).toBe('domain_already_warned');
    });

    it('does not let one domain silence another', () => {
        const decision = evaluateNotificationBudget({
            domain: 'other.com',
            severity: 'warning',
            shown: shown([{ domain: 'example.com', severity: 'warning' }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(true);
    });

    it('does not repeat a critical alert inside the cooldown', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'critical',
            shown: shown([{ domain: 'example.com', severity: 'critical', at: NOW - NOTIFICATION_DOMAIN_COOLDOWN_MS + 1 }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(false);
        expect(decision.reason).toBe('domain_cooldown');
    });

    it('repeats a critical alert once the cooldown has passed', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'critical',
            shown: shown([{ domain: 'example.com', severity: 'critical', at: NOW - NOTIFICATION_DOMAIN_COOLDOWN_MS }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(true);
    });

    it('escalates from a warning to a critical for the same domain', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'critical',
            shown: shown([{ domain: 'example.com', severity: 'warning' }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(true);
    });

    it('does not follow a critical with a warning for the same domain', () => {
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'warning',
            shown: shown([{ domain: 'example.com', severity: 'critical' }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(false);
        expect(decision.reason).toBe('domain_already_warned');
    });

    it('stops showing anything once the session cap is reached', () => {
        const full = Array.from({ length: NOTIFICATION_SESSION_CAP }, (_, i) =>
            ({ domain: `site${i}.com`, severity: 'critical' as const, at: NOW - 1000 }));

        const decision = evaluateNotificationBudget({
            domain: 'fresh.com',
            severity: 'critical',
            shown: full,
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(false);
        expect(decision.reason).toBe('session_cap');
    });

    it('applies no per-domain rule to a notification with no subject', () => {
        const decision = evaluateNotificationBudget({
            domain: null,
            severity: 'warning',
            shown: shown([{ domain: null, severity: 'warning' }]),
            now: NOW,
            settings: settings(),
        });

        expect(decision.show).toBe(true);
    });

    it('leaves the persisted state untouched when a notification is skipped', () => {
        const existing = shown([{ domain: 'example.com', severity: 'warning' }]);
        const decision = evaluateNotificationBudget({
            domain: 'example.com',
            severity: 'warning',
            shown: existing,
            now: NOW,
            settings: settings(),
        });

        expect(decision.next).toBe(existing);
    });
});

describe('readShownNotifications', () => {
    it('returns an empty list for anything that is not an array', () => {
        expect(readShownNotifications(undefined)).toEqual([]);
        expect(readShownNotifications(null)).toEqual([]);
        expect(readShownNotifications('nonsense')).toEqual([]);
        expect(readShownNotifications({ domain: 'a.com' })).toEqual([]);
    });

    it('keeps well-formed entries and drops the rest', () => {
        const value = [
            { domain: 'a.com', severity: 'warning', at: NOW },
            { domain: 'b.com', severity: 'not-a-severity', at: NOW },
            { domain: 42, severity: 'warning', at: NOW },
            { domain: 'c.com', severity: 'critical', at: 'soon' },
            null,
        ];

        expect(readShownNotifications(value)).toEqual([{ domain: 'a.com', severity: 'warning', at: NOW }]);
    });
});
