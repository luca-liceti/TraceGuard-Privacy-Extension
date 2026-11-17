import { parseFragment } from 'parse5';

type HtmlNode = {
    nodeName: string;
    value?: string;
    tagName?: string;
    childNodes?: HtmlNode[];
};

export const MAX_POLICY_TEXT_CHARS = 30_000;
export const MIN_POLICY_TEXT_CHARS = 500;
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

/**
 * Select policy text from the largest semantic content container, then fall back
 * to page text. The caller supplies text after removing non-content containers.
 */
export function findReadablePolicyText(containers: readonly string[], bodyText: string): string | null {
    const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
    const candidate = containers
        .map(normalize)
        .filter(text => text.length >= MIN_POLICY_TEXT_CHARS && POLICY_MARKER.test(text))
        .sort((a, b) => b.length - a.length)[0];
    const fallback = normalize(bodyText);
    const text = candidate ?? (fallback.length >= MIN_POLICY_TEXT_CHARS && POLICY_MARKER.test(fallback) ? fallback : null);
    return text?.slice(0, MAX_POLICY_TEXT_CHARS) ?? null;
}

/** Extract policy-like text from static HTML without running scripts or loading resources. */
export function extractPolicyDocument(html: string): { title: string; text: string } | null {
    const root = parseFragment(html) as unknown as HtmlNode;
    const titles: string[] = [];
    const bodyText: string[] = [];
    const excluded = new Set(['script', 'style', 'noscript', 'svg', 'iframe', 'template', 'nav', 'footer', 'header', 'head', 'title']);

    const collect = (node: HtmlNode, target: string[]) => {
        if (node.nodeName === '#text') {
            if (node.value) target.push(node.value);
            return;
        }
        if (node.tagName === 'title') {
            const titleParts: string[] = [];
            for (const child of node.childNodes ?? []) collect(child, titleParts);
            titles.push(titleParts.join(' '));
            return;
        }
        if (node.tagName && excluded.has(node.tagName)) return;

        const isBlock = Boolean(node.tagName && /^(article|br|div|h[1-6]|li|p|section)$/.test(node.tagName));
        if (isBlock) target.push(' ');
        for (const child of node.childNodes ?? []) collect(child, target);
        if (isBlock) target.push(' ');
    };

    collect(root, bodyText);
    const title = titles.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    const text = findReadablePolicyText([], bodyText.join(' '));
    return title && text ? { title, text } : null;
}

/** Validate and bound visible text from a policy page. */
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
