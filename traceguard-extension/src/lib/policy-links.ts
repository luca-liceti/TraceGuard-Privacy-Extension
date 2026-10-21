/**
 * Finding a site's privacy policy without making the user do it.
 *
 * Three tiers feed this module: ToS;DR's own document URLs, anchors found on
 * the page, and common paths probed on the site's origin. Ranking is pure so the
 * order can be tested without a browser or a network.
 */

/** Paths that commonly serve a policy, most likely first. Privacy beats terms beats cookies. */
export const POLICY_PATH_PROBES = [
    '/privacy',
    '/privacy-policy',
    '/privacy-notice',
    '/legal/privacy',
    '/legal/privacy-policy',
    '/policies/privacy',
    '/terms',
    '/terms-of-service',
    '/legal/terms',
    '/cookie-policy',
] as const;

/** Probing is the last resort, so it stays bounded. */
export const MAX_POLICY_PROBES = 8;
/** Opening a tab per candidate is expensive, so only the strongest few are tried. */
export const MAX_POLICY_CANDIDATES = 4;

export interface RawPolicyLink {
    href?: unknown;
    text?: unknown;
}

/** Two labels, with `www.` removed. Good enough for ranking, not for security decisions. */
function registrableHint(hostname: string): string {
    const labels = hostname.toLowerCase().replace(/^www\./, '').split('.');
    return labels.length <= 2 ? labels.join('.') : labels.slice(-2).join('.');
}

function isSamePageAnchor(candidate: URL, page: URL): boolean {
    return Boolean(candidate.hash)
        && candidate.origin === page.origin
        && candidate.pathname === page.pathname
        && candidate.search === page.search;
}

/**
 * Rank candidate links from a page, strongest first.
 *
 * Links to another registrable domain are kept only when the link itself says
 * "privacy policy", because a footer "Privacy" link to a marketing page is
 * common and a policy hosted on a sibling domain is not.
 */
export function rankPolicyLinks(raw: readonly RawPolicyLink[], pageUrl: string): string[] {
    let page: URL;
    try {
        page = new URL(pageUrl);
    } catch {
        return [];
    }

    const pageHost = page.hostname.toLowerCase();
    const pageSite = registrableHint(pageHost);
    const seen = new Set<string>();
    const scored: Array<{ url: string; score: number; order: number }> = [];

    raw.forEach((item, order) => {
        if (typeof item?.href !== 'string' || item.href.length > 2_048) return;
        let candidate: URL;
        try {
            candidate = new URL(item.href, page);
        } catch {
            return;
        }
        if (candidate.protocol !== 'https:' && candidate.protocol !== 'http:') return;
        if (isSamePageAnchor(candidate, page)) return;
        // A PDF policy cannot be read by a content script, so it is not a candidate.
        if (/\.(?:pdf|docx?|zip)$/i.test(candidate.pathname)) return;

        const anchorText = typeof item.text === 'string' ? item.text.toLowerCase().slice(0, 200) : '';
        const path = candidate.pathname.toLowerCase();

        let score = 0;
        if (/privacy/.test(anchorText) && /(policy|notice|statement)/.test(anchorText)) score += 5;
        else if (/privacy/.test(anchorText)) score += 3;
        if (/(^|\W)(terms|tos)(\W|$)/.test(anchorText)) score += 1;
        if (/cookie/.test(anchorText)) score += 1;

        if (/privacy[-_/ ]?(?:policy|notice|statement)/.test(path)) score += 4;
        else if (/\/privacy(?:\/|$)/.test(path)) score += 3;
        if (/\/legal(?:\/|$)|\/policies(?:\/|$)|\/terms(?:\/|$)/.test(path)) score += 1;

        const sameSite = registrableHint(candidate.hostname) === pageSite;
        if (candidate.hostname.toLowerCase() === pageHost) score += 1;
        // Off-site links need an explicit policy label; a bare "Legal" off-site is not worth a tab.
        if (!sameSite && score < 4) return;
        if (score <= 0) return;

        const key = `${candidate.origin}${candidate.pathname.replace(/\/$/, '')}${candidate.search}`;
        if (seen.has(key)) return;
        seen.add(key);
        scored.push({
            url: `${candidate.origin}${candidate.pathname}${candidate.search}`,
            score,
            order,
        });
    });

    return scored
        .sort((a, b) => b.score - a.score || a.order - b.order)
        .slice(0, MAX_POLICY_CANDIDATES)
        .map(item => item.url);
}

/** Documents ToS;DR already lists for a service, keeping only usable URLs. */
export function documentUrls(documents: readonly { url?: unknown }[] | undefined): string[] {
    if (!documents) return [];
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const document of documents) {
        if (typeof document?.url !== 'string' || document.url.length > 2_048) continue;
        let candidate: URL;
        try {
            candidate = new URL(document.url);
        } catch {
            continue;
        }
        if (candidate.protocol !== 'https:' && candidate.protocol !== 'http:') continue;
        const key = `${candidate.origin}${candidate.pathname}`;
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(key);
    }
    return urls;
}

/** Common policy paths on a site's origin, used only when the page yielded nothing. */
export function probeUrls(pageUrl: string): string[] {
    let page: URL;
    try {
        page = new URL(pageUrl);
    } catch {
        return [];
    }
    return POLICY_PATH_PROBES.slice(0, MAX_POLICY_PROBES).map(path => `${page.origin}${path}`);
}

/** Assemble the capture order: ToS;DR documents, then ranked anchors, then probes. */
export function policyCandidates(input: {
    pageUrl: string;
    documents?: readonly { url?: unknown }[];
    links: readonly RawPolicyLink[];
    includeProbes?: boolean;
}): string[] {
    const fromDocuments = documentUrls(input.documents);
    const fromLinks = rankPolicyLinks(input.links, input.pageUrl);
    const ordered = [...fromDocuments, ...fromLinks];
    if (ordered.length === 0 && input.includeProbes !== false) {
        return probeUrls(input.pageUrl);
    }
    // The capture step caps how many tabs it will open, so nothing is truncated here.
    return [...new Set(ordered)];
}
