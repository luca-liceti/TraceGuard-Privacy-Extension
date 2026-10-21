/**
 * Read a policy page the user did not open.
 *
 * `fetch` cannot do this job: this extension's own `connect-src` blocks the
 * request, the response is unrendered HTML, and it carries no `SameSite=Lax`
 * cookies. So each candidate is opened in an inactive tab, read through the
 * content script, and closed again. The tab is closed even when the read fails
 * or never answers, because a leaked background tab is worse than a missing
 * report.
 *
 * The browser is injected so the ordering and cleanup rules can be tested
 * without a real tab strip.
 */

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
    /** Open a URL in an inactive tab and resolve its tab id, or null if it could not be opened. */
    openTab(url: string): Promise<number | null>;
    /** Ask the tab's content script for policy text, retrying until the deadline. */
    readPage(tabId: number, timeoutMs: number): Promise<PolicyPageReply>;
    closeTab(tabId: number): Promise<void>;
}

export type PolicyCaptureResult =
    | { ok: true; url: string; title: string; text: string; attempted: number }
    | { ok: false; reason: 'no-candidates' | 'unreadable'; attempted: number };

/**
 * Try each candidate in order and return the first page that yields readable
 * policy text. Validation reuses the same rules as the on-page path, so a soft
 * 404 or a consent page is rejected exactly as it would be if the user had
 * opened it themselves.
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
        const tabId = await deps.openTab(candidate);
        if (tabId === null) continue;
        try {
            const reply = await deps.readPage(tabId, timeoutMs);
            if (reply.ok && reply.url && reply.title && reply.text) {
                const prepared = preparePrivacyPolicyText({
                    url: reply.url,
                    title: reply.title,
                    text: reply.text,
                });
                if (prepared.ok && prepared.text.length >= MIN_CAPTURE_TEXT_CHARS) {
                    return {
                        ok: true,
                        url: reply.url,
                        title: reply.title,
                        text: prepared.text,
                        attempted: index + 1,
                    };
                }
            }
        } finally {
            await deps.closeTab(tabId);
        }
    }

    return { ok: false, reason: 'unreadable', attempted: ordered.length };
}
