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
    SiteRiskData,
    CookieDetail,
    TrackerDetail,
    HeaderAnalysisDetail,
    EnrichedDetectionDetails,
} from "@/lib/types"
import { format } from "date-fns"
import { CheckCircle, XCircle, ThumbsDown, Info } from "lucide-react"

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

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[700px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-xl">{domain}</SheetTitle>
                    <SheetDescription>
                        {timestamp ? format(new Date(timestamp), "MMM d, yyyy HH:mm:ss") : "Recent visit"}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-6">
                    {/* Overall Score */}
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Overall Safety Score</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold">{wss}</span>
                            <Badge variant="outline" className={getSafetyColor(safetyLevel)}>
                                {safetyLevel}
                            </Badge>
                        </div>
                    </div>

                    <hr />

                    {/* Trackers Section */}
                    <div>
                        <h3 className="font-semibold text-lg mb-3">Trackers</h3>
                        {enriched?.trackers ? (
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    {enriched.trackers.summary.total} total · {enriched.trackers.summary.active} active · {enriched.trackers.summary.blocked} blocked
                                </div>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Domain</TableHead>
                                                <TableHead>Organization</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {enriched.trackers.items.map((t: TrackerDetail, idx: number) => (
                                                <TableRow key={idx} className={t.status === 'blocked' ? 'opacity-50' : ''}>
                                                    <TableCell className="font-mono text-xs max-w-[200px] truncate" title={t.url}>
                                                        {t.domain}
                                                    </TableCell>
                                                    <TableCell className="text-xs">{t.organization || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={getCategoryColor(t.category)}>
                                                            {t.category}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {t.status === 'blocked' ? (
                                                            <span className="line-through text-muted-foreground">Blocked</span>
                                                        ) : (
                                                            'Active'
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {enriched.trackers.items.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                        No trackers detected.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : trackingLegacy ? (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="text-sm mb-2">Total Detected: <span className="font-medium">{trackingLegacy.count || 0}</span></div>
                                    {trackingLegacy.knownTrackers?.length > 0 && (
                                        <div className="mt-2">
                                            <div className="text-sm font-medium mb-1">Known Trackers:</div>
                                            <div className="text-sm text-muted-foreground break-all">
                                                {trackingLegacy.knownTrackers.join(', ')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No tracking data.</p>
                        )}
                    </div>

                    <hr />

                    {/* Cookies Section */}
                    <div>
                        <h3 className="font-semibold text-lg mb-3">Cookies</h3>
                        {enriched?.cookies ? (
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    {enriched.cookies.summary.total} total · {enriched.cookies.summary.active} active · {enriched.cookies.summary.blocked} blocked
                                </div>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Organization</TableHead>
                                                <TableHead>Flags</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {enriched.cookies.items.map((c: CookieDetail, idx: number) => (
                                                <TableRow key={idx} className={c.status === 'blocked' ? 'opacity-50' : ''}>
                                                    <TableCell className="font-mono text-xs max-w-[150px] truncate" title={c.domain}>
                                                        {c.name}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={getCategoryColor(c.category)}>
                                                            {c.category}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{c.organization || '-'}</TableCell>
                                                    <TableCell className="text-xs space-x-1">
                                                        {c.httpOnly && <Badge variant="outline" className="text-[10px]">HttpOnly</Badge>}
                                                        {c.secure && <Badge variant="outline" className="text-[10px]">Secure</Badge>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {enriched.cookies.items.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                        No cookies detected.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : cookiesLegacy ? (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        Cross-Site Trackers
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-2">Highest penalty impact. These follow you across multiple websites.</p>
                                    <div className="text-sm">Found: {cookiesLegacy['cross-site-tracker'] || 0}</div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                        Analytics & Third-Party Cookies
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-2">Moderate penalty impact. Standard HTTP tracking cookies.</p>
                                    <div className="text-sm">Found: {(cookiesLegacy.analytics || 0) + (cookiesLegacy['third-party'] || 0)}</div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        First-Party Cookies
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-2">No penalty impact. Essential for modern web functionality.</p>
                                    <div className="text-sm">Found: {cookiesLegacy['first-party'] || 0}</div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No cookie data.</p>
                        )}
                    </div>

                    <hr />

                    {/* PII Risk Section */}
                    <div>
                        <h3 className="font-semibold text-lg mb-3">Sensitive Input Fields</h3>
                        {inputsLegacy ? (
                            <div>
                                <div className="text-sm mb-2">Total Detected: <span className="font-medium">{inputsLegacy.sensitive || 0}</span></div>
                                {inputsLegacy.types?.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-sm font-medium mb-1">Field Types:</div>
                                        <div className="text-sm text-muted-foreground">
                                            {inputsLegacy.types.join(', ')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No PII data.</p>
                        )}
                    </div>

                    <hr />

                    {/* Reputation Section */}
                    <div>
                        <h3 className="font-semibold text-lg mb-3">Reputation</h3>
                        {reputationLegacy ? (
                            <div className="space-y-2">
                                <div className="text-sm">
                                    <span className="font-medium">Status:</span> {reputationLegacy.status || 'Unknown'}
                                </div>
                                {reputationLegacy.checks?.length > 0 && (
                                    <div className="text-sm text-muted-foreground">
                                        Checks: {reputationLegacy.checks.join(', ')}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No reputation data.</p>
                        )}
                    </div>

                    <hr />

                    {/* Policy Section */}
                    <div>
                        <h3 className="font-semibold text-lg mb-3">Privacy Policy</h3>
                        {policyLegacy ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="text-sm">
                                        <span className="font-medium">Grade:</span> {policyLegacy.grade || 'N/A'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">Source:</span> {policyLegacy.source === 'tosdr' ? 'ToS;DR database' : 'Local detection'}
                                    </div>
                                </div>

                                {policyLegacy.points && policyLegacy.points.length > 0 && (
                                    <div className="border rounded-md mt-4">
                                        <Table>
                                            <TableBody>
                                                {policyLegacy.points.map((p: any, idx: number) => {
                                                    let Icon = Info;
                                                    let iconClass = "text-muted-foreground";
                                                    if (p.classification === 'blocker') {
                                                        Icon = XCircle;
                                                        iconClass = "text-red-600 dark:text-red-400";
                                                    } else if (p.classification === 'bad') {
                                                        Icon = ThumbsDown;
                                                        iconClass = "text-orange-500 dark:text-orange-400";
                                                    } else if (p.classification === 'good') {
                                                        Icon = CheckCircle;
                                                        iconClass = "text-green-600 dark:text-green-400";
                                                    }

                                                    return (
                                                        <TableRow key={idx}>
                                                            <TableCell className="w-8 pl-4 pr-2">
                                                                <Icon className={`h-4 w-4 ${iconClass}`} />
                                                            </TableCell>
                                                            <TableCell className="text-sm py-3">
                                                                {p.title}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No policy data.</p>
                        )}
                    </div>

                    <hr />

                    {/* Security Headers Section */}
                    <div>
                        <h3 className="font-semibold text-lg mb-3">Security Headers</h3>
                        {enriched?.headers?.items ? (
                            <div className="border rounded-md mt-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Header</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Grade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {enriched.headers.items.map((h: HeaderAnalysisDetail, idx: number) => (
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
                                                    <Badge variant="secondary" className={getHeaderRatingClass(h.rating)}>
                                                        {h.rating}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No security header data.</p>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
