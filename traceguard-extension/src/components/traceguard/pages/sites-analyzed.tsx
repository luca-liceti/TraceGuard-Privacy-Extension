"use client"

import React, { useState } from "react"
import { useAppState } from "@/lib/useStorage"
import { Globe, Calendar, TrendingUp, Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"

export default function SitesAnalyzedPage() {
    const state = useAppState()
    const [searchQuery, setSearchQuery] = useState("")

    if (!state) return <div className="p-4">Loading...</div>

    const siteScores = state.siteScores || {}
    const sites = Object.entries(siteScores)

    // Filter sites by search query
    const filteredSites = sites.filter(([domain]) =>
        domain.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sort by last visited (most recent first)
    const sortedSites = [...filteredSites].sort((a, b) =>
        b[1].lastAnalyzed - a[1].lastAnalyzed
    )

    // Prepare chart data (top 10 most visited sites)
    const chartData = sites
        .sort((a, b) => (b[1].visitCount || 0) - (a[1].visitCount || 0))
        .slice(0, 10)
        .map(([domain, data]) => ({
            domain: domain.length > 20 ? domain.substring(0, 20) + '...' : domain,
            visits: data.visitCount || 0,
            wrs: data.wrs
        }))

    const totalVisits = sites.reduce((sum, [_, data]) => sum + (data.visitCount || 0), 0)
    const avgVisitsPerSite = sites.length > 0 ? Math.round(totalVisits / sites.length) : 0

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Sites Analyzed
                </h1>
                <p className="text-muted-foreground mt-2">
                    Complete history of all websites analyzed by TraceGuard
                </p>
            </div>

            {/* Statistics */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">{sites.length}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Unique domains analyzed
                        </p>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Visits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-500">{totalVisits}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Across all sites
                        </p>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg Visits/Site
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">{avgVisitsPerSite}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Average per domain
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Top Sites Chart */}
            {chartData.length > 0 && (
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-foreground">
                            Most Visited Sites
                        </CardTitle>
                        <CardDescription>
                            Top 10 sites by visit count
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer
                            config={{
                                visits: {
                                    label: "Visits",
                                    color: "hsl(217, 91%, 60%)",
                                },
                            }}
                            className="h-[300px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
                                    <XAxis
                                        dataKey="domain"
                                        className="text-muted-foreground text-xs"
                                        tick={{ fill: 'currentColor' }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                    />
                                    <YAxis
                                        className="text-muted-foreground text-xs"
                                        tick={{ fill: 'currentColor' }}
                                    />
                                    <ChartTooltip
                                        content={<ChartTooltipContent />}
                                        formatter={(value: number, name: string, props: any) => [
                                            `${value} visits`,
                                            `WRS: ${props.payload.wrs}`
                                        ]}
                                    />
                                    <Bar
                                        dataKey="visits"
                                        fill="var(--color-visits)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}

            {/* Sites List */}
            <Card className=" ">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-foreground">
                            All Sites
                        </CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
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
                        Showing {filteredSites.length} of {sites.length} sites
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sortedSites.length > 0 ? (
                        <div className="space-y-3">
                            {sortedSites.map(([domain, data]) => (
                                <div
                                    key={domain}
                                    className="flex items-center justify-between p-4 rounded-lg border  hover:bg-accent dark:hover:bg-accent transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Globe className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-medium text-foreground truncate">
                                                {domain}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(data.lastAnalyzed).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <TrendingUp className="h-3 w-3" />
                                                    {data.visitCount || 1} visits
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            <div className={`text-xl font-bold ${data.wrs >= 80 ? 'text-red-500' :
                                                    data.wrs >= 60 ? 'text-orange-500' :
                                                        data.wrs >= 40 ? 'text-yellow-500' :
                                                            'text-green-500'
                                                }`}>
                                                {data.wrs}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                WRS
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            {searchQuery ? "No sites match your search" : "No sites analyzed yet"}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
