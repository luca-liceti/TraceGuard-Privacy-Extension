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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    SiteRiskData,
    CookieDetail,
    TrackerDetail,
    HeaderAnalysisDetail,
    FingerprintingDetail,
    NetworkRequestDetail,
} from "@/lib/types"
import { format } from "date-fns"
import {
    CircleCheck, XCircle, AlertTriangle, ThumbsDown, Info, Globe,
    ShieldUser, OctagonAlert, Network, Activity, Cookie, Key,
    FileText, Fingerprint, ChevronDown, ChevronRight, ShieldAlert,
    ShieldCheck, Eye, Lock, Megaphone, BarChart, Share2, Wrench
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    getSafetyTextColor, getSafetyBgColor, getCategoryBadge,
    getHeaderRatingBadge, getGradeTextColor, getRiskLevelBadge,
    getNetworkStatusTextColor, getIndicatorTextColor
} from "@/lib/theme-utils"

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

// =============================================================================
// SHARED HELPER COMPONENTS
// =============================================================================

/** Section title with icon */
function SectionTitle({ icon: Icon, children }: { icon?: React.ComponentType<any>; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-semibold text-base">{children}</h3>
        </div>
    )
}

/** Section subtitle / description */
function SectionDescription({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs text-muted-foreground -mt-1">{children}</p>
    )
}

/** Inline summary stat pill */
function SummaryStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
    return (
        <span className={highlight ? "font-medium text-foreground" : ""}>
            <span className="text-muted-foreground">{label}: </span>
            <span className={`font-semibold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
        </span>
    )
}

/**
 * A single user-friendly insight row — icon on the left, plain English on the right.
 * This matches the exact visual style of the Privacy Policy table rows.
 */
function InsightRow({
    icon: Icon,
    iconClass,
    children,
    faded = false,
}: {
    icon: React.ComponentType<any>
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

/**
 * A collapsible "Show technical details" wrapper with a standardized table inside.
 * All technical tables across every section use this same container.
 */
function TechnicalDetails({ children, itemCount }: { children: React.ReactNode; itemCount?: number }) {
    const [open, setOpen] = React.useState(false)
    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 select-none">
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {open ? "Hide" : "Show"} technical details
                    {!open && itemCount !== undefined && (
                        <span className="ml-1 text-muted-foreground/60">({itemCount})</span>
                    )}
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-2 rounded-md border overflow-hidden">
                    {children}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

/**
 * The unified scrollable table body — applied to all technical detail tables.
 * Any table with more than 5 items gets a fixed-height scroll container.
 */
function ScrollableTableBody({ children, itemCount }: { children: React.ReactNode; itemCount: number }) {
    if (itemCount > 5) {
        return (
            <div className="max-h-[240px] overflow-y-auto">
                <table className="w-full caption-bottom text-sm">
                    <tbody className="[&_tr:last-child]:border-0">
                        {children}
                    </tbody>
                </table>
            </div>
        )
    }
    return (
        <TableBody>
            {children}
        </TableBody>
    )
}

// =============================================================================
// FINGERPRINTING TECHNIQUE DESCRIPTIONS
// =============================================================================

const FINGERPRINT_DESCRIPTIONS: Record<string, string> = {
    canvas: "Creates an invisible image in your browser to generate a unique ID",
    webgl: "Uses your graphics card to generate a hardware-level device fingerprint",
    audio: "Plays silent audio to detect subtle differences in your audio hardware",
    font: "Measures which fonts you have installed to build a unique profile",
    navigator: "Reads your browser version, OS, language, and plugin list",
    screen: "Collects your screen size, resolution, and color depth",
    battery: "Reads your battery level and charging status to identify you",
    webrtc: "Exposes your real IP address even when using a VPN",
}

const FINGERPRINT_RISK_LABELS: Record<string, string> = {
    high: "High risk",
    medium: "Medium risk",
    low: "Low risk",
}

// =============================================================================
// HEADER FRIENDLY NAMES
// =============================================================================

const HEADER_FRIENDLY_NAMES: Record<string, string> = {
    "Content-Security-Policy": "Content security policy — restricts what code can run on the page",
    "X-Frame-Options": "Clickjacking protection — prevents this page from being embedded elsewhere",
    "Strict-Transport-Security": "HTTPS enforced — your connection must be encrypted",
    "X-Content-Type-Options": "MIME sniffing blocked — prevents browsers from misinterpreting files",
    "Referrer-Policy": "Referrer privacy — limits what URL info is shared with other sites",
    "Permissions-Policy": "Browser permissions locked — restricts access to camera, mic, location",
    "X-XSS-Protection": "Cross-site scripting filter — legacy protection against script injection",
    "Cache-Control": "Cache control — defines how responses are stored by browsers",
    "Cross-Origin-Opener-Policy": "Cross-origin isolation — prevents other sites from accessing this window",
    "Cross-Origin-Embedder-Policy": "Cross-origin embedding blocked — restricts cross-origin resource loads",
    "Cross-Origin-Resource-Policy": "Cross-origin resource policy — controls who can load this site's resources",
}

function getHeaderFriendlyName(header: string, explanation: string): string {
    return HEADER_FRIENDLY_NAMES[header] ?? explanation
}

// =============================================================================
// CATEGORY FRIENDLY DESCRIPTIONS
// =============================================================================

const COOKIE_CATEGORY_DESCRIPTIONS: Record<string, { label: string; description: string; iconClass: string; icon: React.ComponentType<any> }> = {
    marketing: { label: "marketing", description: "help advertisers target you with personalized ads", iconClass: getIndicatorTextColor('error'), icon: Megaphone },
    advertising: { label: "advertising", description: "help advertisers target you with personalized ads", iconClass: getIndicatorTextColor('error'), icon: Megaphone },
    analytics: { label: "analytics", description: "track how you interact with this page", iconClass: getIndicatorTextColor('warning'), icon: BarChart },
    social: { label: "social", description: "enable social sharing and login features", iconClass: getIndicatorTextColor('warning'), icon: Share2 },
    functional: { label: "functional", description: "remember your preferences and settings", iconClass: getIndicatorTextColor('success'), icon: Wrench },
    necessary: { label: "necessary", description: "keep the site working properly (safe)", iconClass: getIndicatorTextColor('success'), icon: CircleCheck },
    unclassified: { label: "unclassified", description: "have an unknown purpose", iconClass: "text-muted-foreground", icon: Info },
}

const TRACKER_CATEGORY_DESCRIPTIONS: Record<string, { description: string; iconClass: string }> = {
    advertising: { description: "advertising tracker is collecting your browsing behaviour for ads", iconClass: getIndicatorTextColor('error') },
    analytics: { description: "analytics tracker is monitoring how you use this page", iconClass: getIndicatorTextColor('warning') },
    social: { description: "social media tracker is following your activity", iconClass: getIndicatorTextColor('warning') },
    content: { description: "content tracker is active on this page", iconClass: "text-muted-foreground" },
    fingerprinting: { description: "fingerprinting tracker is identifying your device", iconClass: getIndicatorTextColor('error') },
    cryptomining: { description: "cryptomining tracker is using your device's resources", iconClass: getIndicatorTextColor('error') },
    functional: { description: "functional tracker provides site features", iconClass: getIndicatorTextColor('success') },
    cdn: { description: "content delivery service loaded assets for this page", iconClass: getIndicatorTextColor('success') },
    unknown: { description: "tracker of unknown type is active", iconClass: "text-muted-foreground" },
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

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
    const [policyFilter, setPolicyFilter] = React.useState("all")
    const enriched = siteData?.enrichedDetails

    const cookiesLegacy = legacyDetails?.cookies?.details ?? legacyDetails?.cookies
    const trackingLegacy = legacyDetails?.tracking?.details ?? legacyDetails?.tracking
    const inputsLegacy = legacyDetails?.inputs?.details ?? legacyDetails?.inputs
    const reputationLegacy = legacyDetails?.reputation?.details ?? legacyDetails?.reputation
    const policyLegacy = legacyDetails?.policy?.details ?? legacyDetails?.policy

    // Network requests: tracker first, then third-party, then rest, capped at 50
    const networkItems: NetworkRequestDetail[] = React.useMemo(() => {
        const items = enriched?.networkRequests?.items ?? []
        const trackers = items.filter(r => r.isTracker)
        const thirdPartyNonTracker = items.filter(r => r.isThirdParty && !r.isTracker)
        const rest = items.filter(r => !r.isThirdParty && !r.isTracker)
        return [...trackers, ...thirdPartyNonTracker, ...rest].slice(0, 50)
    }, [enriched])

    // Only show tracker + third-party in the technical table (same-site requests are noise)
    const networkTableItems = networkItems.filter(r => r.isTracker || r.isThirdParty)

    const hasNetwork = enriched?.networkRequests && enriched.networkRequests.summary.total > 0
    const hasFingerprinting = enriched?.fingerprinting && enriched.fingerprinting.summary.totalAttempts > 0
    const hasHeaders = enriched?.headers?.items && enriched.headers.items.length > 0

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[700px] flex flex-col gap-0 p-0">
                {/* ─── Fixed Header ────────────────────────────────── */}
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle className="text-lg font-semibold">{domain}</SheetTitle>
                    <SheetDescription className="flex items-center gap-3">
                        <span>{timestamp ? format(new Date(timestamp), "MMM d, yyyy · HH:mm") : "Recent visit"}</span>
                        <span className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground">{wss}</span>
                            <Badge variant="outline" className={`px-2.5 py-0.5 mt-1 border-transparent ${getSafetyBgColor(safetyLevel)} ${getSafetyTextColor(safetyLevel)}`}>
                                {safetyLevel}
                            </Badge>
                        </span>
                    </SheetDescription>
                </SheetHeader>

                {/* ─── Scrollable Content ───────────────────────────── */}
                <ScrollArea className="flex-1">
                    <div className="px-6 py-4 flex flex-col gap-6">

                        {/* ══════════════════════════════════════════════════════
                            TRACKERS
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Activity}>Trackers</SectionTitle>
                            <SectionDescription>Companies that follow your activity across websites to build a profile about you.</SectionDescription>

                            {enriched?.trackers ? (() => {
                                const { items, summary } = enriched.trackers

                                // Build grouped insight rows
                                const activeItems = items.filter(t => t.status !== 'blocked')
                                const blockedItems = items.filter(t => t.status === 'blocked')

                                // Group active by category
                                const grouped: Record<string, TrackerDetail[]> = {}
                                for (const t of activeItems) {
                                    if (!grouped[t.category]) grouped[t.category] = []
                                    grouped[t.category].push(t)
                                }

                                return (
                                    <div className="space-y-2">
                                        {/* Summary stats */}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            <SummaryStat label="Total" value={summary.total} />
                                            <SummaryStat label="Active" value={summary.active} highlight={summary.active > 0} />
                                            <SummaryStat label="Blocked" value={summary.blocked} />
                                        </div>

                                        {/* User-friendly insight rows */}
                                        <div className="flex flex-col gap-1.5">
                                            {activeItems.length === 0 && blockedItems.length === 0 && (
                                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    No trackers found — this is good!
                                                </InsightRow>
                                            )}
                                            {Object.entries(grouped).map(([cat, trackers]) => {
                                                const cfg = TRACKER_CATEGORY_DESCRIPTIONS[cat] ?? { description: `${cat} tracker is active`, iconClass: "text-muted-foreground" }
                                                const orgs = [...new Set(trackers.map(t => t.organization).filter(Boolean))]
                                                const orgLabel = orgs.length > 0 ? ` (${orgs.slice(0, 2).join(", ")}${orgs.length > 2 ? ` +${orgs.length - 2} more` : ""})` : ""
                                                return (
                                                    <InsightRow key={cat} icon={AlertTriangle} iconClass={cfg.iconClass}>
                                                        <strong>{trackers.length} {cfg.description.split(' ').slice(1).join(' ')}</strong>{orgLabel}
                                                        {/* Clarify the prefix */}
                                                        {" "}— {trackers.length === 1 ? "1" : trackers.length} {cfg.description.split(' ')[0]} tracker{trackers.length !== 1 ? "s are" : " is"} {cfg.description.split(' ').slice(1).join(' ')}
                                                    </InsightRow>
                                                )
                                            })}
                                            {blockedItems.length > 0 && (
                                                <InsightRow icon={XCircle} iconClass="text-muted-foreground" faded>
                                                    <strong>{blockedItems.length} tracker{blockedItems.length !== 1 ? "s" : ""} blocked</strong> — your browser or an extension stopped {blockedItems.length !== 1 ? "these" : "this"} from loading
                                                </InsightRow>
                                            )}
                                        </div>

                                        {/* Collapsible technical table */}
                                        {items.length > 0 && (
                                            <TechnicalDetails itemCount={items.length}>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40">
                                                            <TableHead className="text-xs w-8" />
                                                            <TableHead className="text-xs">Domain · Organization</TableHead>
                                                            <TableHead className="text-xs">Category</TableHead>
                                                            <TableHead className="text-xs">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                </Table>
                                                <div className={items.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                    <Table>
                                                        <TableBody>
                                                            {items.map((t: TrackerDetail, idx: number) => {
                                                                const isBlocked = t.status === 'blocked'
                                                                return (
                                                                    <TableRow key={idx} className={isBlocked ? "opacity-50" : ""}>
                                                                        <TableCell className="w-8 pl-4 pr-2">
                                                                            {isBlocked
                                                                                ? <XCircle className="h-4 w-4 text-muted-foreground" />
                                                                                : <AlertTriangle className={`h-4 w-4 ${getIndicatorTextColor('warning')}`} />
                                                                            }
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="font-medium text-xs text-foreground">{t.domain}</div>
                                                                            <div className="text-[10px] text-muted-foreground">{t.organization || "Unknown org"}</div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {(() => { const b = getCategoryBadge(t.category); return <Badge variant={b.variant} className={`text-xs capitalize ${b.extra}`}>{t.category}</Badge> })()}
                                                                        </TableCell>
                                                                        <TableCell className={`text-xs font-medium ${isBlocked ? "text-muted-foreground line-through" : getIndicatorTextColor('warning')}`}>
                                                                            {isBlocked ? "Blocked" : "Tracking you"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TechnicalDetails>
                                        )}
                                    </div>
                                )
                            })() : trackingLegacy ? (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-1">
                                        <SummaryStat label="Total detected" value={trackingLegacy.count || 0} highlight={(trackingLegacy.count || 0) > 0} />
                                    </div>
                                    {(trackingLegacy.count || 0) > 0 ? (
                                        <InsightRow icon={AlertTriangle} iconClass={getIndicatorTextColor('warning')}>
                                            <strong>{trackingLegacy.count} tracker{trackingLegacy.count !== 1 ? "s" : ""} detected</strong> on this page — they may be collecting data about your visit
                                        </InsightRow>
                                    ) : (
                                        <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                            No trackers found — this is good!
                                        </InsightRow>
                                    )}
                                </div>
                            ) : (
                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                    No trackers found — this is good!
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            COOKIES
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Cookie}>Cookies</SectionTitle>
                            <SectionDescription>Small files websites store on your device. Some are necessary, others track you for ads.</SectionDescription>

                            {enriched?.cookies ? (() => {
                                const { items, summary } = enriched.cookies
                                const activeItems = items.filter(c => c.status !== 'blocked')
                                const blockedItems = items.filter(c => c.status === 'blocked')

                                // Group active by category
                                const grouped: Record<string, CookieDetail[]> = {}
                                for (const c of activeItems) {
                                    const cat = c.category || 'unclassified'
                                    if (!grouped[cat]) grouped[cat] = []
                                    grouped[cat].push(c)
                                }

                                // Sort: marketing/advertising first (most invasive), necessary last
                                const ORDER = ['marketing', 'advertising', 'analytics', 'social', 'unclassified', 'functional', 'necessary']
                                const sortedGroups = Object.entries(grouped).sort(([a], [b]) =>
                                    (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b))
                                )

                                return (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            <SummaryStat label="Total" value={summary.total} />
                                            <SummaryStat label="Active" value={summary.active} highlight={summary.active > 0} />
                                            <SummaryStat label="Blocked" value={summary.blocked} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            {activeItems.length === 0 && blockedItems.length === 0 && (
                                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    No cookies detected on this page
                                                </InsightRow>
                                            )}
                                            {sortedGroups.map(([cat, cookies]) => {
                                                const cfg = COOKIE_CATEGORY_DESCRIPTIONS[cat] ?? { label: cat, description: "have an unknown purpose", iconClass: "text-muted-foreground", icon: Info }
                                                const IconComp = cfg.icon
                                                return (
                                                    <InsightRow key={cat} icon={IconComp} iconClass={cfg.iconClass}>
                                                        <strong>{cookies.length} {cfg.label} cookie{cookies.length !== 1 ? "s" : ""}</strong> — {cfg.description}
                                                    </InsightRow>
                                                )
                                            })}
                                            {blockedItems.length > 0 && (
                                                <InsightRow icon={XCircle} iconClass="text-muted-foreground" faded>
                                                    <strong>{blockedItems.length} cookie{blockedItems.length !== 1 ? "s" : ""} blocked</strong> — your browser or an extension prevented {blockedItems.length !== 1 ? "these" : "this"} from being stored
                                                </InsightRow>
                                            )}
                                        </div>

                                        {/* Collapsible technical table */}
                                        {items.length > 0 && (
                                            <TechnicalDetails itemCount={items.length}>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40">
                                                            <TableHead className="text-xs w-8" />
                                                            <TableHead className="text-xs">Cookie · Domain</TableHead>
                                                            <TableHead className="text-xs">Category</TableHead>
                                                            <TableHead className="text-xs">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                </Table>
                                                <div className={items.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                    <Table>
                                                        <TableBody>
                                                            {items.map((c: CookieDetail, idx: number) => {
                                                                const isBlocked = c.status === 'blocked'
                                                                return (
                                                                    <TableRow key={idx} className={isBlocked ? "opacity-50" : ""}>
                                                                        <TableCell className="w-8 pl-4 pr-2">
                                                                            {isBlocked
                                                                                ? <XCircle className="h-4 w-4 text-muted-foreground" />
                                                                                : <CircleCheck className={`h-4 w-4 ${getIndicatorTextColor('success')}`} />
                                                                            }
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="font-medium text-xs text-foreground flex items-center gap-1.5">
                                                                                {c.name}
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Info className="h-3 w-3 text-muted-foreground shrink-0 cursor-help" />
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent side="right" className="flex flex-col gap-1 text-xs">
                                                                                            {c.httpOnly && <span className="flex items-center gap-1.5"><CircleCheck className={`h-3 w-3 ${getIndicatorTextColor('success')}`} /> HttpOnly</span>}
                                                                                            {c.secure && <span className="flex items-center gap-1.5"><CircleCheck className={`h-3 w-3 ${getIndicatorTextColor('success')}`} /> Secure</span>}
                                                                                            {c.isThirdParty && <span className="flex items-center gap-1.5"><AlertTriangle className={`h-3 w-3 ${getIndicatorTextColor('warning')}`} /> Third Party</span>}
                                                                                            {!c.httpOnly && !c.secure && !c.isThirdParty && <span>No special flags</span>}
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            </div>
                                                                            <div className="text-[10px] text-muted-foreground">{c.domain}{c.organization ? ` · ${c.organization}` : ""}</div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {(() => { const b = getCategoryBadge(c.category); return <Badge variant={b.variant} className={`text-xs capitalize ${b.extra}`}>{c.category}</Badge> })()}
                                                                        </TableCell>
                                                                        <TableCell className={`text-xs font-medium ${isBlocked ? "text-muted-foreground line-through" : getIndicatorTextColor('success')}`}>
                                                                            {isBlocked ? "Blocked" : "Stored"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TechnicalDetails>
                                        )}
                                    </div>
                                )
                            })() : cookiesLegacy ? (() => {
                                const crossSite = cookiesLegacy['cross-site-tracker'] || 0
                                const analytics = (cookiesLegacy.analytics || 0) + (cookiesLegacy['third-party'] || 0)
                                const firstParty = cookiesLegacy['first-party'] || 0
                                return (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-1">
                                            <SummaryStat label="Total" value={crossSite + analytics + firstParty} />
                                        </div>
                                        {crossSite > 0 && (
                                            <InsightRow icon={AlertTriangle} iconClass={getIndicatorTextColor('error')}>
                                                <strong>{crossSite} cross-site tracking cookie{crossSite !== 1 ? "s" : ""}</strong> — follow you across the web to build an advertising profile
                                            </InsightRow>
                                        )}
                                        {analytics > 0 && (
                                            <InsightRow icon={BarChart} iconClass={getIndicatorTextColor('warning')}>
                                                <strong>{analytics} analytics or third-party cookie{analytics !== 1 ? "s" : ""}</strong> — track how you use this site and share data with other services
                                            </InsightRow>
                                        )}
                                        {firstParty > 0 && (
                                            <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                <strong>{firstParty} first-party cookie{firstParty !== 1 ? "s" : ""}</strong> — set by this site only, no impact on your privacy score
                                            </InsightRow>
                                        )}
                                        {crossSite + analytics + firstParty === 0 && (
                                            <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                No cookies detected on this page
                                            </InsightRow>
                                        )}
                                    </div>
                                )
                            })() : (
                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                    No cookies detected on this page.
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            THIRD-PARTY CONNECTIONS (formerly Network Requests)
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Network}>Third-Party Connections</SectionTitle>
                            <SectionDescription>Other companies and servers this page shared data with during your visit.</SectionDescription>

                            {hasNetwork ? (() => {
                                const { summary } = enriched!.networkRequests
                                const samesite = summary.total - summary.thirdParty
                                return (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            <SummaryStat label="Total connections" value={summary.total} />
                                            <SummaryStat label="Third-party" value={summary.thirdParty} highlight={summary.thirdParty > 0} />
                                            <SummaryStat label="Trackers" value={summary.trackerRequests} highlight={summary.trackerRequests > 0} />
                                            <SummaryStat label="Blocked" value={summary.blocked} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            {summary.trackerRequests > 0 && (
                                                <InsightRow icon={AlertTriangle} iconClass={getIndicatorTextColor('error')}>
                                                    <strong>{summary.trackerRequests} tracker server{summary.trackerRequests !== 1 ? "s" : ""}</strong> received data about your visit
                                                </InsightRow>
                                            )}
                                            {(summary.thirdParty - summary.trackerRequests) > 0 && (
                                                <InsightRow icon={Info} iconClass={getIndicatorTextColor('warning')}>
                                                    <strong>{summary.thirdParty - summary.trackerRequests} third-party service{(summary.thirdParty - summary.trackerRequests) !== 1 ? "s" : ""}</strong> contacted (CDNs, fonts, APIs, etc.)
                                                </InsightRow>
                                            )}
                                            {samesite > 0 && (
                                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    <strong>{samesite} connection{samesite !== 1 ? "s" : ""}</strong> to the site itself — normal page behaviour
                                                </InsightRow>
                                            )}
                                            {summary.blocked > 0 && (
                                                <InsightRow icon={XCircle} iconClass="text-muted-foreground" faded>
                                                    <strong>{summary.blocked} request{summary.blocked !== 1 ? "s" : ""} blocked</strong> before they could load
                                                </InsightRow>
                                            )}
                                            {summary.total === 0 && (
                                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    No network activity recorded.
                                                </InsightRow>
                                            )}
                                        </div>

                                        {/* Collapsible technical table — tracker + 3rd party only */}
                                        {networkTableItems.length > 0 && (
                                            <TechnicalDetails itemCount={networkTableItems.length}>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40">
                                                            <TableHead className="text-xs w-8" />
                                                            <TableHead className="text-xs">Domain · Organization</TableHead>
                                                            <TableHead className="text-xs">Type</TableHead>
                                                            <TableHead className="text-xs">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                </Table>
                                                <div className={networkTableItems.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                    <Table>
                                                        <TableBody>
                                                            {networkTableItems.map((r: NetworkRequestDetail, idx: number) => {
                                                                const isBlocked = r.status === 'blocked'
                                                                const rowIcon = r.isTracker
                                                                    ? <AlertTriangle className={`h-4 w-4 ${getIndicatorTextColor('error')}`} />
                                                                    : isBlocked
                                                                        ? <XCircle className="h-4 w-4 text-muted-foreground" />
                                                                        : <Info className={`h-4 w-4 ${getIndicatorTextColor('warning')}`} />
                                                                const typeBadgeExtra = r.isTracker
                                                                    ? `border-destructive/40 bg-destructive/10 ${getIndicatorTextColor('error')}`
                                                                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                                                return (
                                                                    <TableRow key={idx} className={isBlocked ? "opacity-50" : ""}>
                                                                        <TableCell className="w-8 pl-4 pr-2">{rowIcon}</TableCell>
                                                                        <TableCell>
                                                                            <div className="font-medium text-xs text-foreground">{r.domain}</div>
                                                                            <div className="text-[10px] text-muted-foreground">{r.organization || "Unknown org"}</div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Badge variant="outline" className={`text-xs capitalize ${typeBadgeExtra}`}>
                                                                                {r.resourceType}{r.isTracker ? " · Tracker" : " · 3rd Party"}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className={`text-xs font-medium ${isBlocked ? "text-muted-foreground line-through" : r.status === 'completed' ? getIndicatorTextColor('success') : getIndicatorTextColor('warning')}`}>
                                                                            {r.status === 'completed' ? "OK" : r.status === 'blocked' ? "Blocked" : "Failed"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                {enriched!.networkRequests.summary.total > 50 && (
                                                    <p className="text-xs text-muted-foreground text-center px-4 py-2 border-t">
                                                        Showing top 50 of {enriched!.networkRequests.summary.total} requests (trackers & third-party first).
                                                    </p>
                                                )}
                                            </TechnicalDetails>
                                        )}
                                    </div>
                                )
                            })() : (
                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                    No network activity recorded.
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            PERSONAL DATA FIELDS
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Key}>Personal Data Fields</SectionTitle>
                            <SectionDescription>Forms on this page that ask for sensitive info like passwords, emails, or credit cards.</SectionDescription>

                            {inputsLegacy ? (() => {
                                const sensitiveCount = inputsLegacy.sensitive || 0
                                const types: string[] = inputsLegacy.types || []
                                return (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            <SummaryStat label="Detected" value={sensitiveCount} highlight={sensitiveCount > 0} />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            {sensitiveCount === 0 && (
                                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    No personal data fields detected on this page.
                                                </InsightRow>
                                            )}
                                            {types.map((type: string, idx: number) => {
                                                const typeLabels: Record<string, string> = {
                                                    password: "password — your login credential",
                                                    email: "email address",
                                                    tel: "phone number",
                                                    "credit-card": "credit card number",
                                                    "card-number": "credit card number",
                                                    ssn: "social security number",
                                                    dob: "date of birth",
                                                    address: "physical address",
                                                    username: "username",
                                                    name: "your name",
                                                }
                                                const label = typeLabels[type.toLowerCase()] ?? type
                                                return (
                                                    <InsightRow key={idx} icon={AlertTriangle} iconClass={getIndicatorTextColor('warning')}>
                                                        This page asks for your <strong>{label}</strong>
                                                    </InsightRow>
                                                )
                                            })}
                                            {sensitiveCount > 0 && types.length === 0 && (
                                                <InsightRow icon={AlertTriangle} iconClass={getIndicatorTextColor('warning')}>
                                                    <strong>{sensitiveCount} sensitive field{sensitiveCount !== 1 ? "s" : ""}</strong> detected — this page collects personal information
                                                </InsightRow>
                                            )}
                                        </div>
                                    </div>
                                )
                            })() : (
                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                    No personal data fields detected on this page.
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            FINGERPRINTING
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Fingerprint}>Fingerprinting</SectionTitle>
                            <SectionDescription>Techniques used to identify your device without cookies — harder to block and often invisible.</SectionDescription>

                            {hasFingerprinting ? (() => {
                                const { items, summary } = enriched!.fingerprinting
                                return (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm items-center">
                                            <SummaryStat label="Attempts" value={summary.totalAttempts} highlight={summary.totalAttempts > 0} />
                                            <SummaryStat label="Risk" value={summary.riskLevel} highlight={summary.riskLevel !== 'none'} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            {items.map((f: FingerprintingDetail, idx: number) => {
                                                const desc = FINGERPRINT_DESCRIPTIONS[f.technique] ?? f.description
                                                const riskLabel = FINGERPRINT_RISK_LABELS[f.risk] ?? f.risk
                                                const iconClass = f.risk === 'high'
                                                    ? getIndicatorTextColor('error')
                                                    : f.risk === 'medium'
                                                        ? getIndicatorTextColor('warning')
                                                        : "text-muted-foreground"
                                                const org = f.organization ? ` (${f.organization})` : ""
                                                return (
                                                    <InsightRow key={idx} icon={AlertTriangle} iconClass={iconClass}>
                                                        <strong className="capitalize">{f.technique} fingerprinting</strong>{org} — {desc}
                                                        {" "}<span className="text-muted-foreground text-xs">· {riskLabel}</span>
                                                    </InsightRow>
                                                )
                                            })}
                                        </div>

                                        {/* Collapsible technical table */}
                                        <TechnicalDetails itemCount={items.length}>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="text-xs w-8" />
                                                        <TableHead className="text-xs">Technique · Script Domain</TableHead>
                                                        <TableHead className="text-xs">Risk</TableHead>
                                                        <TableHead className="text-xs">Organization</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                            </Table>
                                            <div className={items.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                <Table>
                                                    <TableBody>
                                                        {items.map((f: FingerprintingDetail, idx: number) => {
                                                            const riskCfg = getRiskLevelBadge(f.risk)
                                                            const riskIcon = f.risk === 'high'
                                                                ? <AlertTriangle className={`h-4 w-4 ${getIndicatorTextColor('error')}`} />
                                                                : f.risk === 'medium'
                                                                    ? <AlertTriangle className={`h-4 w-4 ${getIndicatorTextColor('warning')}`} />
                                                                    : <Info className="h-4 w-4 text-muted-foreground" />
                                                            return (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="w-8 pl-4 pr-2">{riskIcon}</TableCell>
                                                                    <TableCell>
                                                                        <div className="font-medium text-xs text-foreground capitalize">{f.technique}</div>
                                                                        <div className="text-[10px] text-muted-foreground">{f.scriptDomain || "Unknown domain"}</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={riskCfg.variant} className={`text-xs capitalize ${riskCfg.extra}`}>{f.risk}</Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-muted-foreground">{f.organization || "Unknown org"}</TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TechnicalDetails>
                                    </div>
                                )
                            })() : (
                                <InsightRow icon={ShieldUser} iconClass={getIndicatorTextColor('success')}>
                                    No fingerprinting detected — your device identity is safe here.
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            REPUTATION
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={OctagonAlert}>Reputation</SectionTitle>
                            <SectionDescription>Whether this site has been flagged as unsafe, malicious, or deceptive by security databases.</SectionDescription>

                            {reputationLegacy ? (() => {
                                const isClean = reputationLegacy.status === 'Clean'
                                const checks: string[] = reputationLegacy.checks ?? []
                                return (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            <SummaryStat label="Status" value={reputationLegacy.status || "Unknown"} highlight={!isClean} />
                                            <SummaryStat label="Checks" value={checks.length} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            {isClean ? (
                                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    This site has a <strong>clean reputation</strong> — no safety warnings found in any database
                                                </InsightRow>
                                            ) : (
                                                <InsightRow icon={AlertTriangle} iconClass={getIndicatorTextColor('error')}>
                                                    This site has been flagged as <strong>suspicious or unsafe</strong> in one or more security databases
                                                </InsightRow>
                                            )}
                                        </div>

                                        {/* Collapsible technical table */}
                                        {checks.length > 0 && (
                                            <TechnicalDetails itemCount={checks.length}>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40">
                                                            <TableHead className="text-xs w-8" />
                                                            <TableHead className="text-xs">Security Check</TableHead>
                                                            <TableHead className="text-xs">Result</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                </Table>
                                                <div className={checks.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                    <Table>
                                                        <TableBody>
                                                            {checks.map((check: string, idx: number) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="w-8 pl-4 pr-2">
                                                                        {isClean
                                                                            ? <CircleCheck className={`h-4 w-4 ${getIndicatorTextColor('success')}`} />
                                                                            : <AlertTriangle className={`h-4 w-4 ${getIndicatorTextColor('warning')}`} />
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell className="font-medium text-xs text-foreground">{check}</TableCell>
                                                                    <TableCell className={`text-xs font-medium ${isClean ? getIndicatorTextColor('success') : getIndicatorTextColor('warning')}`}>
                                                                        {isClean ? "Clean" : "Suspicious"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TechnicalDetails>
                                        )}
                                    </div>
                                )
                            })() : (
                                <InsightRow icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                    No safety warnings found for this site.
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            PRIVACY POLICY (unchanged — already works well)
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={FileText}>Privacy Policy</SectionTitle>
                            <SectionDescription>How this site says it handles your data, graded by community reviewers.</SectionDescription>
                            {policyLegacy ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                            <span>
                                                <span className="text-muted-foreground">Grade: </span>
                                                <span className={getGradeTextColor(policyLegacy.grade)}>{policyLegacy.grade || "N/A"}</span>
                                            </span>
                                            <SummaryStat label="Source" value={policyLegacy.source === 'tosdr' ? 'ToS;DR database' : 'Local detection'} />
                                            <SummaryStat label="Points" value={policyLegacy.points?.length || 0} />
                                            {policyLegacy.serviceId ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 text-xs px-2 py-0"
                                                    onClick={() => {
                                                        window.open(`https://tosdr.org/en/service/${policyLegacy.serviceId}`, '_blank');
                                                    }}
                                                >
                                                    <Globe className="h-3 w-3 mr-1" />
                                                    ToS;DR
                                                </Button>
                                            ) : null}
                                        </div>
                                        {policyLegacy.points && policyLegacy.points.length > 0 && (
                                            <Select value={policyFilter} onValueChange={setPolicyFilter}>
                                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                                    <SelectValue placeholder="Filter points" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all" className="text-xs">All Points</SelectItem>
                                                    <SelectItem value="blocker" className="text-xs">Blockers</SelectItem>
                                                    <SelectItem value="bad" className="text-xs">Bad Points</SelectItem>
                                                    <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                                                    <SelectItem value="good" className="text-xs">Good Points</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    {policyLegacy.points && policyLegacy.points.length > 0 && (() => {
                                        const filtered = [...policyLegacy.points]
                                            .filter((p: any) => policyFilter === "all" || p.classification === policyFilter)
                                            .sort((a: any, b: any) => {
                                                const order: Record<string, number> = { blocker: 1, bad: 2, neutral: 3, good: 4 }
                                                return (order[a.classification] || 5) - (order[b.classification] || 5)
                                            })
                                        return (
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40">
                                                            <TableHead className="text-xs w-10" />
                                                            <TableHead className="text-xs">Classification Point</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                </Table>
                                                <div className={filtered.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                    <Table>
                                                        <TableBody>
                                                            {filtered.map((p: any, idx: number) => {
                                                                let Icon = Info
                                                                let iconClass = "text-muted-foreground"
                                                                if (p.classification === 'blocker') { Icon = XCircle; iconClass = getSafetyTextColor('critical') }
                                                                else if (p.classification === 'bad') { Icon = ThumbsDown; iconClass = getSafetyTextColor('poor') }
                                                                else if (p.classification === 'good') { Icon = CircleCheck; iconClass = getSafetyTextColor('excellent') }
                                                                return (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="w-10 pl-4 pr-2">
                                                                            <Icon className={`h-4 w-4 ${iconClass}`} />
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-medium text-foreground py-2.5">{p.title}</TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    {policyLegacy.documents && policyLegacy.documents.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            <h4 className="text-sm font-semibold">Documents</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {policyLegacy.documents.map((doc: any, idx: number) => (
                                                    <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer">
                                                        <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer text-xs font-normal">
                                                            {doc.name}
                                                        </Badge>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <InsightRow icon={Info} iconClass="text-muted-foreground">
                                    No privacy policy information available.
                                </InsightRow>
                            )}
                        </div>

                        <Separator />

                        {/* ══════════════════════════════════════════════════════
                            CONNECTION SECURITY (formerly Security Headers)
                        ══════════════════════════════════════════════════════ */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={ShieldUser}>Connection Security</SectionTitle>
                            <SectionDescription>Protections the site uses to keep your connection safe from eavesdropping and tampering.</SectionDescription>

                            {hasHeaders ? (() => {
                                const { items, summary } = enriched!.headers
                                const presentItems = items.filter(h => h.present)
                                const missingItems = items.filter(h => !h.present)
                                return (
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                            <span className="font-medium">
                                                <span className="text-muted-foreground">Grade: </span>
                                                <span className={`font-semibold ${getGradeTextColor(summary.grade)}`}>{summary.grade}</span>
                                            </span>
                                            <SummaryStat label="Present" value={`${summary.present}/${summary.present + summary.missing}`} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            {/* Missing headers first (most actionable) */}
                                            {missingItems.map((h: HeaderAnalysisDetail, idx: number) => (
                                                <InsightRow key={`miss-${idx}`} icon={XCircle} iconClass={getIndicatorTextColor('error')}>
                                                    <strong>{getHeaderFriendlyName(h.header, h.explanation).split(' — ')[0]}</strong>
                                                    {h.explanation.includes(' — ') || getHeaderFriendlyName(h.header, h.explanation).includes(' — ')
                                                        ? ` — ${getHeaderFriendlyName(h.header, h.explanation).split(' — ').slice(1).join(' — ')} `
                                                        : " "
                                                    }
                                                    <span className="text-muted-foreground text-xs">· missing</span>
                                                </InsightRow>
                                            ))}
                                            {/* Present headers */}
                                            {presentItems.map((h: HeaderAnalysisDetail, idx: number) => (
                                                <InsightRow key={`pres-${idx}`} icon={CircleCheck} iconClass={getIndicatorTextColor('success')}>
                                                    <strong>{getHeaderFriendlyName(h.header, h.explanation).split(' — ')[0]}</strong>
                                                    {getHeaderFriendlyName(h.header, h.explanation).includes(' — ')
                                                        ? ` — ${getHeaderFriendlyName(h.header, h.explanation).split(' — ').slice(1).join(' — ')} `
                                                        : " "
                                                    }
                                                    <span className="text-muted-foreground text-xs">· active</span>
                                                </InsightRow>
                                            ))}
                                        </div>

                                        {/* Collapsible technical table */}
                                        <TooltipProvider>
                                            <TechnicalDetails itemCount={items.length}>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40">
                                                            <TableHead className="text-xs w-8" />
                                                            <TableHead className="text-xs">Header</TableHead>
                                                            <TableHead className="text-xs">Rating</TableHead>
                                                            <TableHead className="text-xs">Status</TableHead>
                                                            <TableHead className="text-xs w-8" />
                                                        </TableRow>
                                                    </TableHeader>
                                                </Table>
                                                <div className={items.length > 5 ? "max-h-[240px] overflow-y-auto" : undefined}>
                                                    <Table>
                                                        <TableBody>
                                                            {items.map((h: HeaderAnalysisDetail, idx: number) => {
                                                                const ratingBadge = getHeaderRatingBadge(h.rating)
                                                                return (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="w-8 pl-4 pr-2">
                                                                            {h.present
                                                                                ? <CircleCheck className={`h-4 w-4 ${getIndicatorTextColor('success')}`} />
                                                                                : <XCircle className={`h-4 w-4 ${getIndicatorTextColor('error')}`} />
                                                                            }
                                                                        </TableCell>
                                                                        <TableCell className="font-medium text-xs text-foreground">{h.header}</TableCell>
                                                                        <TableCell>
                                                                            <Badge variant={ratingBadge.variant} className={`text-xs capitalize ${ratingBadge.extra}`}>{h.rating}</Badge>
                                                                        </TableCell>
                                                                        <TableCell className={`text-xs font-medium ${h.present ? getIndicatorTextColor('success') : getIndicatorTextColor('error')}`}>
                                                                            {h.present ? "Present" : "Missing"}
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
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TechnicalDetails>
                                        </TooltipProvider>
                                    </div>
                                )
                            })() : (
                                <InsightRow icon={Info} iconClass="text-muted-foreground">
                                    Couldn't check this site's connection security.
                                </InsightRow>
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
