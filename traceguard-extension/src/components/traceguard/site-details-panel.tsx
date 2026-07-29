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
import {
    SiteRiskData,
    CookieDetail,
    TrackerDetail,
    HeaderAnalysisDetail,
    FingerprintingDetail,
    NetworkRequestDetail,
} from "@/lib/types"
import { format } from "date-fns"
import { CheckCircle, XCircle, AlertTriangle, ThumbsDown, Info, Globe, ShieldCheck, ShieldAlert, Network, Activity, Cookie, Key, FileText, Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getSafetyTextColor, getSafetyBgColor, getCategoryBadge, getHeaderRatingBadge, getGradeTextColor, getRiskLevelBadge, getNetworkStatusTextColor, getIndicatorTextColor } from "@/lib/theme-utils"

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

// Removed local color functions in favor of theme-utils.ts

// Section wrapper for consistent styling
function SectionTitle({ icon: Icon, children }: { icon?: React.ComponentType<any>; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-semibold text-base">{children}</h3>
        </div>
    )
}

function SectionDescription({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs text-muted-foreground -mt-1">{children}</p>
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
    const [policyFilter, setPolicyFilter] = React.useState("all")
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
                            <Badge variant="outline" className={`px-2.5 py-0.5 mt-1 border-transparent ${getSafetyBgColor(safetyLevel)} ${getSafetyTextColor(safetyLevel)}`}>
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
                            <SectionDescription>Companies that follow your activity across websites to build a profile about you.</SectionDescription>
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
                                                    <TableHead className="text-xs">Category</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched.trackers.items.map((t: TrackerDetail, idx: number) => (
                                                    <TableRow key={idx} className={t.status === 'blocked' ? 'opacity-50' : ''}>
                                                        <TableCell className="max-w-[180px] truncate" title={t.url}>
                                                            <div className="font-medium text-xs text-foreground">{t.domain}</div>
                                                            <div className="text-[10px] text-muted-foreground">{t.organization || 'Unknown Org'}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {(() => { const b = getCategoryBadge(t.category); return <Badge variant={b.variant} className={`text-xs capitalize ${b.extra}`}>{t.category}</Badge> })()}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">
                                                            {t.status === 'blocked' ? (
                                                                <span className="flex items-center gap-1.5 text-muted-foreground line-through">
                                                                    <XCircle className="h-3.5 w-3.5" /> Blocked
                                                                </span>
                                                            ) : (
                                                                <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('warning')}`}>
                                                                    <AlertTriangle className="h-3.5 w-3.5" /> Tracking you
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {enriched.trackers.items.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">
                                                            No trackers found — this is good!
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
                                <p className="text-sm text-muted-foreground">No trackers found — this is good!</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Cookies ──────────────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Cookie}>Cookies</SectionTitle>
                            <SectionDescription>Small files websites store on your device. Some are necessary, others track you for ads.</SectionDescription>
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
                                                    <TableHead className="text-xs">Cookie</TableHead>
                                                    <TableHead className="text-xs">Category</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched.cookies.items.map((c: CookieDetail, idx: number) => (
                                                    <TableRow key={idx} className={c.status === 'blocked' ? 'opacity-50' : ''}>
                                                        <TableCell className="max-w-[180px] truncate" title={c.name}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-medium text-xs text-foreground truncate">{c.name}</span>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Info className="h-3 w-3 text-muted-foreground shrink-0 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="right" className="flex flex-col gap-1 text-xs">
                                                                            {c.httpOnly && <span className="flex items-center gap-1.5"><CheckCircle className={`h-3 w-3 ${getIndicatorTextColor('success')}`}/> HttpOnly</span>}
                                                                            {c.secure && <span className="flex items-center gap-1.5"><CheckCircle className={`h-3 w-3 ${getIndicatorTextColor('success')}`}/> Secure</span>}
                                                                            {c.isThirdParty && <span className="flex items-center gap-1.5"><AlertTriangle className={`h-3 w-3 ${getIndicatorTextColor('warning')}`}/> Third Party</span>}
                                                                            {!c.httpOnly && !c.secure && !c.isThirdParty && <span>No special flags</span>}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground truncate">{c.domain} {c.organization ? `· ${c.organization}` : ''}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {(() => { const b = getCategoryBadge(c.category); return <Badge variant={b.variant} className={`text-xs capitalize ${b.extra}`}>{c.category}</Badge> })()}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">
                                                            {c.status === 'blocked' ? (
                                                                <span className="flex items-center gap-1.5 text-muted-foreground line-through">
                                                                    <XCircle className="h-3.5 w-3.5" /> Blocked
                                                                </span>
                                                            ) : (
                                                                <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('success')}`}>
                                                                    <CheckCircle className="h-3.5 w-3.5" /> Stored
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {enriched.cookies.items.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">
                                                            No cookies detected on this page.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : cookiesLegacy ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Total" value={(cookiesLegacy['cross-site-tracker'] || 0) + (cookiesLegacy.analytics || 0) + (cookiesLegacy['third-party'] || 0) + (cookiesLegacy['first-party'] || 0)} />
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="text-xs">Category</TableHead>
                                                    <TableHead className="text-xs">Count</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell>
                                                        <div className="font-medium text-xs text-foreground">Cross-Site Trackers</div>
                                                        <div className="text-[10px] text-muted-foreground">Highest penalty impact</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">{cookiesLegacy['cross-site-tracker'] || 0}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>
                                                        <div className="font-medium text-xs text-foreground">Analytics & 3rd Party</div>
                                                        <div className="text-[10px] text-muted-foreground">Moderate penalty impact</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">{(cookiesLegacy.analytics || 0) + (cookiesLegacy['third-party'] || 0)}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>
                                                        <div className="font-medium text-xs text-foreground">First-Party Cookies</div>
                                                        <div className="text-[10px] text-muted-foreground">No penalty impact</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">{cookiesLegacy['first-party'] || 0}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No cookies detected on this page.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Network Requests ─────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Network}>Network Requests</SectionTitle>
                            <SectionDescription>Connections this page made to other servers — some may be sending your data to third parties.</SectionDescription>
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
                                                        <TableHead className="text-xs">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {networkItems.map((r: NetworkRequestDetail, idx: number) => (
                                                        <TableRow key={idx} className={r.status === 'blocked' ? 'opacity-50' : ''}>
                                                            <TableCell className="max-w-[180px] truncate" title={r.url}>
                                                                <div className="font-medium text-xs text-foreground">{r.domain}</div>
                                                                <div className="text-[10px] text-muted-foreground">{r.organization || 'Unknown Org'}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {(() => {
                                                                    const extra = r.isTracker
                                                                        ? "border-destructive/40 bg-destructive/10 ${getIndicatorTextColor('error')}"
                                                                        : r.isThirdParty
                                                                        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                                                        : "border-success/40 bg-success/10 ${getIndicatorTextColor('success')}"
                                                                    return (
                                                                        <Badge variant="outline" className={`text-xs capitalize ${extra}`}>
                                                                            {r.resourceType}{r.isTracker ? ' · Tracker' : r.isThirdParty ? ' · 3rd Party' : ''}
                                                                        </Badge>
                                                                    )
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-medium">
                                                                {r.status === 'completed' ? (
                                                                    <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('success')}`}>
                                                                        <CheckCircle className="h-3.5 w-3.5" /> OK
                                                                    </span>
                                                                ) : r.status === 'blocked' ? (
                                                                    <span className="flex items-center gap-1.5 text-muted-foreground line-through">
                                                                        <XCircle className="h-3.5 w-3.5" /> Blocked
                                                                    </span>
                                                                ) : (
                                                                    <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('warning')}`}>
                                                                        <AlertTriangle className="h-3.5 w-3.5" /> Failed
                                                                    </span>
                                                                )}
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
                                <p className="text-sm text-muted-foreground">No network activity recorded.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Sensitive Input Fields ────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Key}>Personal Data Fields</SectionTitle>
                            <SectionDescription>Forms on this page that ask for sensitive info like passwords, emails, or credit cards.</SectionDescription>
                            {inputsLegacy ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Detected" value={inputsLegacy.sensitive || 0} highlight={(inputsLegacy.sensitive || 0) > 0} />
                                    </div>
                                    {inputsLegacy.types?.length > 0 && (
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="text-xs">Field Type</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {inputsLegacy.types.map((type: string, idx: number) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-xs capitalize border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                                                                    {type}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No personal data fields detected.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Fingerprinting ───────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={Fingerprint}>Fingerprinting</SectionTitle>
                            <SectionDescription>Techniques used to identify your device without cookies — harder to block and often invisible.</SectionDescription>
                            {hasFingerprinting ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm items-center">
                                        <SummaryStat label="Attempts" value={enriched!.fingerprinting.summary.totalAttempts} highlight={enriched!.fingerprinting.summary.totalAttempts > 0} />
                                        <SummaryStat label="Risk" value={enriched!.fingerprinting.summary.riskLevel} highlight={enriched!.fingerprinting.summary.riskLevel !== 'none'} />
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="text-xs">Technique</TableHead>
                                                    <TableHead className="text-xs">Risk</TableHead>
                                                    <TableHead className="text-xs">Source</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {enriched!.fingerprinting.items.map((f: FingerprintingDetail, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="max-w-[180px] truncate">
                                                            <div className="font-medium text-xs text-foreground capitalize">{f.technique}</div>
                                                            <div className="text-[10px] text-muted-foreground">{f.scriptDomain || 'Unknown domain'}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {(() => { const b = getRiskLevelBadge(f.risk); return <Badge variant={b.variant} className={`text-xs capitalize ${b.extra}`}>{f.risk}</Badge> })()}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{f.organization || 'Unknown Org'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <ShieldCheck className={`h-4 w-4 ${getIndicatorTextColor('success')}`} />
                                    No fingerprinting detected — your device identity is safe here.
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Reputation ───────────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={ShieldAlert}>Reputation</SectionTitle>
                            <SectionDescription>Whether this site has been flagged as unsafe, malicious, or deceptive by security databases.</SectionDescription>
                            {reputationLegacy ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Status" value={reputationLegacy.status || 'Unknown'} highlight={reputationLegacy.status !== 'Clean'} />
                                        <SummaryStat label="Checks" value={reputationLegacy.checks?.length || 0} />
                                    </div>
                                    {reputationLegacy.checks?.length > 0 && (
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="text-xs">Check</TableHead>
                                                        <TableHead className="text-xs">Result</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reputationLegacy.checks.map((check: string, idx: number) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="font-medium text-xs text-foreground">{check}</TableCell>
                                                            <TableCell className="text-xs font-medium">
                                                                {reputationLegacy.status === 'Clean' ? (
                                                                    <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('success')}`}>
                                                                        <CheckCircle className="h-3.5 w-3.5" /> Clean
                                                                    </span>
                                                                ) : (
                                                                    <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('warning')}`}>
                                                                        <AlertTriangle className="h-3.5 w-3.5" /> Suspicious
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No safety warnings found for this site.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Privacy Policy ───────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={FileText}>Privacy Policy</SectionTitle>
                            <SectionDescription>How this site says it handles your data, graded by community reviewers.</SectionDescription>
                            {policyLegacy ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Grade" value={policyLegacy.grade || 'N/A'} highlight />
                                        <SummaryStat label="Source" value={policyLegacy.source === 'tosdr' ? 'ToS;DR database' : 'Local detection'} />
                                        <SummaryStat label="Points" value={policyLegacy.points?.length || 0} />
                                    </div>
                                    <div className="flex justify-between items-center h-8">
                                        {policyLegacy.serviceId ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs"
                                                onClick={() => {
                                                    window.open(`https://tosdr.org/en/service/${policyLegacy.serviceId}`, '_blank');
                                                }}
                                            >
                                                <Globe className="h-3.5 w-3.5" />
                                                Open on ToS;DR
                                            </Button>
                                        ) : <div />}

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

                                    {policyLegacy.points && policyLegacy.points.length > 0 && (
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="text-xs w-10"></TableHead>
                                                        <TableHead className="text-xs">Classification Point</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {[...policyLegacy.points]
                                                        .filter((p: any) => policyFilter === "all" || p.classification === policyFilter)
                                                        .sort((a: any, b: any) => {
                                                        const order: Record<string, number> = { blocker: 1, bad: 2, neutral: 3, good: 4 };
                                                        return (order[a.classification] || 5) - (order[b.classification] || 5);
                                                    }).map((p: any, idx: number) => {
                                                        let Icon = Info;
                                                        let iconClass = "text-muted-foreground";
                                                        if (p.classification === 'blocker') { Icon = XCircle; iconClass = "${getIndicatorTextColor('error')}"; }
                                                        else if (p.classification === 'bad') { Icon = ThumbsDown; iconClass = "${getIndicatorTextColor('warning')}"; }
                                                        else if (p.classification === 'good') { Icon = CheckCircle; iconClass = "${getIndicatorTextColor('success')}"; }
                                                        return (
                                                            <TableRow key={idx}>
                                                                <TableCell className="w-10 pl-4 pr-2">
                                                                    <Icon className={`h-4 w-4 ${iconClass}`} />
                                                                </TableCell>
                                                                <TableCell className="text-xs font-medium text-foreground py-2.5">{p.title}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No privacy policy information available.</p>
                            )}
                        </div>

                        <Separator />

                        {/* ─── Security Headers ─────────────────────────────── */}
                        <div className="flex flex-col gap-3">
                            <SectionTitle icon={ShieldCheck}>Connection Security</SectionTitle>
                            <SectionDescription>Protections the site uses to keep your connection safe from eavesdropping and tampering.</SectionDescription>
                            {hasHeaders ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <SummaryStat label="Grade" value={enriched!.headers.summary.grade} highlight />
                                        <SummaryStat label="Present" value={`${enriched!.headers.summary.present}/${enriched!.headers.summary.present + enriched!.headers.summary.missing}`} />
                                    </div>
                                    <TooltipProvider>
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/40">
                                                        <TableHead className="text-xs">Header</TableHead>
                                                        <TableHead className="text-xs">Rating</TableHead>
                                                        <TableHead className="text-xs">Status</TableHead>
                                                        <TableHead className="text-xs w-8" />
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {enriched!.headers.items.map((h: HeaderAnalysisDetail, idx: number) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="max-w-[200px] truncate">
                                                                <span className="font-medium text-xs text-foreground">{h.header}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {(() => { const b = getHeaderRatingBadge(h.rating); return <Badge variant={b.variant} className={`text-xs capitalize ${b.extra}`}>{h.rating}</Badge> })()}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-medium">
                                                                {h.present ? (
                                                                    <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('success')}`}>
                                                                        <CheckCircle className="h-3.5 w-3.5" /> Present
                                                                    </span>
                                                                ) : (
                                                                    <span className={`flex items-center gap-1.5 ${getIndicatorTextColor('error')}`}>
                                                                        <XCircle className="h-3.5 w-3.5" /> Missing
                                                                    </span>
                                                                )}
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
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Couldn't check this site's connection security.</p>
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
