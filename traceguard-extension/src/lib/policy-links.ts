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

/**
 * True for loopback, link-local, and private hosts.
 *
 * A page-controlled candidate must never make the worker fetch a local or LAN
 * address, so page links are also restricted to the page's registrable site.
 * ToS;DR document URLs are not page-controlled, but they are filtered here too.
 */
export function isPrivateHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) return true;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true;
    if (host === '0.0.0.0' || host === '::1') return true;

    if (host.includes(':')) {
        const first = host.split(':')[0];
        if (/^f[cd][0-9a-f]{0,2}$/.test(first)) return true; // fc00::/7
        if (/^fe[89ab][0-9a-f]?$/.test(first)) return true; // fe80::/10
        return false;
    }

    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) return false;
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    return a === 0
        || a === 10
        || a === 127
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168);
}

/**
 * Best-effort same-site check for page-controlled links.
 *
 * Without a public suffix list, this keeps the strictest useful rule: the two
 * hosts must be equal, or one must be a subdomain of the other after removing
 * `www.`. A policy on `policies.example.com` is accepted from `example.com`;
 * an unrelated `evil.co.uk` is not accepted from `shop.example.co.uk`.
 */
function isSameSiteHost(candidateHostname: string, pageHostname: string): boolean {
    const normalize = (host: string) => host.toLowerCase().replace(/^www\./, '');
    const candidate = normalize(candidateHostname);
    const page = normalize(pageHostname);
    if (!candidate.includes('.') || !page.includes('.')) return false;
    return candidate === page
        || candidate.endsWith(`.${page}`)
        || page.endsWith(`.${candidate}`);
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
 * Only links on the page's own site are kept: equality, or one host is a
 * subdomain of the other. A page cannot make the worker fetch an unrelated
 * host just by labelling the link "Privacy Policy".
 */
export function rankPolicyLinks(raw: readonly RawPolicyLink[], pageUrl: string): string[] {
    let page: URL;
    try {
        page = new URL(pageUrl);
    } catch {
        return [];
    }

    const pageHost = page.hostname.toLowerCase();
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

        const sameSite = isSameSiteHost(candidate.hostname, pageHost);
        if (candidate.hostname.toLowerCase() === pageHost) score += 1;
        // Only the page's own site may be probed from a page link. Otherwise a
        // page could label a local or unrelated URL "Privacy Policy" and make
        // the worker fetch it.
        if (!sameSite) return;
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
        if (isPrivateHost(candidate.hostname)) continue;
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
