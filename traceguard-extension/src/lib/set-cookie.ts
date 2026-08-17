/**
 * =============================================================================
 * SET-COOKIE PARSER, Cookie metadata without the `cookies` permission
 * =============================================================================
 *
 * TraceGuard only ever needs a cookie's NAME and METADATA (domain, HttpOnly,
 * Secure, SameSite, expiry), never its value. A `Set-Cookie` response header
 * carries all of that, so the `cookies` permission (which grants read access
 * to every cookie value across the web) is unnecessary. The network monitor
 * observes `Set-Cookie` headers via `webRequest` and this parser extracts the
 * structured metadata used for cookie-type classification and the detail UI.
 */

export interface SetCookieRecord {
    name: string;
    domain: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None' | 'unspecified';
    expirationDate: number | null; // Unix ms; null = session cookie
}

/**
 * Parse a single `Set-Cookie` header value into structured metadata.
 *
 * `fallbackDomain` (the request host) is used when the header omits a
 * `Domain` attribute. Returns null when no cookie name can be parsed.
 *
 * Per RFC 6265, `Max-Age` takes precedence over `Expires`.
 */
export function parseSetCookie(headerValue: string, fallbackDomain: string): SetCookieRecord | null {
    if (!headerValue) return null;

    const parts = headerValue.split(';');
    const name = parts[0].split('=')[0].trim();
    if (!name) return null;

    let domain = fallbackDomain;
    let httpOnly = false;
    let secure = false;
    let sameSite: SetCookieRecord['sameSite'] = 'unspecified';
    let expiresTs: number | null = null;
    let maxAgeSeconds: number | null = null;

    for (let i = 1; i < parts.length; i++) {
        const attr = parts[i].trim();
        if (!attr) continue;

        const eq = attr.indexOf('=');
        const key = (eq === -1 ? attr : attr.slice(0, eq)).trim().toLowerCase();
        const rawValue = eq === -1 ? '' : attr.slice(eq + 1).trim();

        switch (key) {
            case 'domain':
                if (rawValue) domain = rawValue.replace(/^\./, '').toLowerCase();
                break;
            case 'httponly':
                httpOnly = true;
                break;
            case 'secure':
                secure = true;
                break;
            case 'samesite': {
                const s = rawValue.toLowerCase();
                if (s === 'strict') sameSite = 'Strict';
                else if (s === 'lax') sameSite = 'Lax';
                else if (s === 'none') sameSite = 'None';
                break;
            }
            case 'max-age': {
                const seconds = Number(rawValue);
                if (Number.isFinite(seconds) && seconds >= 0) maxAgeSeconds = seconds;
                break;
            }
            case 'expires': {
                const ts = Date.parse(rawValue);
                if (Number.isFinite(ts)) expiresTs = ts;
                break;
            }
            default:
                break;
        }
    }

    const expirationDate = maxAgeSeconds !== null ? Date.now() + maxAgeSeconds * 1000 : expiresTs;

    return { name, domain, httpOnly, secure, sameSite, expirationDate };
}
