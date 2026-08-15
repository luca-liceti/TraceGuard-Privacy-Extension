/**
 * =============================================================================
 * LOCAL ERROR LOG — On-device diagnostics (zero telemetry)
 * =============================================================================
 *
 * Persists a small ring buffer of recent errors in chrome.storage.local so the
 * user can review/export them when reporting a bug. Nothing ever leaves the
 * device — this exists precisely so we do NOT need remote error reporting.
 */

export interface ErrorLogEntry {
    timestamp: number;
    message: string;
    context?: string;
}

const ERROR_LOG_KEY = 'errorLog';
const MAX_ENTRIES = 100;

/** Append an error entry, keeping only the most recent MAX_ENTRIES. */
export async function recordError(message: string, context?: string): Promise<void> {
    try {
        const result = await chrome.storage.local.get(ERROR_LOG_KEY);
        const existing: ErrorLogEntry[] = Array.isArray(result[ERROR_LOG_KEY]) ? result[ERROR_LOG_KEY] : [];
        const entry: ErrorLogEntry = { timestamp: Date.now(), message, context };
        const next = [...existing, entry].slice(-MAX_ENTRIES);
        await chrome.storage.local.set({ [ERROR_LOG_KEY]: next });
    } catch {
        // Error logging must never throw or recurse.
    }
}

/** Returns the recorded errors, oldest first. */
export async function getErrorLog(): Promise<ErrorLogEntry[]> {
    const result = await chrome.storage.local.get(ERROR_LOG_KEY);
    return Array.isArray(result[ERROR_LOG_KEY]) ? result[ERROR_LOG_KEY] : [];
}

/** Clears the local error log. */
export async function clearErrorLog(): Promise<void> {
    await chrome.storage.local.remove(ERROR_LOG_KEY);
}
