/**
 * Read a policy page the user did not open.
 *
 * Fetch candidates first in the extension service worker using existing host
 * permissions and without cookies or other site credentials. Extract policy
 * text from static HTML without running scripts. Only if fetch cannot produce
 * usable text does the browser open one candidate in an inactive tab to handle
 * JavaScript-rendered or otherwise fetch-incompatible pages; every fallback tab
 * is closed.
 *
 * The browser is injected so the ordering and cleanup rules can be tested
 * without a real tab strip.
 */

import { logEvent } from '../lib/diagnostics';
import { preparePrivacyPolicyText } from '../lib/ai/policy-text';

export const MAX_CAPTURE_ATTEMPTS = 4;
export const CAPTURE_TIMEOUT_MS = 12_000;
/** Matches the minimum the policy text validator will accept. */
export const MIN_CAPTURE_TEXT_CHARS = 500;

export interface PolicyPageReply {
    ok?: boolean;
    url?: string;
    title?: string;
    text?: string;
    reason?: string;
}

export interface PolicyCaptureDeps {
    /** Fetch candidate HTML without site credentials, with a bounded response body. */
    fetchPage(url: string, timeoutMs: number): Promise<PolicyPageReply>;
    /** Open a URL in an inactive tab and resolve its tab id, or null if it could not be opened. */
    openTab(url: string): Promise<number | null>;
    /** Ask the tab's content script for policy text, retrying until the deadline. */
    readPage(tabId: number, timeoutMs: number): Promise<PolicyPageReply>;
    closeTab(tabId: number): Promise<void>;
}

export type PolicyCaptureResult =
    | { ok: true; url: string; title: string; text: string; attempted: number }
    | { ok: false; reason: 'no-candidates' | 'unreadable'; attempted: number };

function isUsablePolicyReply(reply: PolicyPageReply): reply is { ok: true; url: string; title: string; text: string } {
    if (!reply.ok || !reply.url || !reply.title || !reply.text) return false;
    const prepared = preparePrivacyPolicyText({ url: reply.url, title: reply.title, text: reply.text });
    return prepared.ok && prepared.text.length >= MIN_CAPTURE_TEXT_CHARS;
}

/**
 * Fetch candidates first, then use the rendered-page reader only for candidates
 * whose response cannot be validated. A soft 404 or consent page is rejected by
 * the same text checks used for the on-page path.
 */
export async function capturePolicyText(
    candidates: readonly string[],
    deps: PolicyCaptureDeps,
    options: { maxAttempts?: number; timeoutMs?: number } = {},
): Promise<PolicyCaptureResult> {
    const maxAttempts = options.maxAttempts ?? MAX_CAPTURE_ATTEMPTS;
    const timeoutMs = options.timeoutMs ?? CAPTURE_TIMEOUT_MS;
    const ordered = [...new Set(candidates)].slice(0, maxAttempts);

    if (ordered.length === 0) return { ok: false, reason: 'no-candidates', attempted: 0 };

    for (const [index, candidate] of ordered.entries()) {
        let reply: PolicyPageReply = { ok: false, reason: 'not-read' };
        try {
            reply = await deps.fetchPage(candidate, timeoutMs);
        } catch (error) {
            logEvent('background', 'warn', 'policy_fetch_unexpected_failed', 'A policy fetch failed unexpectedly', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        if (isUsablePolicyReply(reply)) {
            const prepared = preparePrivacyPolicyText(reply);
            if (prepared.ok) {
                return {
                    ok: true,
                    url: reply.url,
                    title: reply.title,
                    text: prepared.text,
                    attempted: index + 1,
                };
            }
        }
    }

    // Avoid opening a tab per failed candidate. Only try the highest-ranked
    // candidate in a rendered tab, and only after every fetch candidate failed.
    const fallbackCandidate = ordered[0];
    let tabId: number | null = null;
    try {
        tabId = await deps.openTab(fallbackCandidate);
        if (tabId === null) return { ok: false, reason: 'unreadable', attempted: ordered.length };
        const reply = await deps.readPage(tabId, timeoutMs);
        if (isUsablePolicyReply(reply)) {
            const prepared = preparePrivacyPolicyText(reply);
            if (prepared.ok) {
                return {
                    ok: true,
                    url: reply.url,
                    title: reply.title,
                    text: prepared.text,
                    attempted: ordered.length,
                };
            }
        }
    } catch (error) {
        logEvent('background', 'warn', 'policy_rendered_fallback_failed', 'The rendered policy fallback could not be read', {
            error: error instanceof Error ? error.message : String(error),
        });
    } finally {
        if (tabId !== null) {
            try {
                await deps.closeTab(tabId);
            } catch (error) {
                logEvent('background', 'warn', 'policy_fallback_tab_close_failed', 'Could not close the rendered policy fallback tab', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }

    return { ok: false, reason: 'unreadable', attempted: ordered.length };
}
