import React from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useExposureReport } from "@/lib/useStorage"
import { cn } from "@/lib/utils"
import { getSafetyConfig } from "@/lib/risk-utils"
import { categoryLabelKey } from "@/lib/exposure"
import type { ExposureSite, HandoverGroup, SurpriseReason, Watcher } from "@/lib/exposure"
import { ChevronDown, Clock, Eye, KeyRound, ShieldCheck } from "lucide-react"

/**
 * FOOTPRINT LEDGER - what you handed over, and who has seen you.
 *
 * Read-only by design: this page states what TraceGuard recorded and nothing
 * more. It cannot see the values typed into a form (only the field type), and it
 * does not claim to stop a site from keeping what it already has. Keeping that
 * honest is the whole point of the page.
 */

/** Count-aware label, so a single tracker never reads "1 trackers". */
function usePlural() {
    const { t } = useTranslation()
    return (count: number, one: string, many: string): string =>
        count === 1 ? t(one, { count }) : t(many, { count })
}

function formatDate(ts: number | null): string | null {
    // A null or non-finite timestamp has no date to show. `toLocaleDateString`
    // returns the string "Invalid Date" instead of throwing, so this guard is
    // what keeps that text out of the UI. No catch is needed, and a silent one
    // would have hidden a bad timestamp rather than showing nothing.
    if (ts === null || !Number.isFinite(ts)) return null
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

/** Every flag is explainable; the UI must show the reason, not just the flag. */
function useReasonLabel() {
    const { t } = useTranslation()
    return (reason: SurpriseReason): string => {
        switch (reason) {
            case 'single-visit': return t("Visited once")
            case 'dormant': return t("Not visited in a long time")
            case 'low-trust': return t("Entered while the site scored low")
            case 'not-recently-visited': return t("Not in your recent sites")
            default: return ''
        }
    }
}

/**
 * One site under one kind of data.
 *
 * Tapping it answers the question the row raises and cannot: a site that holds
 * your email usually holds more than that, and the same site reached through a
 * different card was the only place that was visible before.
 */
function SiteRow({
    site,
    reasonLabel,
    alsoHolds,
}: {
    site: ExposureSite
    reasonLabel: (r: SurpriseReason) => string
    alsoHolds: string[]
}) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = React.useState(false)
    const lastSeen = formatDate(site.lastSeen)

    return (
        <div className="py-2">
            <button
                type="button"
                onClick={() => setExpanded(value => !value)}
                aria-expanded={expanded}
                disabled={alsoHolds.length === 0}
                className={cn(
                    "flex w-full items-start justify-between gap-3 text-left",
                    alsoHolds.length > 0 && "cursor-pointer hover:opacity-80"
                )}
            >
                <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{site.domain}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                        {site.reasons.map(reason => (
                            <Badge
                                key={reason}
                                variant="outline"
                                className={cn(
                                    "text-[10px] font-medium shadow-none",
                                    "border-warning/30 bg-warning/10 text-warning"
                                )}
                            >
                                {reasonLabel(reason)}
                            </Badge>
                        ))}
                        {lastSeen && (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t("Last seen {{date}}", { date: lastSeen })}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {site.wss !== null && (
                        <span className={cn("text-sm font-bold", getSafetyConfig(site.wss).color)}>
                            {site.wss}
                        </span>
                    )}
                    {alsoHolds.length > 0 && (
                        <ChevronDown
                            className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                expanded && "rotate-180"
                            )}
                        />
                    )}
                </div>
            </button>
            {expanded && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {t("This site also holds: {{types}}", {
                        types: alsoHolds.map(fieldType => t(fieldType)).join(", "),
                    })}
                </p>
            )}
        </div>
    )
}

function HandoverCard({
    group,
    reasonLabel,
    alsoHoldsByDomain,
}: {
    group: HandoverGroup
    reasonLabel: (r: SurpriseReason) => string
    alsoHoldsByDomain: Record<string, string[]>
}) {
    const { t } = useTranslation()
    const plural = usePlural()

    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium capitalize">{t(group.fieldType)}</CardTitle>
                    <span className="text-xs text-muted-foreground shrink-0">
                        {plural(group.siteCount, "{{count}} site", "{{count}} sites")}
                    </span>
                </div>
                {group.surprisingCount > 0 && (
                    <CardDescription className="text-xs">
                        {t("{{count}} of these look like ones you may have forgotten", { count: group.surprisingCount })}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="p-4 pt-0 divide-y">
                {group.sites.map(site => (
                    <SiteRow
                        key={site.domain}
                        site={site}
                        reasonLabel={reasonLabel}
                        alsoHolds={(alsoHoldsByDomain[site.domain] ?? []).filter(
                            fieldType => fieldType !== group.fieldType
                        )}
                    />
                ))}
            </CardContent>
        </Card>
    )
}

/**
 * One tracker company.
 *
 * Expanding it names the sites it was seen on. That is the difference between
 * "Google covers 18 of 30 sites", which you cannot act on, and a list you can
 * paste into a blocker, which you can.
 */
function WatcherRow({ watcher, totalSites }: { watcher: Watcher; totalSites: number }) {
    const { t } = useTranslation()
    const plural = usePlural()
    const [expanded, setExpanded] = React.useState(false)
    const hasDomains = watcher.domains.length > 0

    return (
        <div className="py-2">
            <button
                type="button"
                onClick={() => setExpanded(value => !value)}
                aria-expanded={expanded}
                disabled={!hasDomains}
                className={cn(
                    "flex w-full items-start justify-between gap-3 text-left",
                    hasDomains && "cursor-pointer hover:opacity-80"
                )}
            >
                <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{watcher.organization}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                            {t("On {{count}} of {{total}} sites you visited", {
                                count: watcher.siteCount,
                                total: totalSites,
                            })}
                        </span>
                        {watcher.categories.map(category => (
                            <Badge key={category} variant="outline" className="text-[10px] shadow-none">
                                {t(categoryLabelKey(category))}
                            </Badge>
                        ))}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {plural(watcher.trackerCount, "{{count}} tracker", "{{count}} trackers")}
                    </span>
                    {hasDomains && (
                        <ChevronDown
                            className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                expanded && "rotate-180"
                            )}
                        />
                    )}
                </div>
            </button>
            {expanded && (
                <div className="mt-2 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("Sites it was seen on")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {watcher.domains.map(domain => (
                            <span
                                key={domain}
                                className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                                {domain}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function ExposurePage() {
    const { t } = useTranslation()
    const { report, isLoading } = useExposureReport()
    const reasonLabel = useReasonLabel()

    // Domain to every kind of data recorded there, so a site row can say what
    // else the site holds without a second aggregation pass in the ledger.
    const alsoHoldsByDomain = React.useMemo(() => {
        const map: Record<string, string[]> = {}
        for (const group of report.handedOver) {
            for (const site of group.sites) {
                if (!map[site.domain]) map[site.domain] = []
                map[site.domain].push(group.fieldType)
            }
        }
        return map
    }, [report.handedOver])

    return (
        <>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("Your Footprint")}</h1>
                <p className="text-muted-foreground mt-2">
                    {t("What you have handed over, and which tracker companies loaded on those sites. Built from your own browsing, stored only on this device.")}
                </p>
            </div>

            {isLoading ? (
                <div className="text-sm text-muted-foreground">{t("Loading...")}</div>
            ) : !report.hasData ? (
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">{t("Nothing to show yet")}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <CardDescription>
                            {t("This page fills in as you browse. It lists the personal data you enter, the sites that received it, and the companies whose trackers loaded alongside.")}
                        </CardDescription>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                    {/* What you handed over */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">{t("What you have handed over")}</h2>
                        </div>
                        {report.handedOver.length === 0 ? (
                            <Card>
                                <CardContent className="p-4 text-sm text-muted-foreground">
                                    {t("No personal data recorded yet.")}
                                </CardContent>
                            </Card>
                        ) : (
                            report.handedOver.map(group => (
                                <HandoverCard
                                    key={group.fieldType}
                                    group={group}
                                    reasonLabel={reasonLabel}
                                    alsoHoldsByDomain={alsoHoldsByDomain}
                                />
                            ))
                        )}
                    </div>

                    {/* Tracker companies on your sites. Titled by what the data is
                        rather than by "who has seen you", which read as an alarm
                        about something no reader can act on directly. */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">{t("Tracker companies on your sites")}</h2>
                        </div>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardDescription className="text-xs">
                                    {t("Tracker companies whose code loaded on the sites you visited, ranked by how much of your browsing they covered.")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 divide-y">
                                {report.watchers.length === 0 ? (
                                    <p className="py-2 text-sm text-muted-foreground">
                                        {t("No tracker organizations recorded yet.")}
                                    </p>
                                ) : (
                                    report.watchers.map(watcher => (
                                        <WatcherRow
                                            key={watcher.organization}
                                            watcher={watcher}
                                            totalSites={report.totals.sitesVisited}
                                        />
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </>
    )
}
