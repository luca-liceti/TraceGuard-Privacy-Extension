"use client"

import { useState, useEffect } from "react"
import {
    Globe,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Shield,
    Search,
    TrendingUp,
    TrendingDown,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Filter,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SiteRiskData } from "@/lib/types"
import { cn } from "@/lib/utils"

// Risk configuration
const riskConfig = {
    critical: {
        label: "Critical",
        color: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        icon: XCircle,
        range: [80, 100]
    },
    high: {
        label: "High",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        border: "border-orange-500/30",
        icon: AlertTriangle,
        range: [60, 79]
    },
    medium: {
        label: "Medium",
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
        icon: AlertTriangle,
        range: [40, 59]
    },
    low: {
        label: "Low",
        color: "text-green-500",
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        icon: CheckCircle,
        range: [0, 39]
    }
}

function getRiskLevel(wrs: number): keyof typeof riskConfig {
    if (wrs >= 80) return "critical"
    if (wrs >= 60) return "high"
    if (wrs >= 40) return "medium"
    return "low"
}

// Stat card component
function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor,
    trend,
}: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ComponentType<{ className?: string }>
    iconColor?: string
    trend?: { direction: 'up' | 'down' | 'stable', value: string }
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {title}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">{value}</span>
                            {trend && (
                                <span className={cn(
                                    "text-xs flex items-center",
                                    trend.direction === 'up' ? "text-red-500" :
                                        trend.direction === 'down' ? "text-green-500" :
                                            "text-muted-foreground"
                                )}>
                                    {trend.direction === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                                    {trend.direction === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                                    {trend.value}
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                    </div>
                    <div className={cn("p-2.5 rounded-xl", iconColor ? `${iconColor}/10` : "bg-muted")}>
                        <Icon className={cn("h-5 w-5", iconColor || "text-muted-foreground")} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// Risk distribution bar component
function RiskDistributionBar({
    critical,
    high,
    medium,
    low,
    total
}: {
    critical: number
    high: number
    medium: number
    low: number
    total: number
}) {
    if (total === 0) return null

    const criticalPct = (critical / total) * 100
    const highPct = (high / total) * 100
    const mediumPct = (medium / total) * 100
    const lowPct = (low / total) * 100

    return (
        <div className="space-y-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {critical > 0 && (
                    <div
                        className="bg-red-500 transition-all"
                        style={{ width: `${criticalPct}%` }}
                    />
                )}
                {high > 0 && (
                    <div
                        className="bg-orange-500 transition-all"
                        style={{ width: `${highPct}%` }}
                    />
                )}
                {medium > 0 && (
                    <div
                        className="bg-yellow-500 transition-all"
                        style={{ width: `${mediumPct}%` }}
                    />
                )}
                {low > 0 && (
                    <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${lowPct}%` }}
                    />
                )}
            </div>
            <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">Critical ({critical})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    <span className="text-muted-foreground">High ({high})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                    <span className="text-muted-foreground">Medium ({medium})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Low ({low})</span>
                </div>
            </div>
        </div>
    )
}

// Site card component
function SiteCard({ domain, data }: { domain: string; data: SiteRiskData }) {
    const [isOpen, setIsOpen] = useState(false)
    const risk = getRiskLevel(data.wrs)
    const config = riskConfig[risk]
    const Icon = config.icon

    const breakdownItems = data.breakdown ? Object.entries(data.breakdown).filter(([_, v]) => v !== undefined) : []
    const hasBreakdown = breakdownItems.length > 0

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className={cn("transition-all hover:shadow-md", config.border, "border-l-4")}>
                <CollapsibleTrigger asChild>
                    <CardContent className="p-4 cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={cn("p-2 rounded-lg", config.bg)}>
                                    <Globe className={cn("h-4 w-4", config.color)} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-foreground truncate">
                                            {domain}
                                        </h3>
                                        <Badge
                                            variant="outline"
                                            className={cn("flex-shrink-0 text-xs", config.color, config.border)}
                                        >
                                            {config.label}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Last analyzed: {new Date(data.lastAnalyzed).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* WRS Score */}
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5">
                                        <Icon className={cn("h-5 w-5", config.color)} />
                                        <span className={cn("text-2xl font-bold", config.color)}>
                                            {data.wrs}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Risk Score</p>
                                </div>

                                {/* Expand button */}
                                {hasBreakdown && (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        {isOpen ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </CollapsibleTrigger>

                {hasBreakdown && (
                    <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0">
                            <div className="border-t pt-4">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                    Risk Breakdown
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                    {breakdownItems.map(([context, value]) => {
                                        const itemRisk = getRiskLevel(value as number)
                                        const itemConfig = riskConfig[itemRisk]
                                        return (
                                            <div
                                                key={context}
                                                className={cn(
                                                    "p-3 rounded-lg text-center",
                                                    itemConfig.bg
                                                )}
                                            >
                                                <div className={cn("text-lg font-bold", itemConfig.color)}>
                                                    {value}
                                                </div>
                                                <div className="text-xs text-muted-foreground capitalize">
                                                    {context}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </CollapsibleContent>
                )}
            </Card>
        </Collapsible>
    )
}

export default function WebsiteSafetyPage() {
    const [filterLevel, setFilterLevel] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
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

    const sites = Object.entries(siteCache)

    // Filter sites by risk level and search
    const filteredSites = sites.filter(([domain, data]) => {
        const matchesSearch = searchQuery === "" ||
            domain.toLowerCase().includes(searchQuery.toLowerCase())

        let matchesFilter = true
        if (filterLevel === "critical") matchesFilter = data.wrs >= 80
        else if (filterLevel === "high") matchesFilter = data.wrs >= 60 && data.wrs < 80
        else if (filterLevel === "medium") matchesFilter = data.wrs >= 40 && data.wrs < 60
        else if (filterLevel === "low") matchesFilter = data.wrs < 40

        return matchesSearch && matchesFilter
    })

    // Sort by risk score (highest first)
    const sortedSites = [...filteredSites].sort((a, b) => b[1].wrs - a[1].wrs)

    // Calculate statistics
    const totalSites = sites.length
    const criticalSites = sites.filter(([_, data]) => data.wrs >= 80).length
    const highRiskSites = sites.filter(([_, data]) => data.wrs >= 60 && data.wrs < 80).length
    const mediumRiskSites = sites.filter(([_, data]) => data.wrs >= 40 && data.wrs < 60).length
    const safeSites = sites.filter(([_, data]) => data.wrs < 40).length
    const avgWRS = sites.length > 0
        ? Math.round(sites.reduce((sum, [_, data]) => sum + data.wrs, 0) / sites.length)
        : 0

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Website Safety
                </h1>
                <p className="text-muted-foreground mt-2">
                    Analyze and monitor risk scores across all visited websites
                </p>
            </div>

            {/* Statistics Row */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Sites"
                    value={totalSites}
                    subtitle="Websites analyzed"
                    icon={Globe}
                    iconColor="text-blue-500"
                />
                <StatCard
                    title="Average Risk"
                    value={avgWRS}
                    subtitle={avgWRS >= 60 ? "Needs attention" : avgWRS >= 40 ? "Moderate" : "Looking good"}
                    icon={Shield}
                    iconColor={
                        avgWRS >= 80 ? "text-red-500" :
                            avgWRS >= 60 ? "text-orange-500" :
                                avgWRS >= 40 ? "text-yellow-500" :
                                    "text-green-500"
                    }
                />
                <StatCard
                    title="High Risk"
                    value={criticalSites + highRiskSites}
                    subtitle="Critical & high risk sites"
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                />
                <StatCard
                    title="Safe Sites"
                    value={safeSites}
                    subtitle="Low risk sites"
                    icon={CheckCircle}
                    iconColor="text-green-500"
                />
            </div>

            {/* Risk Distribution */}
            {totalSites > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">
                            Risk Distribution
                        </CardTitle>
                        <CardDescription>
                            Overview of website risk levels across all analyzed sites
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RiskDistributionBar
                            critical={criticalSites}
                            high={highRiskSites}
                            medium={mediumRiskSites}
                            low={safeSites}
                            total={totalSites}
                        />
                    </CardContent>
                </Card>
            )}

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
                        <Select value={filterLevel} onValueChange={setFilterLevel}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by risk" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sites</SelectItem>
                                <SelectItem value="critical">
                                    <span className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-red-500" />
                                        Critical Risk
                                    </span>
                                </SelectItem>
                                <SelectItem value="high">
                                    <span className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                                        High Risk
                                    </span>
                                </SelectItem>
                                <SelectItem value="medium">
                                    <span className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                        Medium Risk
                                    </span>
                                </SelectItem>
                                <SelectItem value="low">
                                    <span className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                        Low Risk
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Sites List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                        Analyzed Sites
                    </h2>
                    <Badge variant="secondary">
                        {sortedSites.length} of {totalSites} sites
                    </Badge>
                </div>

                {sortedSites.length > 0 ? (
                    <div className="space-y-3">
                        {sortedSites.map(([domain, data]) => (
                            <SiteCard key={domain} domain={domain} data={data} />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-12">
                            <div className="text-center text-muted-foreground">
                                <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">
                                    {filterLevel !== "all" || searchQuery
                                        ? "No sites match the selected filters"
                                        : "No sites analyzed yet"}
                                </p>
                                <p className="text-sm mt-1">
                                    {filterLevel !== "all" || searchQuery
                                        ? "Try adjusting your search or filter criteria"
                                        : "Browse some websites to see safety scores"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
