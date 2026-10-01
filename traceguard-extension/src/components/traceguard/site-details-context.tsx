"use client"

import React from "react"
import { SiteDetailsPanel } from "@/components/traceguard/site-details-panel"
import { useSiteCache } from "@/lib/useStorage"
import { getSafetyLevel } from "@/lib/risk-utils"
import type { SiteRiskData } from "@/lib/types"

/**
 * One site details panel for the whole dashboard.
 *
 * The panel used to be owned by `data-table.tsx`, so only the Overview table
 * could open it and every other page had to duplicate the state (or leave its
 * domains dead text). This provider owns a single panel and exposes
 * `openSiteDetails`, so a domain label anywhere in the dashboard opens the same
 * sheet without each page re-wiring it.
 *
 * A caller passes the exact journal row when it has one (`visit`); with just a
 * domain, the provider falls back to the cached analysis, which is what lets the
 * leaderboard and Your Footprint open sites they never loaded a journal row for.
 */

/** The subset of a journal visit the panel needs, so any page can pass one. */
export interface SiteDetailsVisit {
    timestamp: number
    wss: number
    safetyLevel: string
    details?: any
}

export interface SiteDetailsOptions {
    /** Exact journal row to open, when the caller has one. */
    visit?: SiteDetailsVisit | null
    /** Section id to scroll to and highlight, e.g. "inputs" for a PII alert. */
    highlightSection?: string
}

interface SiteDetailsContextValue {
    openSiteDetails: (domain: string, options?: SiteDetailsOptions) => void
    closeSiteDetails: () => void
}

const SiteDetailsContext = React.createContext<SiteDetailsContextValue | null>(null)

export function SiteDetailsProvider({ children }: { children: React.ReactNode }) {
    const { siteCache } = useSiteCache()
    const [target, setTarget] = React.useState<{ domain: string } & SiteDetailsOptions | null>(null)
    const [open, setOpen] = React.useState(false)

    const openSiteDetails = React.useCallback((domain: string, options?: SiteDetailsOptions) => {
        setTarget({ domain, ...options })
        setOpen(true)
    }, [])

    const closeSiteDetails = React.useCallback(() => setOpen(false), [])

    const value = React.useMemo(
        () => ({ openSiteDetails, closeSiteDetails }),
        [openSiteDetails, closeSiteDetails]
    )

    const cached: SiteRiskData | undefined = target ? siteCache[target.domain] : undefined
    const visit = target?.visit ?? null

    // Prefer the exact journal row when the caller opened one; otherwise derive
    // the score and level from the cached analysis so a bare domain still opens
    // a populated panel.
    const timestamp = visit?.timestamp
        ?? (cached && typeof cached.lastAnalyzed === "number" ? cached.lastAnalyzed : 0)
    const wss = visit?.wss ?? cached?.wss ?? 0
    const safetyLevel = visit?.safetyLevel ?? getSafetyLevel(cached?.wss ?? 0)

    return (
        <SiteDetailsContext.Provider value={value}>
            {children}
            <SiteDetailsPanel
                open={open}
                onOpenChange={setOpen}
                domain={target?.domain ?? ""}
                timestamp={timestamp}
                wss={wss}
                safetyLevel={safetyLevel}
                siteData={cached ?? null}
                legacyDetails={visit?.details}
                highlightSection={target?.highlightSection}
            />
        </SiteDetailsContext.Provider>
    )
}

export function useSiteDetails(): SiteDetailsContextValue {
    const ctx = React.useContext(SiteDetailsContext)
    if (!ctx) {
        throw new Error("useSiteDetails must be used within a SiteDetailsProvider")
    }
    return ctx
}
