/**
 * Tests for resilientLazy — the self-healing React.lazy wrapper used by the
 * dashboard. The key scenario: the extension updates while the dashboard tab is
 * open, the old hashed chunk disappears, and the dynamic import fails with
 * "Failed to fetch dynamically imported module". The wrapper must retry, then
 * hard-reload the page (once) so the tab boots the fresh build.
 */
import React, { Suspense, act, Component, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resilientLazy } from './resilient-lazy'

function fetchError(name = 'rankings-abc123.js'): Error {
    return new Error(
        `Failed to fetch dynamically imported module: chrome-extension://test-id/assets/${name}`,
    )
}

class CatchBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
    public state: { error?: Error } = {}
    public static getDerivedStateFromError(error: Error) {
        return { error }
    }
    public render() {
        if (this.state.error) {
            return <div data-testid="error">{this.state.error.message}</div>
        }
        return this.props.children
    }
}

describe('resilientLazy', () => {
    let container: HTMLDivElement
    let root: Root
    let reloadMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
        sessionStorage.clear()
        reloadMock = vi.fn()
        // happy-dom hands out a fresh Location object on every `window.location`
        // access, so spying on the instance never intercepts. Replace it with a
        // stable mock object instead.
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { ...window.location, reload: reloadMock },
        })
    })

    afterEach(() => {
        act(() => root.unmount())
        container.remove()
        vi.restoreAllMocks()
        vi.useRealTimers()
        sessionStorage.clear()
    })

    async function renderLazy(LazyPage: ReturnType<typeof resilientLazy>) {
        await act(async () => {
            root.render(
                <CatchBoundary>
                    <Suspense fallback={<div>loading</div>}>
                        <LazyPage />
                    </Suspense>
                </CatchBoundary>,
            )
        })
    }

    it('renders normally when the chunk loads', async () => {
        const Page = () => <div>rankings page</div>
        const loader = vi.fn().mockResolvedValue({ default: Page })
        const LazyPage = resilientLazy(loader)

        await renderLazy(LazyPage)

        expect(container.textContent).toBe('rankings page')
        expect(loader).toHaveBeenCalledTimes(1)
        expect(reloadMock).not.toHaveBeenCalled()
    })

    it('does not retry or reload on non-fetch errors (real bugs)', async () => {
        const boom = new TypeError('Cannot read properties of undefined')
        const loader = vi.fn().mockRejectedValue(boom)
        const LazyPage = resilientLazy(loader)

        await renderLazy(LazyPage)

        expect(container.querySelector('[data-testid="error"]')?.textContent).toContain(
            'Cannot read properties of undefined',
        )
        expect(loader).toHaveBeenCalledTimes(1)
        expect(reloadMock).not.toHaveBeenCalled()
    })

    it('retries once and renders when the retry succeeds', async () => {
        const Page = () => <div>help page</div>
        const loader = vi
            .fn()
            .mockRejectedValueOnce(fetchError())
            .mockResolvedValueOnce({ default: Page })
        const LazyPage = resilientLazy(loader)

        vi.useFakeTimers()
        await renderLazy(LazyPage)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        expect(loader).toHaveBeenCalledTimes(2)
        expect(container.textContent).toBe('help page')
        expect(reloadMock).not.toHaveBeenCalled()
    })

    it('hard-reloads the page when the chunk is gone after an update', async () => {
        const loader = vi.fn().mockRejectedValue(fetchError())
        const LazyPage = resilientLazy(loader)

        vi.useFakeTimers()
        await renderLazy(LazyPage)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        expect(loader).toHaveBeenCalledTimes(2) // initial attempt + one retry
        expect(reloadMock).toHaveBeenCalledTimes(1) // then the page reloads
    })

    it('does not reload-loop if the fresh build also fails', async () => {
        // Simulate a reload that already happened once this tab session
        sessionStorage.setItem('traceguard:chunk-reload-attempted', '1')
        const loader = vi.fn().mockRejectedValue(fetchError())
        const LazyPage = resilientLazy(loader)

        vi.useFakeTimers()
        await renderLazy(LazyPage)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(400)
        })

        // No second reload — the error surfaces to the ErrorBoundary instead
        expect(reloadMock).not.toHaveBeenCalled()
        expect(container.querySelector('[data-testid="error"]')?.textContent).toContain(
            'Failed to fetch dynamically imported module',
        )
    })
})
