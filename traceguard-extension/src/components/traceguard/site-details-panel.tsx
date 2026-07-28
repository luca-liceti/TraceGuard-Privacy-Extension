"use client"

import React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    SiteRiskData,
    CookieDetail,
    TrackerDetail,
    HeaderAnalysisDetail,
    FingerprintingDetail,
    NetworkRequestDetail,
} from "@/lib/types"
import { format } from "date-fns"
import { CheckCircle, XCircle, ThumbsDown, Info, Globe, ShieldCheck, ShieldAlert, Network, Activity, Cookie, Key, FileText, Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// =============================================================================
// TYPE HELPERS
// =============================================================================

interface SiteDetailsPanelProps {
    siteData: SiteRiskData | null
    legacyDetails?: any
    domain: string
    timestamp: number
    wss: number
    safetyLevel: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

function getSafetyColor(level: string) {
    switch (level.toLowerCase()) {
        case "excellent":
        case "good":
            return "text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400 border-transparent"
        case "fair":
            return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-400 border-transparent"
        case "poor":
            return "text-orange-600 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400 border-transparent"
        case "critical":
            return "text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 border-transparent"
        default:
            return "text-muted-foreground bg-muted border-transparent"
    }
}

function getCategoryColor(category: string): string {
    switch (category.toLowerCase()) {
        case "marketing":
        case "advertising":
            return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
        case "analytics":
            return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
        case "social":
            return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
        case "functional":
        case "necessary":
        case "content":
        case "cdn":
            return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
        case "fingerprinting":
        case "cryptomining":
            return "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
        default:
            return "bg-muted text-muted-foreground"
    }
}

function getHeaderRatingClass(rating: string): string {
    switch (rating) {
        case "good": return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
        case "fair": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
        case "poor": return "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
        case "missing": return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
        default: return "bg-muted text-muted-foreground"
    }
}

function getGradeColorClass(grade: string): string {
    switch (grade?.toUpperCase()) {
        case "A": return "text-green-600 dark:text-green-400 font-bold";
        case "B": return "text-blue-600 dark:text-blue-400 font-bold";
        case "C": return "text-yellow-600 dark:text-yellow-400 font-bold";
        case "D": return "text-orange-600 dark:text-orange-400 font-bold";
        case "E":
        case "F": return "text-red-600 dark:text-red-400 font-bold";
        default: return "text-muted-foreground font-bold";
    }
}

function getRiskLevelClass(riskLevel: string): string {
    switch (riskLevel) {
        case "high": return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
        case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
        case "low": return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
        default: return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
    }
}

function getNetworkStatusClass(status: string): string {
    switch (status) {
        case "blocked": return "text-red-600 dark:text-red-400"
        case "failed": return "text-orange-600 dark:text-orange-400"
        default: return "text-green-600 dark:text-green-400"
    }
}

// Section wrapper for consistent styling
function SectionTitle({ icon: Icon, children }: { icon?: React.ComponentType<any>; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-semibold text-base">{children}</h3>
        </div>
    )
}

function SummaryStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
    return (
        <span className={highlight ? "font-medium text-foreground" : ""}>
            <span className="text-muted-foreground">{label}: </span>
            <span className={`font-semibold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
        </span>
    )
}

export function SiteDetailsPanel({
    siteData,
    legacyDetails,
    domain,
    timestamp,
    wss,
    safetyLevel,
    open,
    onOpenChange,
}: SiteDetailsPanelProps) {
    const enriched = siteData?.enrichedDetails
    
    const cookiesLegacy = legacyDetails?.cookies?.details ?? legacyDetails?.cookies
    const trackingLegacy = legacyDetails?.tracking?.details ?? legacyDetails?.tracking
    const inputsLegacy = legacyDetails?.inputs?.details ?? legacyDetails?.inputs
    const reputationLegacy = legacyDetails?.reputation?.details ?? legacyDetails?.reputation
    const policyLegacy = legacyDetails?.policy?.details ?? legacyDetails?.policy

    // Network requests: show tracker requests first, then other third-party, up to 50
    const networkItems: NetworkRequestDetail[] = React.useMemo(() => {
        const items = enriched?.networkRequests?.items ?? []
        const trackers = items.filter(r => r.isTracker)
        const thirdPartyNonTracker = items.filter(r => r.isThirdParty && !r.isTracker)
        const rest = items.filter(r => !r.isThirdParty && !r.isTracker)
        return [...trackers, ...thirdPartyNonTracker, ...rest].slice(0, 50)
    }, [enriched])

    const hasNetwork = enriched?.networkRequests && enriched.networkRequests.summary.total > 0
    const hasFingerprinting = enriched?.fingerprinting && enriched.fingerprinting.summary.totalAttempts > 0
    const hasHeaders = enriched?.headers?.items && enriched.headers.items.length > 0

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[700px] flex flex-col gap-0 p-0">
                {/* Fixed header */}
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle className="text-lg font-semibold">{domain}</SheetTitle>
                    <SheetDescription className="flex items-center gap-3">
                        <span>{timestamp ? format(new Date(timestamp), "MMM d, yyyy · HH:mm") : "Recent visit"}</span>
                        <span className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground">{wss}</span>
                            <Badge variant="outline" className={getSafetyColor(safetyLevel)}>
                                {safetyLevel}
                            </Badge>
                        </span>
                    </SheetDescription>
                </SheetHeader>

                {/* Scrollable content */}
                <ScrollArea className="flex-1">
                    <div className="px-6 py-4 flex flex-col gap-6">

                        {/* ─── Trackers ─────────────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Activity}>Trackers</SectionTitle>
                            {enriched?.trackers ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Total" value={enriched.trackers.summary.total} />
                                        <SummaryStat label="Active" value={enriched.trackers.summary.active} highlight={enriched.trackers.summary.active > 0} />
                                        <SummaryStat label="Blocked" value={enriched.trackers.summary.blocked} />
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="text-xs">Domain</TableHead>
                                                    <TableHead className="text-xs">Organization</TableHead>
                                                    <TableHead className="text-xs">Category</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched.trackers.items.map((t: TrackerDetail, idx: number) => (
                                                    <TableRow key={idx} className={t.status === 'blocked' ? 'opacity-50' : ''}>
                                                        <TableCell className="font-mono text-xs max-w-[180px] truncate" title={t.url}>
                                                            {t.domain}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{t.organization || '—'}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className={`text-xs ${getCategoryColor(t.category)}`}>
                                                                {t.category}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {t.status === 'blocked' ? (
                                                                <span className="line-through text-muted-foreground">Blocked</span>
                                                            ) : (
                                                                <span className="text-amber-600 dark:text-amber-400">Active</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {enriched.trackers.items.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                                                            No trackers detected.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : trackingLegacy ? (
                                <div className="flex flex-col gap-2 text-sm">
                                    <div>Total Detected: <span className="font-medium">{trackingLegacy.count || 0}</span></div>
                                    {trackingLegacy.knownTrackers?.length > 0 && (
                                        <div>
                                            <div className="font-medium mb-1">Known Trackers:</div>
                                            <div className="text-muted-foreground break-all">{trackingLegacy.knownTrackers.join(', ')}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No tracking data.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Cookies ──────────────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Cookie}>Cookies</SectionTitle>
                            {enriched?.cookies ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Total" value={enriched.cookies.summary.total} />
                                        <SummaryStat label="Active" value={enriched.cookies.summary.active} highlight={enriched.cookies.summary.active > 0} />
                                        <SummaryStat label="Blocked" value={enriched.cookies.summary.blocked} />
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="text-xs">Name</TableHead>
                                                    <TableHead className="text-xs">Category</TableHead>
                                                    <TableHead className="text-xs">Organization</TableHead>
                                                    <TableHead className="text-xs">Flags</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched.cookies.items.map((c: CookieDetail, idx: number) => (
                                                    <TableRow key={idx} className={c.status === 'blocked' ? 'opacity-50' : ''}>
                                                        <TableCell className="font-mono text-xs max-w-[140px] truncate" title={c.domain}>
                                                            {c.name}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className={`text-xs ${getCategoryColor(c.category)}`}>
                                                                {c.category}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{c.organization || '—'}</TableCell>
                                                        <TableCell className="text-xs space-x-1">
                                                            {c.httpOnly && <Badge variant="outline" className="text-[10px] px-1">HttpOnly</Badge>}
                                                            {c.secure && <Badge variant="outline" className="text-[10px] px-1">Secure</Badge>}
                                                            {c.isThirdParty && <Badge variant="outline" className="text-[10px] px-1 border-amber-300 text-amber-700 dark:text-amber-400">3rd Party</Badge>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {enriched.cookies.items.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                                                            No cookies detected.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : cookiesLegacy ? (
                                <div className="flex flex-col gap-4 text-sm">
                                    <div>
                                        <h4 className="font-semibold flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />Cross-Site Trackers
                                        </h4>
                                        <p className="text-muted-foreground mb-1">Highest penalty impact. These follow you across multiple websites.</p>
                                        <div>Found: {cookiesLegacy['cross-site-tracker'] || 0}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-yellow-500" />Analytics &amp; Third-Party Cookies
                                        </h4>
                                        <p className="text-muted-foreground mb-1">Moderate penalty impact. Standard HTTP tracking cookies.</p>
                                        <div>Found: {(cookiesLegacy.analytics || 0) + (cookiesLegacy['third-party'] || 0)}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />First-Party Cookies
                                        </h4>
                                        <p className="text-muted-foreground mb-1">No penalty impact. Essential for modern web functionality.</p>
                                        <div>Found: {cookiesLegacy['first-party'] || 0}</div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No cookie data.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Network Requests ─────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Network}>Network Requests</SectionTitle>
                            {hasNetwork ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Total" value={enriched!.networkRequests.summary.total} />
                                        <SummaryStat label="Third-party" value={enriched!.networkRequests.summary.thirdParty} highlight={enriched!.networkRequests.summary.thirdParty > 0} />
                                        <SummaryStat label="Tracker requests" value={enriched!.networkRequests.summary.trackerRequests} highlight={enriched!.networkRequests.summary.trackerRequests > 0} />
                                        <SummaryStat label="Blocked" value={enriched!.networkRequests.summary.blocked} />
                                    </div>
                                    {networkItems.length > 0 && (
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="text-xs">Domain</TableHead>
                                                        <TableHead className="text-xs">Type</TableHead>
                                                        <TableHead className="text-xs">Organization</TableHead>
                                                        <TableHead className="text-xs">Flags</TableHead>
                                                        <TableHead className="text-xs">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {networkItems.map((r: NetworkRequestDetail, idx: number) => (
                                                        <TableRow key={idx} className={r.status === 'blocked' ? 'opacity-60' : ''}>
                                                            <TableCell className="font-mono text-xs max-w-[160px] truncate" title={r.url}>
                                                                {r.domain}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground capitalize">
                                                                {r.resourceType}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {r.organization || '—'}
                                                            </TableCell>
                                                            <TableCell className="text-xs space-x-1">
                                                                {r.isTracker && (
                                                                    <Badge variant="secondary" className="text-[10px] px-1 bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                                                                        Tracker
                                                                    </Badge>
                                                                )}
                                                                {r.isThirdParty && !r.isTracker && (
                                                                    <Badge variant="outline" className="text-[10px] px-1 border-amber-300 text-amber-700 dark:text-amber-400">
                                                                        3rd Party
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className={`text-xs font-medium ${getNetworkStatusClass(r.status)}`}>
                                                                {r.status === 'completed' ? 'OK' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                    {enriched!.networkRequests.summary.total > 50 && (
                                        <p className="text-xs text-muted-foreground text-center">
                                            Showing top 50 of {enriched!.networkRequests.summary.total} requests (tracker &amp; third-party first).
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No network request data available.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Sensitive Input Fields ────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Key}>Sensitive Input Fields</SectionTitle>
                            {inputsLegacy ? (
                                <div className="text-sm space-y-2">
                                    <div>Total Detected: <span className="font-medium">{inputsLegacy.sensitive || 0}</span></div>
                                    {inputsLegacy.types?.length > 0 && (
                                        <div>
                                            <div className="font-medium mb-1">Field Types:</div>
                                            <div className="text-muted-foreground">{inputsLegacy.types.join(', ')}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No PII data.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Fingerprinting ───────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Fingerprint}>Fingerprinting</SectionTitle>
                            {hasFingerprinting ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm items-center">
                                        <SummaryStat label="Attempts" value={enriched!.fingerprinting.summary.totalAttempts} highlight />
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                            Risk:
                                            <Badge variant="secondary" className={getRiskLevelClass(enriched!.fingerprinting.summary.riskLevel)}>
                                                {enriched!.fingerprinting.summary.riskLevel}
                                            </Badge>
                                        </span>
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="text-xs">Technique</TableHead>
                                                    <TableHead className="text-xs">Script Domain</TableHead>
                                                    <TableHead className="text-xs">Organization</TableHead>
                                                    <TableHead className="text-xs">Risk</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched!.fingerprinting.items.map((f: FingerprintingDetail, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-xs font-medium capitalize">{f.technique}</TableCell>
                                                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[160px] truncate">
                                                            {f.scriptDomain || '—'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{f.organization || '—'}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className={`text-xs ${getRiskLevelClass(f.risk)}`}>
                                                                {f.risk}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                    No fingerprinting attempts detected.
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Reputation ───────────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={ShieldAlert}>Reputation</SectionTitle>
                            {reputationLegacy ? (
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="font-medium">Status: </span>
                                        {reputationLegacy.status || 'Unknown'}
                                    </div>
                                    {reputationLegacy.checks?.length > 0 && (
                                        <div className="text-muted-foreground">
                                            Checks: {reputationLegacy.checks.join(', ')}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No reputation data.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Privacy Policy ───────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={FileText}>Privacy Policy</SectionTitle>
                            {policyLegacy ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1.5 text-sm">
                                            <div>
                                                <span className="font-medium">Grade: </span>
                                                <span className={getGradeColorClass(policyLegacy.grade || '')}>
                                                    {policyLegacy.grade || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="text-muted-foreground">
                                                <span className="font-medium text-foreground">Source: </span>
                                                {policyLegacy.source === 'tosdr' ? 'ToS;DR database' : 'Local detection'}
                                            </div>
                                        </div>
                                        {policyLegacy.serviceId && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5"
                                                onClick={() => {
                                                    window.open(`https://tosdr.org/en/service/${policyLegacy.serviceId}`, '_blank');
                                                }}
                                            >
                                                <Globe className="h-3.5 w-3.5" />
                                                Open on ToS;DR
                                            </Button>
                                        )}
                                    </div>

                                    {policyLegacy.points && policyLegacy.points.length > 0 && (
                                        <ScrollArea className="h-[260px] border rounded-md">
                                            <Table>
                                                <TableBody>
                                                    {[...policyLegacy.points].sort((a: any, b: any) => {
                                                        const order: Record<string, number> = { blocker: 1, bad: 2, neutral: 3, good: 4 };
                                                        return (order[a.classification] || 5) - (order[b.classification] || 5);
                                                    }).map((p: any, idx: number) => {
                                                        let Icon = Info;
                                                        let iconClass = "text-muted-foreground";
                                                        if (p.classification === 'blocker') { Icon = XCircle; iconClass = "text-red-600 dark:text-red-400"; }
                                                        else if (p.classification === 'bad') { Icon = ThumbsDown; iconClass = "text-orange-500 dark:text-orange-400"; }
                                                        else if (p.classification === 'good') { Icon = CheckCircle; iconClass = "text-green-600 dark:text-green-400"; }
                                                        return (
                                                            <TableRow key={idx}>
                                                                <TableCell className="w-8 pl-4 pr-2">
                                                                    <Icon className={`h-4 w-4 ${iconClass}`} />
                                                                </TableCell>
                                                                <TableCell className="text-sm py-2.5">{p.title}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No policy data.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Security Headers ─────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <SectionTitle icon={ShieldCheck}>Security Headers</SectionTitle>
                                {hasHeaders && enriched?.headers?.summary && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Grade:</span>
                                        <span className={`text-base font-bold ${getGradeColorClass(enriched.headers.summary.grade)}`}>
                                            {enriched.headers.summary.grade}
                                        </span>
                                        <span className="text-muted-foreground">
                                            ({enriched.headers.summary.present}/{enriched.headers.summary.present + enriched.headers.summary.missing} present)
                                        </span>
                                    </div>
                                )}
                            </div>
                            {hasHeaders ? (
                                <TooltipProvider>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="text-xs">Header</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                    <TableHead className="text-xs">Rating</TableHead>
                                                    <TableHead className="text-xs w-8" />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched!.headers.items.map((h: HeaderAnalysisDetail, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-mono text-xs">{h.header}</TableCell>
                                                        <TableCell>
                                                            {h.present ? (
                                                                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                                    <CheckCircle className="h-3 w-3" /> Present
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                                                    <XCircle className="h-3 w-3" /> Missing
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className={`text-xs ${getHeaderRatingClass(h.rating)}`}>
                                                                {h.rating}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                                                                        <Info className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" className="max-w-[260px]">
                                                                    <p className="text-xs">{h.explanation}</p>
                                                                    {h.recommendation && (
                                                                        <p className="text-xs mt-1 text-muted-foreground">
                                                                            💡 {h.recommendation}
                                                                        </p>
                                                                    )}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TooltipProvider>
                            ) : (
                                <p className="text-sm text-muted-foreground">No security header data.</p>
                            )}
                        </div>
                        
                        {/* Bottom padding */}
                        <div className="h-4" />
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
