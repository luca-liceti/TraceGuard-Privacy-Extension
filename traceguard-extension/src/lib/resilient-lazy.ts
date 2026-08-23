/**
 * =============================================================================
 * RESILIENT LAZY LOADING - Self-healing React.lazy for the dashboard
 * =============================================================================
 *
 * WHY THIS EXISTS:
 * The dashboard code-splits its pages with React.lazy, so each page is a
 * separate hashed chunk (e.g. `assets/rankings-<hash>.js`). Chrome updates the
 * extension in the background while the dashboard tab is often left open. The
 * open tab keeps running the OLD entry JS, which references OLD chunk hashes
 * that the NEW version no longer ships. The dynamic `import()` then fails with:
 *
 *   Failed to fetch dynamically imported module:
 *   chrome-extension://<id>/assets/rankings-<oldhash>.js
 *
 * That rejection crashes the whole dashboard (the error card's "Try again" can
 * never help, because the file is gone for good).
 *
 * WHAT THIS DOES:
 * - Retries the import once (covers transient failures).
 * - If the chunk is still missing, hard-reloads the page. A reload fetches the
 *   CURRENT build's entry JS, which references the CURRENT chunks, so the
 *   dashboard comes back working on the new version.
 * - A sessionStorage guard prevents reload loops if the fresh build also fails
 *   (then the normal ErrorBoundary fallback takes over instead).
 * =============================================================================
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOADED_FLAG = 'traceguard:chunk-reload-attempted'

const CHUNK_FETCH_ERROR = /Failed to fetch dynamically imported module/i

function isChunkFetchError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err)
    return CHUNK_FETCH_ERROR.test(msg)
}

function markReloadAttempted(): boolean {
    try {
        if (sessionStorage.getItem(RELOADED_FLAG)) return true
        sessionStorage.setItem(RELOADED_FLAG, '1')
        return false
    } catch {
        // sessionStorage unavailable (e.g. sandboxed context): allow one reload
        return false
    }
}

/**
 * Like React.lazy, but self-heals when a code-split chunk goes stale after an
 * extension update. All other errors (bugs inside the loaded module, missing
 * default export, etc.) reject normally so the ErrorBoundary handles them.
 */
export function resilientLazy<T extends ComponentType<any>>(
    loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
    const load = async () => {
        try {
            return await loader()
        } catch (err) {
            // Only auto-heal module-fetch failures, not code errors.
            if (!isChunkFetchError(err)) throw err

            // Retry once after a short delay — covers transient failures.
            try {
                await new Promise((resolve) => setTimeout(resolve, 300))
                return await loader()
            } catch (secondErr) {
                // Chunk is gone for good (extension updated). Reload the page so
                // it boots the fresh build — but only once per tab session.
                if (markReloadAttempted()) throw secondErr
                window.location.reload()
                // Never resolves — the page is reloading.
                return new Promise<{ default: T }>(() => {})
            }
        }
    }
    return lazy(load)
}
