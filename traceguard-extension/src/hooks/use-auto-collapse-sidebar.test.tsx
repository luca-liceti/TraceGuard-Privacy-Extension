/**
 * Tests for useAutoCollapseSidebar — the sidebar collapses automatically when
 * the window gets too small and expands again when it returns to a normal size.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAutoCollapseSidebar } from './use-auto-collapse-sidebar'

/** Controllable stand-in for window.matchMedia. */
function installMatchMedia(initialMatches: boolean) {
    const listeners = new Set<(event: { matches: boolean }) => void>()
    const mql: {
        matches: boolean
        media: string
        onchange: null
        addEventListener: ReturnType<typeof vi.fn>
        removeEventListener: ReturnType<typeof vi.fn>
        addListener: ReturnType<typeof vi.fn>
        removeListener: ReturnType<typeof vi.fn>
        dispatchEvent: ReturnType<typeof vi.fn>
        setMatches: (next: boolean) => void
    } = {
        matches: initialMatches,
        media: '',
        onchange: null,
        addEventListener: vi.fn(
            (_type: string, cb: (event: { matches: boolean }) => void) => {
                listeners.add(cb)
            },
        ),
        removeEventListener: vi.fn(
            (_type: string, cb: (event: { matches: boolean }) => void) => {
                listeners.delete(cb)
            },
        ),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        // placeholder, replaced below so it can reference `mql`
        setMatches: () => {},
    }
    // Test helper: simulate the window crossing the media query boundary.
    // Only fires the listeners on an actual transition, like the real API.
    mql.setMatches = (next: boolean) => {
        if (mql.matches === next) return // no crossing → no event
        mql.matches = next
        for (const cb of listeners) cb({ matches: next })
    }
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)
    return mql
}

describe('useAutoCollapseSidebar', () => {
    let container: HTMLDivElement
    let root: Root
    /** latest [open, setOpen] seen by the harness */
    let latest: readonly [boolean, (v: boolean) => void] | undefined

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
        latest = undefined
    })

    afterEach(() => {
        act(() => root.unmount())
        container.remove()
        vi.restoreAllMocks()
    })

    function Harness({ breakpoint }: { breakpoint?: number }) {
        latest = useAutoCollapseSidebar(breakpoint)
        return null
    }

    function render(breakpoint?: number) {
        act(() => {
            root.render(<Harness breakpoint={breakpoint} />)
        })
    }

    it('starts collapsed when the window is already small', () => {
        installMatchMedia(true) // matches "(max-width: 1023px)" → small window
        render()
        expect(latest?.[0]).toBe(false)
    })

    it('starts expanded when the window is a normal size', () => {
        installMatchMedia(false) // does not match → wide window
        render()
        expect(latest?.[0]).toBe(true)
    })

    it('collapses when the window shrinks below the breakpoint', () => {
        const mql = installMatchMedia(false)
        render()
        expect(latest?.[0]).toBe(true)

        act(() => mql.setMatches(true)) // window got small
        expect(latest?.[0]).toBe(false)
    })

    it('expands again when the window returns to a normal size', () => {
        const mql = installMatchMedia(true)
        render()
        expect(latest?.[0]).toBe(false)

        act(() => mql.setMatches(false)) // window back to normal
        expect(latest?.[0]).toBe(true)
    })

    it('respects a manual toggle until the next threshold crossing', () => {
        const mql = installMatchMedia(false)
        render()
        expect(latest?.[0]).toBe(true)

        // User manually collapses on a normal-size window
        act(() => latest?.[1](false))
        expect(latest?.[0]).toBe(false)

        // No crossing happens → stays as the user left it
        act(() => mql.setMatches(false)) // still wide
        expect(latest?.[0]).toBe(false)

        // Window shrinks below the breakpoint → auto-collapse (already false)
        act(() => mql.setMatches(true))
        expect(latest?.[0]).toBe(false)

        // Window returns to normal → auto-expand overrides the manual state
        act(() => mql.setMatches(false))
        expect(latest?.[0]).toBe(true)
    })

    it('honors a custom breakpoint', () => {
        const mql = installMatchMedia(true)
        render(1200)
        expect(latest?.[0]).toBe(false) // 1200 < 1200 → small

        act(() => mql.setMatches(false)) // crosses above 1200
        expect(latest?.[0]).toBe(true)
    })

    it('cleans up the media query listener on unmount', () => {
        const mql = installMatchMedia(false)
        render()
        const removeCalls = mql.removeEventListener.mock.calls.length

        act(() => root.unmount())
        expect(mql.removeEventListener).toHaveBeenCalledTimes(removeCalls + 1)
    })
})
