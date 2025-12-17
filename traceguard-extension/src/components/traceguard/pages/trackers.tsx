"use client"

import { useState, useEffect } from "react"
import { Eye, Shield, Info, BarChart3, Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts"
import { SiteRiskData } from "@/lib/types"
import { cn } from "@/lib/utils"

// Stat card component
function StatCard({
    title,
    value,
    subtitle,
    valueColor,
}: {
    title: string
    value: string | number
    subtitle?: string
    valueColor?: string
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {title}
                </p>
                <p className={cn("text-2xl font-bold mt-1", valueColor)}>{value}</p>
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    )
}

export default function TrackersPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [siteCache, setSiteCache] = useState<Record<string, SiteRiskData>>({})

    useEffect(() => {
        chrome.storage.local.get('siteCache').then(res => {
            setSiteCache((res.siteCache || {}) as Record<string, SiteRiskData>)
        })

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.siteCache) {
                setSiteCache((changes.siteCache.newValue || {}) as Record<string, SiteRiskData>)
            }
        }

        chrome.storage.onChanged.addListener(listener)
        return () => chrome.storage.onChanged.removeListener(listener)
    }, [])

    const sites = Object.entries(siteCache)
    const sitesAnalyzed = sites.length

    // Calculate tracker stats from breakdown
    const noTracking = sites.filter(([_, data]) => (data.breakdown?.tracking || 0) === 0).length
    const lowTracking = sites.filter(([_, data]) => {
        const t = data.breakdown?.tracking || 0
        return t > 0 && t <= 30
    }).length
    const mediumTracking = sites.filter(([_, data]) => {
        const t = data.breakdown?.tracking || 0
        return t > 30 && t <= 60
    }).length
    const highTracking = sites.filter(([_, data]) => (data.breakdown?.tracking || 0) > 60).length

    // Total trackers is sum of all tracking scores as a proxy
    const totalTrackerScore = sites.reduce((sum, [_, data]) => sum + (data.breakdown?.tracking || 0), 0)
    const avgTrackingScore = sitesAnalyzed > 0 ? Math.round(totalTrackerScore / sitesAnalyzed) : 0

    const trackingDistribution = [
        { name: "Clean", value: noTracking, color: "hsl(142, 76%, 36%)" },
        { name: "Low", value: lowTracking, color: "hsl(45, 93%, 47%)" },
        { name: "Medium", value: mediumTracking, color: "hsl(25, 95%, 53%)" },
        { name: "High", value: highTracking, color: "hsl(0, 84%, 60%)" },
    ].filter(item => item.value > 0)

    // Find top tracking sites
    const topTrackingSites = sites
        .filter(([_, data]) => (data.breakdown?.tracking || 0) > 0)
        .sort((a, b) => (b[1].breakdown?.tracking || 0) - (a[1].breakdown?.tracking || 0))
        .slice(0, 10)
        .filter(([domain]) => domain.toLowerCase().includes(searchQuery.toLowerCase()))

    const getTrackingColor = (score: number) => {
        if (score >= 70) return "text-red-500"
        if (score >= 40) return "text-orange-500"
        if (score >= 20) return "text-yellow-500"
        return "text-green-500"
    }

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Trackers
                </h1>
                <p className="text-muted-foreground mt-2">
                    Monitor tracking activity across all websites
                </p>
            </div>

            {/* Statistics */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <StatCard
                    title="Avg Tracking"
                    value={avgTrackingScore}
                    subtitle="Average score"
                    valueColor={getTrackingColor(avgTrackingScore)}
                />
                <StatCard
                    title="Clean Sites"
                    value={noTracking}
                    subtitle="No tracking"
                    valueColor="text-green-500"
                />
                <StatCard
                    title="High Tracking"
                    value={highTracking}
                    subtitle="Heavy trackers"
                    valueColor="text-red-500"
                />
                <StatCard
                    title="Total Sites"
                    value={sitesAnalyzed}
                    subtitle="Analyzed"
                    valueColor="text-blue-500"
                />
            </div>

            {/* Chart and Top Sites in 2-column layout */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Tracking Distribution Chart */}
                {trackingDistribution.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                Distribution
                            </CardTitle>
                            <CardDescription>
                                Sites by tracking intensity
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer
                                config={{
                                    clean: { label: "Clean", color: "hsl(142, 76%, 36%)" },
                                    low: { label: "Low", color: "hsl(45, 93%, 47%)" },
                                    medium: { label: "Medium", color: "hsl(25, 95%, 53%)" },
                                    high: { label: "High", color: "hsl(0, 84%, 60%)" },
                                }}
                                className="h-[200px]"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={trackingDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={70}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {trackingDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip
                                            content={<ChartTooltipContent />}
                                            formatter={(value: number, name: string) => [`${value} sites`, name]}
                                        />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            formatter={(value) => (
                                                <span className="text-xs text-muted-foreground">
                                                    {value}
                                                </span>
                                            )}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Info Card */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <Info className="h-4 w-4 text-primary" />
                            About Tracker Detection
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-3">
                        <p>
                            TraceGuard detects third-party tracking scripts and resources on websites you visit.
                        </p>
                        <p>
                            The tracking score (0-100) indicates how many trackers were found. Higher = more tracking.
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <span className="text-xs">
                                Tracker blocking coming in a future update
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Tracking Sites */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" />
                            Sites with Most Tracking
                        </CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search sites..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <CardDescription>
                        Top 10 sites by tracking density score
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {topTrackingSites.length > 0 ? (
                        <div className="space-y-2">
                            {topTrackingSites.map(([domain, data], index) => {
                                const trackingScore = data.breakdown?.tracking || 0
                                return (
                                    <div
                                        key={domain}
                                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                                {index + 1}
                                            </div>
                                            <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-medium text-foreground text-sm truncate">
                                                    {domain}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Safety Score: {data.wss}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right ml-3">
                                            <div className={cn("text-lg font-bold", getTrackingColor(trackingScore))}>
                                                {trackingScore}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Tracking
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            {searchQuery ? "No matching sites found" : "No tracking detected on any sites yet"}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
