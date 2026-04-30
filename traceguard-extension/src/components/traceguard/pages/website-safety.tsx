/**
 * =============================================================================
 * WEBSITE SAFETY PAGE - Site Risk Analysis Dashboard
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This page displays all websites you've visited along with their Website
 * Risk Scores (WRS). Higher WRS = more risky site.
 * 
 * DISPLAYED INFORMATION:
 * 
 * 1. STATISTICS ROW
 *    - Total Sites: Number of unique websites analyzed
 *    - Average Risk: Mean WRS across all sites
 *    - High Risk: Count of critical + high risk sites
 *    - Safe Sites: Count of low risk sites
 * 
 * 2. RISK DISTRIBUTION BAR
 *    - Visual breakdown of sites by risk category
 *    - Color-coded segments: Critical/High/Medium/Low
 * 
 * 3. FILTERS
 *    - Search: Find sites by domain name
 *    - Risk Level: Filter by Critical/High/Medium/Low
 * 
 * 4. SITE CARDS
 *    - Expandable cards for each analyzed site
 *    - Shows WRS, last analyzed date, risk breakdown
 * 
 * RISK LEVELS (based on WRS):
 *    - Critical (80-100): Major security concerns - RED
 *    - High (60-79): Significant risks - ORANGE
 *    - Medium (40-59): Some concerns - YELLOW
 *    - Low (0-39): Generally safe - GREEN
 * 
 * NOTE: WRS is INVERSE of WSS. High WRS = more risky (bad).
 * This is different from UPS where higher = better.
 * =============================================================================
 */

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
import { getSafetyLevel, getSafetyConfig, SafetyLevel, SAFETY_CONFIGS } from "@/lib/risk-utils"

// Safety configuration with icons for display
// WSS thresholds: higher = safer
const safetyConfig = {
    excellent: {
        ...SAFETY_CONFIGS.excellent,
        icon: CheckCircle,
        border: SAFETY_CONFIGS.excellent.borderColor,
        bg: SAFETY_CONFIGS.excellent.bgColor,
        range: [80, 100]
    },
    good: {
        ...SAFETY_CONFIGS.good,
        icon: CheckCircle,
        border: SAFETY_CONFIGS.good.borderColor,
        bg: SAFETY_CONFIGS.good.bgColor,
        range: [60, 79]
    },
    fair: {
        ...SAFETY_CONFIGS.fair,
        icon: AlertTriangle,
        border: SAFETY_CONFIGS.fair.borderColor,
        bg: SAFETY_CONFIGS.fair.bgColor,
        range: [40, 59]
    },
    poor: {
        ...SAFETY_CONFIGS.poor,
        icon: AlertTriangle,
        border: SAFETY_CONFIGS.poor.borderColor,
        bg: SAFETY_CONFIGS.poor.bgColor,
        range: [20, 39]
    },
    critical: {
        ...SAFETY_CONFIGS.critical,
        icon: XCircle,
        border: SAFETY_CONFIGS.critical.borderColor,
        bg: SAFETY_CONFIGS.critical.bgColor,
        range: [0, 19]
    }
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
    const safety = getSafetyLevel(data.wss)
    const config = safetyConfig[safety]
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
                                {/* WSS Score */}
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5">
                                        <Icon className={cn("h-5 w-5", config.color)} />
                                        <span className={cn("text-2xl font-bold", config.color)}>
                                            {data.wss}
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
                                        // Breakdown values are safety scores (higher = safer)
                                        const itemSafety = getSafetyLevel(value as number)
                                        const itemConfig = safetyConfig[itemSafety]
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

    // Filter sites by safety level and search
    const filteredSites = sites.filter(([domain, data]) => {
        const matchesSearch = searchQuery === "" ||
            domain.toLowerCase().includes(searchQuery.toLowerCase())

        let matchesFilter = true
        // WSS thresholds (higher = safer)
        if (filterLevel === "excellent") matchesFilter = data.wss >= 80
        else if (filterLevel === "good") matchesFilter = data.wss >= 60 && data.wss < 80
        else if (filterLevel === "fair") matchesFilter = data.wss >= 40 && data.wss < 60
        else if (filterLevel === "poor") matchesFilter = data.wss >= 20 && data.wss < 40
        else if (filterLevel === "critical") matchesFilter = data.wss < 20

        return matchesSearch && matchesFilter
    })

    // Sort by safety score (lowest/riskiest first for review)
    const sortedSites = [...filteredSites].sort((a, b) => a[1].wss - b[1].wss)

    // Calculate statistics using WSS thresholds
    const totalSites = sites.length
    const excellentSites = sites.filter(([_, data]) => data.wss >= 80).length
    const goodSites = sites.filter(([_, data]) => data.wss >= 60 && data.wss < 80).length
    const fairSites = sites.filter(([_, data]) => data.wss >= 40 && data.wss < 60).length
    const poorSites = sites.filter(([_, data]) => data.wss >= 20 && data.wss < 40).length
    const criticalSites = sites.filter(([_, data]) => data.wss < 20).length
    const avgWSS = sites.length > 0
        ? Math.round(sites.reduce((sum, [_, data]) => sum + data.wss, 0) / sites.length)
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
                    title="Avg Safety"
                    value={avgWSS}
                    subtitle={avgWSS >= 80 ? "Excellent" : avgWSS >= 60 ? "Good" : avgWSS >= 40 ? "Fair" : "Needs attention"}
                    icon={Shield}
                    iconColor={
                        avgWSS >= 80 ? "text-green-500" :
                            avgWSS >= 60 ? "text-blue-500" :
                                avgWSS >= 40 ? "text-yellow-500" :
                                    "text-red-500"
                    }
                />
                <StatCard
                    title="At Risk"
                    value={criticalSites + poorSites}
                    subtitle="Critical & poor safety"
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                />
                <StatCard
                    title="Safe Sites"
                    value={excellentSites + goodSites}
                    subtitle="Excellent & good safety"
                    icon={CheckCircle}
                    iconColor="text-green-500"
                />
            </div>

            {/* Safety Distribution */}
            {totalSites > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">
                            Safety Distribution
                        </CardTitle>
                        <CardDescription>
                            Overview of website safety levels across all analyzed sites
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RiskDistributionBar
                            critical={criticalSites}
                            high={poorSites}
                            medium={fairSites}
                            low={excellentSites + goodSites}
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
