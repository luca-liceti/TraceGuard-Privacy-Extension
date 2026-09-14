/**
 * =============================================================================
 * LOAD STATUS - Who actually stopped the request
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 * Cookies, trackers and network requests are each either 'active' (they loaded)
 * or stopped before they loaded. The second case used to be called 'blocked',
 * and that word claimed credit TraceGuard does not have: this extension holds no
 * blocking permission and cannot stop anything. What the value actually means is
 * that Chrome reported net::ERR_BLOCKED_BY_CLIENT, which is the browser itself or
 * a different extension doing the blocking.
 *
 * The distinction is not pedantry. A user who believes they are covered by
 * something that is not covering them may skip installing the thing that would.
 *
 * LEGACY VALUES:
 * 'blocked' is the pre-1.10.4 spelling. It is still on entries cached by older
 * builds, so it is read as stopped-before-loading while only the new spelling is
 * ever written. Keep the comparisons behind the helpers below rather than
 * against string literals, so a cached entry cannot silently read as active.
 * =============================================================================
 */

/** A cookie or tracker: it loaded, or something stopped it first. */
export type LoadStatus = 'active' | 'blockedByBrowser';

/** A network request: it completed, something stopped it, or it failed for an unrelated reason. */
export type RequestStatus = 'completed' | 'blockedByBrowser' | 'failed';

/** True when the browser (or another extension) stopped this before it loaded. */
export function isStoppedBeforeLoading(status: unknown): boolean {
    return status === 'blockedByBrowser' || status === 'blocked';
}

/**
 * Reads the stopped-before-loading count from an enriched summary.
 *
 * `blocked` is checked second because summaries cached before the rename carry
 * the old key and no new one, and would otherwise report zero.
 */
export function stoppedCount(summary: { blockedByBrowser?: number; blocked?: number } | undefined): number {
    return summary?.blockedByBrowser ?? summary?.blocked ?? 0;
}
