"use client"

import { useState, useMemo } from "react"
import { useDetectorLogs } from "@/lib/useStorage"
import { Download, ChevronDown, ChevronUp, Globe } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetectorType } from "@/lib/types"

interface GroupedSiteVisit {
    domain: string
    timestamp: number
    wrs: number
    detectors: {
        [key in DetectorType]?: {
            score: number
            message: string
            details: any
        }
    }
}

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
                    wrs: 0,
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
        const weights = {
            protocol: 0.25,
            reputation: 0.25,
            tracking: 0.20,
            cookies: 0.15,
            inputs: 0.10,
            policy: 0.05
        }

        for (const group of groups.values()) {
            let totalScore = 0
            let totalWeight = 0

            for (const [detector, data] of Object.entries(group.detectors)) {
                const weight = weights[detector as DetectorType] || 0
                totalScore += data.score * weight
                totalWeight += weight
            }

            group.wrs = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
        }

        return Array.from(groups.values())
    }, [detectorLogs])

    // Filter grouped visits
    const filteredVisits = useMemo(() => {
        return groupedVisits.filter(visit => {
            // Search filter
            const matchesSearch = searchQuery === "" ||
                visit.domain.toLowerCase().includes(searchQuery.toLowerCase())

            // Risk filter
            let matchesRisk = true
            if (filterRisk !== "all") {
                const riskLevel = getRiskLevel(visit.wrs)
                matchesRisk = riskLevel === filterRisk
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

            return matchesSearch && matchesRisk && matchesDate
        })
    }, [groupedVisits, searchQuery, filterRisk, filterDays])

    // Calculate statistics
    const totalVisits = groupedVisits.length
    const highRiskVisits = groupedVisits.filter(v => v.wrs >= 61).length
    const mediumRiskVisits = groupedVisits.filter(v => v.wrs >= 31 && v.wrs <= 60).length
    const lowRiskVisits = groupedVisits.filter(v => v.wrs <= 30).length
    const uniqueSites = new Set(groupedVisits.map(v => v.domain)).size

    const getRiskLevel = (wrs: number): string => {
        if (wrs >= 61) return "high"
        if (wrs >= 31) return "medium"
        return "low"
    }

    const getRiskBadge = (wrs: number) => {
        if (wrs >= 61) {
            return <Badge variant="outline" className="ml-2 border-red-500 text-red-500">High Risk</Badge>
        }
        if (wrs >= 31) {
            return <Badge variant="outline" className="ml-2 border-yellow-500 text-yellow-500">Medium Risk</Badge>
        }
        return <Badge variant="outline" className="ml-2 border-green-500 text-green-500">Low Risk</Badge>
    }

    const getScoreBadge = (score: number) => {
        if (score >= 61) {
            return <Badge variant="outline" className="border-red-500 text-red-500">{score}</Badge>
        }
        if (score >= 31) {
            return <Badge variant="outline" className="border-yellow-500 text-yellow-500">{score}</Badge>
        }
        return <Badge variant="outline" className="border-green-500 text-green-500">{score}</Badge>
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
        link.download = `traceguard-site-visits-${new Date().toISOString().split('T')[0]}.json`
        link.click()
        URL.revokeObjectURL(url)
    }

    // Define detector order for consistent display
    const detectorOrder: DetectorType[] = ['protocol', 'reputation', 'tracking', 'cookies', 'inputs', 'policy']

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        Activity Logs
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Site visits grouped by domain with risk assessment
                    </p>
                </div>
                <Button
                    onClick={exportLogs}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={filteredVisits.length === 0}
                >
                    <Download className="h-4 w-4" />
                    Export Logs
                </Button>
            </div>

            {/* Statistics */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Total Visits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{totalVisits}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            High Risk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{highRiskVisits}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Medium Risk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{mediumRiskVisits}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Low Risk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{lowRiskVisits}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Unique Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-500">{uniqueSites}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                        Filter Logs
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                        <Input
                            type="text"
                            placeholder="Search domain..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        <Select value={filterRisk} onValueChange={setFilterRisk}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by risk" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Risk Levels</SelectItem>
                                <SelectItem value="high">High Risk Only</SelectItem>
                                <SelectItem value="medium">Medium Risk Only</SelectItem>
                                <SelectItem value="low">Low Risk Only</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterDays} onValueChange={setFilterDays}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by date" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="1">Last 24 Hours</SelectItem>
                                <SelectItem value="7">Last 7 Days</SelectItem>
                                <SelectItem value="30">Last 30 Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Site Visits List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                        Site Visits
                    </CardTitle>
                    <CardDescription>
                        Showing {filteredVisits.length} of {totalVisits} visits
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredVisits.length > 0 ? (
                        <div className="space-y-3">
                            {filteredVisits.map((visit) => {
                                const visitKey = `${visit.domain}-${visit.timestamp}`
                                const isExpanded = expandedSites.has(visitKey)

                                return (
                                    <div
                                        key={visitKey}
                                        className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                                    <h3 className="font-semibold text-foreground">
                                                        {visit.domain}
                                                    </h3>
                                                    {getRiskBadge(visit.wrs)}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    WRS: {visit.wrs} • {new Date(visit.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* All Detectors - Same Format */}
                                        <div className="space-y-1.5">
                                            {detectorOrder.map((detector) => {
                                                const data = visit.detectors[detector]
                                                if (!data) return null

                                                return (
                                                    <div key={detector} className="flex items-center justify-between text-sm py-1">
                                                        <span className="text-foreground">
                                                            <span className="capitalize text-muted-foreground font-medium min-w-[80px] inline-block">
                                                                {detector}:
                                                            </span>
                                                            {' '}{data.message}
                                                        </span>
                                                        {getScoreBadge(data.score)}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Expand/Collapse for details (optional - can show tracker names, etc.) */}
                                        {visit.detectors.tracking?.details?.knownTrackers?.length > 0 && (
                                            <>
                                                {isExpanded && (
                                                    <div className="mt-3 pt-3 border-t">
                                                        <p className="text-xs font-medium text-muted-foreground mb-2">Tracking Details:</p>
                                                        <div className="text-xs text-muted-foreground space-y-1">
                                                            {visit.detectors.tracking?.details?.knownTrackers?.length > 0 && (
                                                                <div>
                                                                    <span className="font-medium">Known trackers:</span>{' '}
                                                                    {visit.detectors.tracking?.details?.knownTrackers?.join(', ')}
                                                                </div>
                                                            )}
                                                            {visit.detectors.tracking?.details?.suspiciousTrackers?.length > 0 && (
                                                                <div>
                                                                    <span className="font-medium">Suspicious:</span>{' '}
                                                                    {visit.detectors.tracking?.details?.suspiciousTrackers?.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleExpanded(visitKey)}
                                                    className="w-full mt-2"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp className="h-4 w-4 mr-2" />
                                                            Hide details
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="h-4 w-4 mr-2" />
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
