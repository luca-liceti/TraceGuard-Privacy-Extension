import type { NotificationEvent, UserSettings } from './types';

/**
 * The interrupt budget for system notifications.
 *
 * The level setting (silent, balanced, aggressive) says how loud the extension
 * may be, but on its own it allowed one system notification per navigation
 * below the threshold, and let the same domain notify again on its next visit.
 * A warning that arrives for the third time is not a warning any more; it is
 * the reason the fourth one goes unread. Record 0012 states the rule this
 * module implements: attention is spent where a decision is being made, and
 * never twice over a decision that has already been made.
 *
 * The decision is pure so the policy can be tested without a browser, and the
 * state it returns is what the caller persists for the current session. The
 * in-app notification list is deliberately not governed by this: a skipped
 * system notification is still recorded, so the history stays complete.
 */

export type NotificationSeverity = NotificationEvent['severity'];

/** A system notification that was actually shown during this session. */
export interface ShownNotification {
    /** The site the notification was about, or null when it had no subject. */
    domain: string | null;
    /** How urgent it was, which decides how it is rationed. */
    severity: NotificationSeverity;
    /** When it was shown, in epoch milliseconds. */
    at: number;
}

export type SkipReason =
    | 'notifications_off'
    | 'level_silent'
    | 'level_balanced_info'
    | 'domain_already_warned'
    | 'domain_cooldown'
    | 'session_cap';

export interface BudgetInput {
    domain: string | null;
    severity: NotificationSeverity;
    shown: ShownNotification[];
    now: number;
    settings: Pick<UserSettings, 'notifications' | 'notificationLevel'>;
}

export interface BudgetDecision {
    /** Whether the caller should raise a system notification. */
    show: boolean;
    /** Why it was skipped, for the diagnostics log. Null when it is shown. */
    reason: SkipReason | null;
    /** The session state to persist. Unchanged when the notification is skipped. */
    next: ShownNotification[];
}

/** Most system notifications in one session, whatever their severity. */
export const NOTIFICATION_SESSION_CAP = 5;

/** How long before a critical alert about the same domain may repeat. */
export const NOTIFICATION_DOMAIN_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Decides whether one notification is worth interrupting the user for.
 *
 * Order matters only for the reason reported: a notification that would be
 * suppressed twice over is reported by the more specific rule.
 */
export function evaluateNotificationBudget(input: BudgetInput): BudgetDecision {
    const { domain, severity, shown, now, settings } = input;
    const skip = (reason: SkipReason): BudgetDecision => ({ show: false, reason, next: shown });

    if (!settings.notifications) return skip('notifications_off');

    const level = settings.notificationLevel ?? 'balanced';
    if (level === 'silent') return skip('level_silent');
    if (level === 'balanced' && severity === 'info') return skip('level_balanced_info');

    const aboutDomain = domain === null ? [] : shown.filter((entry) => entry.domain === domain);

    // A warning is not worth repeating. The user has been told about this domain
    // already in this session, and repeating it is what teaches them to dismiss
    // the next one unread.
    if (severity === 'warning' && aboutDomain.length > 0) return skip('domain_already_warned');

    // A critical alert may repeat, because the site is dangerous and the user may
    // genuinely be re-deciding. It may not repeat on every navigation back and
    // forth, which is what the cooldown is for. Only a previous critical counts:
    // a recent warning must never swallow the escalation to critical.
    if (
        severity === 'critical' &&
        aboutDomain.some(
            (entry) => entry.severity === 'critical' && now - entry.at < NOTIFICATION_DOMAIN_COOLDOWN_MS
        )
    ) {
        return skip('domain_cooldown');
    }

    // The outer bound. Past this, everything is recorded and nothing is shown,
    // so a long session cannot become an alarm panel.
    if (shown.length >= NOTIFICATION_SESSION_CAP) return skip('session_cap');

    return { show: true, reason: null, next: [...shown, { domain, severity, at: now }] };
}

/**
 * Reads the persisted session state, tolerating anything unexpected.
 *
 * The value lives in session storage, so it is gone when the browser closes,
 * which is the definition of "this session" the policy is written against.
 */
export function readShownNotifications(value: unknown): ShownNotification[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (entry): entry is ShownNotification =>
            !!entry &&
            typeof entry === 'object' &&
            (typeof (entry as ShownNotification).domain === 'string' ||
                (entry as ShownNotification).domain === null) &&
            typeof (entry as ShownNotification).at === 'number' &&
            ['critical', 'warning', 'info'].includes((entry as ShownNotification).severity)
    );
}
