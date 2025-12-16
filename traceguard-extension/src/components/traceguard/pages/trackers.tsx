"use client"

import React from "react"
import { useAppState } from "@/lib/useStorage"
import { Shield, Eye, Ban, TrendingDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts"

export default function TrackersPage() {
    const state = useAppState()

    if (!state) return <div className="p-4">Loading...</div>

    const totalTrackers = state.trackersBlocked || 0
    const sitesAnalyzed = state.sitesAnalyzed || 0
    const avgTrackersPerSite = sitesAnalyzed > 0 ? Math.round(totalTrackers / sitesAnalyzed) : 0

    // Calculate tracker distribution from site scores
    const siteScores = state.siteScores || {}
    const sites = Object.entries(siteScores)

    // Categorize sites by tracking density
    const noTracking = sites.filter(([_, data]) => data.breakdown?.tracking === 0).length
    const lowTracking = sites.filter(([_, data]) => data.breakdown?.tracking > 0 && data.breakdown?.tracking <= 30).length
    const mediumTracking = sites.filter(([_, data]) => data.breakdown?.tracking > 30 && data.breakdown?.tracking <= 60).length
    const highTracking = sites.filter(([_, data]) => data.breakdown?.tracking > 60).length

    const trackingDistribution = [
        { name: "No Tracking", value: noTracking, color: "hsl(142, 76%, 36%)" },
        { name: "Low Tracking", value: lowTracking, color: "hsl(45, 93%, 47%)" },
        { name: "Medium Tracking", value: mediumTracking, color: "hsl(25, 95%, 53%)" },
        { name: "High Tracking", value: highTracking, color: "hsl(0, 84%, 60%)" },
    ].filter(item => item.value > 0)

    // Find top tracking sites
    const topTrackingSites = sites
        .filter(([_, data]) => data.breakdown?.tracking > 0)
        .sort((a, b) => (b[1].breakdown?.tracking || 0) - (a[1].breakdown?.tracking || 0))
        .slice(0, 10)

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Trackers & Threats
                </h1>
                <p className="text-muted-foreground mt-2">
                    Monitor tracking activity across all websites
                </p>
            </div>

            {/* Statistics */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Trackers Detected
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-500">{totalTrackers}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Across all sites
                        </p>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg Per Site
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">{avgTrackersPerSite}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Average trackers
                        </p>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            High Tracking Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-500">{highTracking}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Heavy trackers
                        </p>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Clean Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">{noTracking}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            No tracking detected
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tracking Distribution Chart */}
            {trackingDistribution.length > 0 && (
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-foreground">
                            Tracking Density Distribution
                        </CardTitle>
                        <CardDescription>
                            How sites are categorized by tracking intensity
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer
                            config={{
                                noTracking: { label: "No Tracking", color: "hsl(142, 76%, 36%)" },
                                lowTracking: { label: "Low Tracking", color: "hsl(45, 93%, 47%)" },
                                mediumTracking: { label: "Medium Tracking", color: "hsl(25, 95%, 53%)" },
                                highTracking: { label: "High Tracking", color: "hsl(0, 84%, 60%)" },
                            }}
                            className="h-[350px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={trackingDistribution}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value }) => `${name}: ${value}`}
                                        outerRadius={120}
                                        fill="#8884d8"
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
                                            <span className="text-xs text-gray-700 dark:text-gray-300">
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

            {/* Top Tracking Sites */}
            <Card className=" ">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                        Sites with Most Tracking
                    </CardTitle>
                    <CardDescription>
                        Top 10 sites by tracking density score
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {topTrackingSites.length > 0 ? (
                        <div className="space-y-3">
                            {topTrackingSites.map(([domain, data], index) => {
                                const trackingScore = data.breakdown?.tracking || 0
                                return (
                                    <div
                                        key={domain}
                                        className="flex items-center justify-between p-4 rounded-lg border "
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted dark:bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                                                {index + 1}
                                            </div>
                                            <Eye className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-medium text-foreground truncate">
                                                    {domain}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Overall WRS: {data.wrs}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="text-right">
                                                <div className={`text-xl font-bold ${trackingScore >= 70 ? 'text-red-500' :
                                                        trackingScore >= 40 ? 'text-orange-500' :
                                                            trackingScore >= 20 ? 'text-yellow-500' :
                                                                'text-green-500'
                                                    }`}>
                                                    {trackingScore}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Tracking
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            No tracking detected on any sites yet
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-500/10 border-blue-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-blue-600 dark:text-blue-400">
                        <Shield className="h-5 w-5" />
                        About Tracker Detection
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                    <p>
                        TraceGuard detects third-party tracking scripts and resources on websites you visit.
                        Tracking density is calculated based on the number and type of trackers found.
                    </p>
                    <p>
                        <strong>Note:</strong> This extension currently only detects trackers - it does not block them.
                        Tracker blocking functionality is planned for a future update.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
