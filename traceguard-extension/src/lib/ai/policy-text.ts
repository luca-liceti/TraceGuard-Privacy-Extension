export const MAX_POLICY_TEXT_CHARS = 30_000;
const MIN_POLICY_TEXT_CHARS = 500;
/** Text has to look like a policy, whichever document it came from. */
export const POLICY_MARKER = /privacy\s+polic|privacy\s+notice|personal\s+data|data\s+protection|information\s+we\s+collect/i;
/**
 * A page is worth reading when its address or title names a legal document. Terms
 * and cookie pages count: ToS;DR's own document lists often point at them, and the
 * text check above still has to pass before anything is returned.
 */
export const POLICY_PAGE_MARKER = /privacy|data[-_/ ]?protection|personal[-_/ ]?data|terms|cookie|legal/i;

export type PolicyTextResult =
    | { ok: true; text: string; truncated: boolean }
    | { ok: false; reason: 'invalid-url' | 'not-policy-page' | 'text-too-short' | 'not-policy-text' };

/** Validate and bound visible text from the policy page the user chose to analyze. */
export function preparePrivacyPolicyText(input: {
    url: string;
    title: string;
    text: string;
}): PolicyTextResult {
    let page: URL;
    try {
        page = new URL(input.url);
    } catch {
        return { ok: false, reason: 'invalid-url' };
    }
    if (page.protocol !== 'https:' && page.protocol !== 'http:') {
        return { ok: false, reason: 'invalid-url' };
    }
    if (!POLICY_PAGE_MARKER.test(`${page.pathname} ${input.title}`)) {
        return { ok: false, reason: 'not-policy-page' };
    }

    const normalized = input.text.replace(/\s+/g, ' ').trim();
    if (normalized.length < MIN_POLICY_TEXT_CHARS) {
        return { ok: false, reason: 'text-too-short' };
    }
    if (!POLICY_MARKER.test(normalized)) {
        return { ok: false, reason: 'not-policy-text' };
    }

    return {
        ok: true,
        text: normalized.slice(0, MAX_POLICY_TEXT_CHARS),
        truncated: normalized.length > MAX_POLICY_TEXT_CHARS,
    };
}
