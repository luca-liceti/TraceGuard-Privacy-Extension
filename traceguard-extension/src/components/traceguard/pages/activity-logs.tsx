/**
 * =============================================================================
 * ACTIVITY LOGS PAGE - Browsing History and Detector Results
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This page shows a log of all your site visits with detailed detector scores.
 * It groups logs by site visit (logs within 5 seconds = same visit).
 * 
 * DISPLAYED INFORMATION:
 * 
 * 1. STATISTICS ROW
 *    - Total: Total number of site visits logged
 *    - High Risk: Visits to high risk sites (WRS >= 61)
 *    - Medium: Moderate risk visits (WRS 31-60)
 *    - Low Risk: Safe site visits (WRS <= 30)
 *    - Unique Sites: Number of distinct domains visited
 * 
 * 2. FILTERS
 *    - Search: Find visits by domain name
 *    - Risk Level: Filter by High/Medium/Low risk
 *    - Time Range: Filter by 24h/7 days/30 days/All time
 * 
 * 3. VISIT CARDS
 *    - Domain and timestamp
 *    - Overall WRS (Website Risk Score)
 *    - Individual detector scores in a grid:
 *      Protocol, Reputation, Tracking, Cookies, Inputs, Policy
 *    - Expandable tracker details when available
 * 
 * 4. EXPORT
 *    - Download filtered logs as JSON file
 * 
 * WRS CALCULATION:
 * Weighted average of detector scores:
 *    - Protocol: 25%, Reputation: 25%, Tracking: 20%
 *    - Cookies: 15%, Inputs: 10%, Policy: 5%
 * =============================================================================
 */

"use client"

import { useState, useMemo } from "react"
import { useDetectorLogs } from "@/lib/useStorage"
import { Download, ChevronDown, ChevronUp, Globe, Search, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetectorType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { StatCard } from "@/components/ui/stat-card"
import { getSafetyLevel, getSafetyConfig, SAFETY_CONFIGS } from "@/lib/risk-utils"

interface GroupedSiteVisit {
    domain: string
    timestamp: number
    wss: number  // Website Safety Score (higher = safer)
    detectors: {
        [key in DetectorType]?: {
            score: number
            message: string
            details: any
        }
    }
}

// StatCard now imported from @/components/ui/stat-card


export default function ActivityLogsPage() {
    const detectorLogs = useDetectorLogs()
    const [searchQuery, setSearchQuery] = useState("")
    const [filterRisk, setFilterRisk] = useState<string>("all")
    const [filterDays, setFilterDays] = useState<string>("all")
    const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())

    // Group logs by domain and timestamp (within 5 seconds = same visit)
    const groupedVisits = useMemo(() => {
        const groups = new Map<string, GroupedSiteVisit>()

        // Sort logs by timestamp
        const sortedLogs = [...detectorLogs].sort((a, b) => b.timestamp - a.timestamp)

        for (const log of sortedLogs) {
            // Create a key based on domain and rounded timestamp (5-second window)
            const timeWindow = Math.floor(log.timestamp / 5000) * 5000
            const key = `${log.domain}-${timeWindow}`

            if (!groups.has(key)) {
                groups.set(key, {
                    domain: log.domain,
                    timestamp: log.timestamp,
                    wss: 0,
                    detectors: {}
                })
            }

            const group = groups.get(key)!
            group.detectors[log.detector] = {
                score: log.score,
                message: log.message,
                details: log.details
            }
        }

        // Calculate WRS for each group (weighted average)
        const weights: Record<string, number> = {
            protocol: 0.25,
            reputation: 0.25,
            tracking: 0.20,
            cookies: 0.15,
            inputs: 0.10,
            policy: 0.05,
            permissions: 0
        }

        for (const group of groups.values()) {
            let totalScore = 0
            let totalWeight = 0

            for (const [detector, data] of Object.entries(group.detectors)) {
                const weight = weights[detector as DetectorType] || 0
                totalScore += data.score * weight
                totalWeight += weight
            }

            // WSS = weighted average of detector safety scores (higher = safer)
            group.wss = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
        }

        return Array.from(groups.values())
    }, [detectorLogs])

    // Filter grouped visits
    const filteredVisits = useMemo(() => {
        return groupedVisits.filter(visit => {
            // Search filter
            const matchesSearch = searchQuery === "" ||
                visit.domain.toLowerCase().includes(searchQuery.toLowerCase())

            // Safety filter (using WSS thresholds)
            let matchesSafety = true
            if (filterRisk !== "all") {
                const safetyLevel = getSafetyLevelLocal(visit.wss)
                matchesSafety = safetyLevel === filterRisk
            }

            // Date filter
            let matchesDate = true
            if (filterDays !== "all") {
                const daysAgo = parseInt(filterDays)
                const logDate = new Date(visit.timestamp)
                const cutoffDate = new Date()
                cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
                matchesDate = logDate >= cutoffDate
            }

            return matchesSearch && matchesSafety && matchesDate
        })
    }, [groupedVisits, searchQuery, filterRisk, filterDays])

    // Calculate statistics using WSS thresholds (higher = safer)
    const totalVisits = groupedVisits.length
    const excellentSafetyVisits = groupedVisits.filter(v => v.wss >= 80).length  // Excellent safety
    const goodSafetyVisits = groupedVisits.filter(v => v.wss >= 60 && v.wss < 80).length  // Good safety
    const fairSafetyVisits = groupedVisits.filter(v => v.wss >= 40 && v.wss < 60).length  // Fair safety
    const atRiskVisits = groupedVisits.filter(v => v.wss < 40).length  // Poor + Critical (high risk)
    const uniqueSites = new Set(groupedVisits.map(v => v.domain)).size

    // Helper to get safety level (matches filter options)
    const getSafetyLevelLocal = (wss: number): string => {
        if (wss >= 80) return "excellent"
        if (wss >= 60) return "good"
        if (wss >= 40) return "fair"
        if (wss >= 20) return "poor"
        return "critical"
    }

    // Get safety info for display
    const getSafetyInfo = (wss: number) => {
        if (wss >= 80) return { level: "Excellent", color: "text-green-500", border: "border-green-500" }
        if (wss >= 60) return { level: "Good", color: "text-blue-500", border: "border-blue-500" }
        if (wss >= 40) return { level: "Fair", color: "text-yellow-500", border: "border-yellow-500" }
        if (wss >= 20) return { level: "Poor", color: "text-orange-500", border: "border-orange-500" }
        return { level: "Critical", color: "text-red-500", border: "border-red-500" }
    }

    // Color for individual detector scores (all are safety scores, higher = better)
    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-500"
        if (score >= 60) return "text-blue-500"
        if (score >= 40) return "text-yellow-500"
        return "text-red-500"
    }

    const toggleExpanded = (key: string) => {
        const newExpanded = new Set(expandedSites)
        if (newExpanded.has(key)) {
            newExpanded.delete(key)
        } else {
            newExpanded.add(key)
        }
        setExpandedSites(newExpanded)
    }

    const exportLogs = () => {
        const dataStr = JSON.stringify(filteredVisits, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `traceguard-activity-${new Date().toISOString().split('T')[0]}.json`
        link.click()
        URL.revokeObjectURL(url)
        toast.success("Export Complete", {
            description: "Activity logs have been downloaded."
        })
    }

    // Define detector order for consistent display
    const detectorOrder: DetectorType[] = ['protocol', 'reputation', 'tracking', 'cookies', 'inputs', 'policy']

    const detectorLabels: Record<DetectorType, string> = {
        protocol: 'Protocol',
        reputation: 'Reputation',
        tracking: 'Tracking',
        cookies: 'Cookies',
        inputs: 'Inputs',
        policy: 'Policy',
        permissions: 'Permissions'
    }

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        Activity Logs
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Site visits grouped by domain with safety assessment
                    </p>
                </div>
                <Button
                    onClick={exportLogs}
                    variant="outline"
                    disabled={filteredVisits.length === 0}
                    className="flex items-center gap-2"
                >
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* Statistics */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <StatCard
                    title="Total"
                    value={totalVisits}
                    valueColor="text-blue-500"
                />
                <StatCard
                    title="At Risk"
                    value={atRiskVisits}
                    valueColor="text-red-500"
                />
                <StatCard
                    title="Fair"
                    value={fairSafetyVisits}
                    valueColor="text-yellow-500"
                />
                <StatCard
                    title="Safe"
                    value={excellentSafetyVisits + goodSafetyVisits}
                    valueColor="text-green-500"
                />
                <StatCard
                    title="Unique Sites"
                    value={uniqueSites}
                    valueColor="text-purple-500"
                />
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search domains..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Select value={filterRisk} onValueChange={setFilterRisk}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Risk level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Risks</SelectItem>
                                <SelectItem value="high">High Risk</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low Risk</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterDays} onValueChange={setFilterDays}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Time range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="1">Last 24h</SelectItem>
                                <SelectItem value="7">Last 7 days</SelectItem>
                                <SelectItem value="30">Last 30 days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Site Visits List */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            Site Visits
                        </CardTitle>
                        <Badge variant="secondary">
                            {filteredVisits.length} of {totalVisits}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredVisits.length > 0 ? (
                        <div className="space-y-3">
                            {filteredVisits.map((visit) => {
                                const visitKey = `${visit.domain}-${visit.timestamp}`
                                const isExpanded = expandedSites.has(visitKey)
                                const safetyInfo = getSafetyInfo(visit.wss)
                                const hasTrackingDetails = visit.detectors.tracking?.details?.knownTrackers?.length > 0

                                return (
                                    <div
                                        key={visitKey}
                                        className="p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                    <h3 className="font-medium text-foreground truncate">
                                                        {visit.domain}
                                                    </h3>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn("flex-shrink-0", safetyInfo.border, safetyInfo.color)}
                                                    >
                                                        {safetyInfo.level}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(visit.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-right ml-4">
                                                <span className={cn("text-xl font-bold", safetyInfo.color)}>
                                                    {visit.wss}
                                                </span>
                                                <p className="text-xs text-muted-foreground">WSS</p>
                                            </div>
                                        </div>

                                        {/* Detector Scores Grid */}
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                            {detectorOrder.map((detector) => {
                                                const data = visit.detectors[detector]
                                                if (!data) return (
                                                    <div key={detector} className="text-center p-2 rounded bg-muted/50">
                                                        <div className="text-sm font-medium text-muted-foreground">—</div>
                                                        <div className="text-xs text-muted-foreground capitalize">
                                                            {detectorLabels[detector]}
                                                        </div>
                                                    </div>
                                                )

                                                return (
                                                    <div key={detector} className="text-center p-2 rounded bg-muted/50">
                                                        <div className={cn("text-sm font-bold", getScoreColor(data.score))}>
                                                            {data.score}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground capitalize">
                                                            {detectorLabels[detector]}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Expand/Collapse for details */}
                                        {hasTrackingDetails && (
                                            <>
                                                {isExpanded && (
                                                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                                                        {visit.detectors.tracking?.details?.knownTrackers?.length > 0 && (
                                                            <div>
                                                                <span className="font-medium">Known trackers: </span>
                                                                {visit.detectors.tracking?.details?.knownTrackers?.join(', ')}
                                                            </div>
                                                        )}
                                                        {visit.detectors.tracking?.details?.suspiciousTrackers?.length > 0 && (
                                                            <div>
                                                                <span className="font-medium">Suspicious: </span>
                                                                {visit.detectors.tracking?.details?.suspiciousTrackers?.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleExpanded(visitKey)}
                                                    className="w-full mt-2 h-8"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp className="h-4 w-4 mr-1" />
                                                            Hide details
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="h-4 w-4 mr-1" />
                                                            Show tracker details
                                                        </>
                                                    )}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            {searchQuery || filterRisk !== "all" || filterDays !== "all"
                                ? "No visits match the selected filters"
                                : "No site visits logged yet. Browse some websites to see activity."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
