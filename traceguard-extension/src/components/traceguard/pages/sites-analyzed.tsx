"use client"

import React, { useState, useEffect } from "react"
import { Globe, Calendar, TrendingUp, Search, BarChart3 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
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

export default function SitesAnalyzedPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [siteCache, setSiteCache] = useState<Record<string, SiteRiskData>>({})

    // Load siteCache from chrome.storage
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

    // Filter sites by search query
    const filteredSites = sites.filter(([domain]) =>
        domain.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sort by last visited (most recent first)
    const sortedSites = [...filteredSites].sort((a, b) =>
        (b[1].lastVisit || b[1].lastAnalyzed) - (a[1].lastVisit || a[1].lastAnalyzed)
    )

    // Prepare chart data (top 10 most visited sites)
    const chartData = sites
        .sort((a, b) => (b[1].visitCount || 0) - (a[1].visitCount || 0))
        .slice(0, 10)
        .map(([domain, data]) => ({
            domain: domain.length > 15 ? domain.substring(0, 15) + '...' : domain,
            visits: data.visitCount || 1,
            wrs: data.wrs
        }))

    const totalVisits = sites.reduce((sum, [_, data]) => sum + (data.visitCount || 1), 0)
    const avgVisitsPerSite = sites.length > 0 ? Math.round(totalVisits / sites.length) : 0

    // Get today's sites
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()
    const todayCount = sites.filter(([_, data]) =>
        (data.lastVisit || data.lastAnalyzed) >= todayStart
    ).length

    const getRiskColor = (wrs: number) => {
        if (wrs >= 80) return "text-red-500"
        if (wrs >= 60) return "text-orange-500"
        if (wrs >= 40) return "text-yellow-500"
        return "text-green-500"
    }

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
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <StatCard
                    title="Total Sites"
                    value={sites.length}
                    subtitle="Unique domains"
                    valueColor="text-blue-500"
                />
                <StatCard
                    title="Today"
                    value={todayCount}
                    subtitle="Sites visited"
                    valueColor="text-green-500"
                />
                <StatCard
                    title="Total Visits"
                    value={totalVisits}
                    subtitle="Across all sites"
                    valueColor="text-purple-500"
                />
                <StatCard
                    title="Avg Visits"
                    value={avgVisitsPerSite}
                    subtitle="Per site"
                    valueColor="text-orange-500"
                />
            </div>

            {/* Top Sites Chart */}
            {chartData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
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
                                    color: "hsl(var(--primary))",
                                },
                            }}
                            className="h-[250px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <YAxis
                                        dataKey="domain"
                                        type="category"
                                        tick={{ fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={100}
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
                                        fill="hsl(var(--primary))"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}

            {/* Sites List */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            All Sites
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
                        Showing {filteredSites.length} of {sites.length} sites
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sortedSites.length > 0 ? (
                        <div className="space-y-2">
                            {sortedSites.map(([domain, data]) => (
                                <div
                                    key={domain}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-medium text-foreground text-sm truncate">
                                                {domain}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(data.lastVisit || data.lastAnalyzed).toLocaleDateString()}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <TrendingUp className="h-3 w-3" />
                                                    {data.visitCount || 1} visits
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right ml-3">
                                        <div className={cn("text-lg font-bold", getRiskColor(data.wrs))}>
                                            {data.wrs}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            WRS
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            {searchQuery ? "No sites match your search" : "No sites analyzed yet"}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
