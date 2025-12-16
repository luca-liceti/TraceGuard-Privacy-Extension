"use client"

import { useState, useEffect } from "react"
import { useAppState } from "@/lib/useStorage"
import { Globe, AlertTriangle, CheckCircle, XCircle, Filter } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SiteRiskData } from "@/lib/types"


export default function WebsiteSafetyPage() {
    const state = useAppState()
    const [filterLevel, setFilterLevel] = useState<string>("all")
    const [siteCache, setSiteCache] = useState<Record<string, SiteRiskData>>({})

    // Load siteCache from chrome.storage
    useEffect(() => {
        chrome.storage.local.get('siteCache').then(res => {
            setSiteCache((res.siteCache || {}) as Record<string, SiteRiskData>)
        })

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.siteCache) {
                setSiteCache((changes.siteCache.newValue || {}) as Record<string, SiteRiskData>)
            }
        }

        chrome.storage.onChanged.addListener(listener)
        return () => chrome.storage.onChanged.removeListener(listener)
    }, [])

    if (!state) return <div className="p-4">Loading...</div>

    const sites = Object.entries(siteCache)

    // Filter sites by risk level
    const filteredSites = sites.filter(([_, data]) => {
        if (filterLevel === "all") return true
        if (filterLevel === "critical") return data.wrs >= 80
        if (filterLevel === "high") return data.wrs >= 60 && data.wrs < 80
        if (filterLevel === "medium") return data.wrs >= 40 && data.wrs < 60
        if (filterLevel === "low") return data.wrs < 40
        return true
    })

    // Calculate statistics
    const totalSites = sites.length
    const criticalSites = sites.filter(([_, data]) => data.wrs >= 80).length
    const highRiskSites = sites.filter(([_, data]) => data.wrs >= 60 && data.wrs < 80).length
    const avgWRS = sites.length > 0
        ? Math.round(sites.reduce((sum, [_, data]) => sum + data.wrs, 0) / sites.length)
        : 0

    const getRiskColor = (wrs: number) => {
        if (wrs >= 80) return { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" }
        if (wrs >= 60) return { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" }
        if (wrs >= 40) return { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" }
        return { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" }
    }

    const getRiskIcon = (wrs: number) => {
        if (wrs >= 80) return <XCircle className="h-5 w-5 text-red-500" />
        if (wrs >= 60) return <AlertTriangle className="h-5 w-5 text-orange-500" />
        if (wrs >= 40) return <AlertTriangle className="h-5 w-5 text-yellow-500" />
        return <CheckCircle className="h-5 w-5 text-green-500" />
    }

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Website Safety (WRS)
                </h1>
                <p className="text-muted-foreground mt-2">
                    Detailed analysis of all websites you've visited
                </p>
            </div>

            {/* Statistics */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">{totalSites}</div>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Average WRS
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${getRiskColor(avgWRS).text}`}>
                            {avgWRS}
                        </div>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Critical Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-500">{criticalSites}</div>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            High Risk Sites
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-500">{highRiskSites}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <Card className=" ">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-foreground">
                            All Analyzed Sites
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <Select value={filterLevel} onValueChange={setFilterLevel}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by risk" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sites</SelectItem>
                                    <SelectItem value="critical">Critical Only</SelectItem>
                                    <SelectItem value="high">High Risk Only</SelectItem>
                                    <SelectItem value="medium">Medium Risk Only</SelectItem>
                                    <SelectItem value="low">Low Risk Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <CardDescription>
                        Showing {filteredSites.length} of {totalSites} sites
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredSites.length > 0 ? (
                        <div className="space-y-4">
                            {filteredSites.map(([domain, data]) => {
                                const colors = getRiskColor(data.wrs)
                                return (
                                    <div
                                        key={domain}
                                        className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Globe className="h-5 w-5 text-gray-500" />
                                                <div>
                                                    <h3 className="font-semibold text-foreground">
                                                        {domain}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        Last visited: {new Date(data.lastAnalyzed).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getRiskIcon(data.wrs)}
                                                <span className={`text-2xl font-bold ${colors.text}`}>
                                                    {data.wrs}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Context Breakdown - All 6 contexts */}
                                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
                                            {data.breakdown && Object.entries(data.breakdown).map(([context, value]) => (
                                                <div key={context} className="text-center">
                                                    <div className={`text-lg font-bold ${getRiskColor(value as number).text}`}>
                                                        {value}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground capitalize">
                                                        {context}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            {filterLevel !== "all"
                                ? "No sites match the selected filter"
                                : "No sites analyzed yet. Browse some websites to see safety scores."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
