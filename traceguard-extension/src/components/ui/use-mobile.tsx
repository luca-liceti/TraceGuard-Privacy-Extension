import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      // Initial check handled by useState init
    }
    mql.addEventListener('change', onChange)
    // Initial check handled by useState init
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
