/**
 * =============================================================================
 * USE AUTO-COLLAPSE SIDEBAR - Responsive sidebar collapse
 * =============================================================================
 *
 * Auto-collapses the dashboard sidebar when the window gets too small and
 * expands it again when the window returns to a normal size.
 *
 * HOW IT WORKS:
 * - Uses a matchMedia query on the breakpoint, so state only changes when the
 *   window actually CROSSES the threshold (not on every resize).
 * - The initial state reflects the window width at mount, so opening the
 *   dashboard in a small window starts collapsed.
 * - Manual toggles (via the returned setter) are respected until the next
 *   threshold crossing — we don't fight the user mid-session.
 *
 * NOTE: this applies to the desktop sidebar only. Below the mobile breakpoint
 * (768px) the shadcn Sidebar renders a floating Sheet instead, which has its
 * own separate open state.
 * =============================================================================
 */
import * as React from "react"

// Below this width the expanded sidebar (256px) leaves too little room for
// content, so it collapses to icon mode (48px).
export const SIDEBAR_AUTO_COLLAPSE_BREAKPOINT = 1024

export function useAutoCollapseSidebar(breakpoint = SIDEBAR_AUTO_COLLAPSE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint - 1}px)`
  const [open, setOpen] = React.useState<boolean>(() => !window.matchMedia(query).matches)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => {
      setOpen(!mql.matches)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return [open, setOpen] as const
}
