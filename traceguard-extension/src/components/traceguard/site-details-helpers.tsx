"use client"

import React from "react"

/**
 * Small presentational helpers for the site details panel. They were defined
 * inside site-details-panel.tsx; moving them here keeps that file focused on the
 * one `SiteDetailsPanel` component instead of carrying its building blocks too.
 */

type IconComponent = React.ComponentType<{ className?: string }>

/** Section title with icon */
export function SectionTitle({ icon: Icon, children }: { icon?: IconComponent; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-semibold text-base">{children}</h3>
        </div>
    )
}

/** Section subtitle / description */
export function SectionDescription({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs text-muted-foreground -mt-1">{children}</p>
    )
}

/** Inline summary stat pill */
export function SummaryStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
    return (
        <span className={highlight ? "font-medium text-foreground" : ""}>
            <span className="text-muted-foreground">{label}: </span>
            <span className={`font-semibold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
        </span>
    )
}

/**
 * A single user-friendly insight row, icon on the left, plain English on the right.
 * This matches the exact visual style of the Privacy Policy table rows.
 */
export function InsightRow({
    icon: Icon,
    iconClass,
    children,
    faded = false,
}: {
    icon: IconComponent
    iconClass: string
    children: React.ReactNode
    faded?: boolean
}) {
    return (
        <div className={`flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card ${faded ? "opacity-60" : ""}`}>
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconClass}`} />
            <span className="text-sm text-foreground leading-snug">{children}</span>
        </div>
    )
}
