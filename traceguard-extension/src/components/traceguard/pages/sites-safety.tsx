/**
 * =============================================================================
 * SITES & SAFETY PAGE - Merged Website Safety + Sites Analyzed
 * =============================================================================
 *
 * TABS:
 *  1. "Safety Analysis" — site risk cards with WSS scores and risk distribution bar
 *  2. "Visit History"   — flat list sorted by last visit with bar chart of top 10
 *
 * Both tabs share the same search bar and a unified stats row at the top.
 * =============================================================================
 */

"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
    Globe,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Shield,
    Search,
    TrendingUp,
    Calendar,
    ChevronDown,
    ChevronUp,
    Filter,
    BarChart3,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { SiteRiskData } from "@/lib/types"
import { cn } from "@/lib/utils"
import { getSafetyLevel, SAFETY_CONFIGS } from "@/lib/risk-utils"
import { useSiteCache } from "@/lib/useStorage"

// ─────────────────────────────────────────────
// Safety configuration (icon-enriched)
// ─────────────────────────────────────────────
const safetyConfig = {
    excellent: { ...SAFETY_CONFIGS.excellent, icon: CheckCircle, border: SAFETY_CONFIGS.excellent.borderColor, bg: SAFETY_CONFIGS.excellent.bgColor },
    good:      { ...SAFETY_CONFIGS.good,      icon: CheckCircle, border: SAFETY_CONFIGS.good.borderColor,      bg: SAFETY_CONFIGS.good.bgColor },
    fair:      { ...SAFETY_CONFIGS.fair,      icon: AlertTriangle, border: SAFETY_CONFIGS.fair.borderColor,    bg: SAFETY_CONFIGS.fair.bgColor },
    poor:      { ...SAFETY_CONFIGS.poor,      icon: AlertTriangle, border: SAFETY_CONFIGS.poor.borderColor,    bg: SAFETY_CONFIGS.poor.bgColor },
    critical:  { ...SAFETY_CONFIGS.critical,  icon: XCircle,    border: SAFETY_CONFIGS.critical.borderColor,  bg: SAFETY_CONFIGS.critical.bgColor },
}

// ─────────────────────────────────────────────
// Risk distribution bar
// ─────────────────────────────────────────────
function RiskDistributionBar({
    critical, high, medium, low, total
}: { critical: number; high: number; medium: number; low: number; total: number }) {
    if (total === 0) return null
    const pct = (n: number) => (n / total) * 100
    return (
        <div className="space-y-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {critical > 0 && <div className="bg-red-500 transition-all"    style={{ width: `${pct(critical)}%` }} />}
                {high     > 0 && <div className="bg-orange-500 transition-all" style={{ width: `${pct(high)}%` }} />}
                {medium   > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${pct(medium)}%` }} />}
                {low      > 0 && <div className="bg-green-500 transition-all"  style={{ width: `${pct(low)}%` }} />}
            </div>
            <div className="flex justify-between text-xs">
                {[
                    { label: t("Critical"), count: critical, color: "bg-red-500" },
                    { label: t("High"),     count: high,     color: "bg-orange-500" },
                    { label: t("Medium"),   count: medium,   color: "bg-yellow-500" },
                    { label: t("Low"),      count: low,      color: "bg-green-500" },
                ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
                        <span className="text-muted-foreground">{label} ({count})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Site card (Safety Analysis tab)
// ─────────────────────────────────────────────
function SiteCard({ domain, data }: { domain: string; data: SiteRiskData }) {
    const { t } = useTranslation()
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
                                        <h3 className="font-medium text-foreground truncate">{domain}</h3>
                                        <Badge variant="outline" className={cn("flex-shrink-0 text-xs", config.color, config.border)}>
                                            {t(config.label)}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {t("Last analyzed:")} {new Date(data.lastAnalyzed).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5">
                                        <Icon className={cn("h-5 w-5", config.color)} />
                                        <span className={cn("text-2xl font-bold", config.color)}>{data.wss}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t("Safety Score")}</p>
                                </div>
                                {hasBreakdown && (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                                    {t("Risk Breakdown")}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                    {breakdownItems.map(([context, value]) => {
                                        const itemSafety = getSafetyLevel(value as number)
                                        const itemConfig = safetyConfig[itemSafety]
                                        return (
                                            <div key={context} className={cn("p-3 rounded-lg text-center", itemConfig.bg)}>
                                                <div className={cn("text-lg font-bold", itemConfig.color)}>{value}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{t(context)}</div>
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

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function SitesSafetyPage() {
    const { t } = useTranslation()
    const [searchQuery, setSearchQuery] = useState("")
    const [filterLevel, setFilterLevel] = useState<string>("all")
    const { sites } = useSiteCache()

    // ── Stats ──
    const totalSites     = sites.length
    const excellentSites = sites.filter(([_, d]) => d.wss >= 80).length
    const goodSites      = sites.filter(([_, d]) => d.wss >= 60 && d.wss < 80).length
    const fairSites      = sites.filter(([_, d]) => d.wss >= 40 && d.wss < 60).length
    const poorSites      = sites.filter(([_, d]) => d.wss >= 20 && d.wss < 40).length
    const criticalSites  = sites.filter(([_, d]) => d.wss < 20).length
    const avgWSS = totalSites > 0
        ? Math.round(sites.reduce((s, [_, d]) => s + d.wss, 0) / totalSites)
        : 0

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayCount = sites.filter(([_, d]) =>
        new Date(d.lastVisit || d.lastAnalyzed || 0).getTime() >= today.getTime()
    ).length

    const totalVisits     = sites.reduce((s, [_, d]) => s + (d.visitCount || 1), 0)

    // ── Safety Analysis tab ──
    const safetyFiltered = sites.filter(([domain, data]) => {
        const matchSearch = searchQuery === "" || domain.toLowerCase().includes(searchQuery.toLowerCase())
        let matchFilter = true
        if (filterLevel === "excellent") matchFilter = data.wss >= 80
        else if (filterLevel === "good")  matchFilter = data.wss >= 60 && data.wss < 80
        else if (filterLevel === "fair")  matchFilter = data.wss >= 40 && data.wss < 60
        else if (filterLevel === "poor")  matchFilter = data.wss >= 20 && data.wss < 40
        else if (filterLevel === "critical") matchFilter = data.wss < 20
        return matchSearch && matchFilter
    })
    const sortedBySafety = [...safetyFiltered].sort((a, b) => a[1].wss - b[1].wss)

    // ── Visit History tab ──
    const historyFiltered = sites.filter(([domain]) =>
        searchQuery === "" || domain.toLowerCase().includes(searchQuery.toLowerCase())
    )
    const sortedByVisit = [...historyFiltered].sort((a, b) => {
        const tA = new Date(a[1].lastVisit || a[1].lastAnalyzed || 0).getTime()
        const tB = new Date(b[1].lastVisit || b[1].lastAnalyzed || 0).getTime()
        return tB - tA
    })

    // Chart data
    const chartData = [...sites]
        .sort((a, b) => (b[1].visitCount || 0) - (a[1].visitCount || 0))
        .slice(0, 10)
        .map(([domain, data]) => ({
            domain: domain.length > 20 ? domain.substring(0, 20) + "…" : domain,
            visits: data.visitCount || 1,
            wss: data.wss,
        }))
    const maxVisits = chartData.length > 0 ? Math.max(...chartData.map(d => d.visits), 5) : 5
    const tickMax   = Math.ceil(maxVisits / 5) * 5
    const xAxisTicks = Array.from({ length: (tickMax / 5) + 1 }, (_, i) => i * 5)

    // Safety color for history list
    const getSafetyColor = (wss: number) => {
        if (wss >= 80) return "text-green-500"
        if (wss >= 60) return "text-blue-500"
        if (wss >= 40) return "text-yellow-500"
        if (wss >= 20) return "text-orange-500"
        return "text-red-500"
    }

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t("Sites & Safety")}</h1>
                <p className="text-muted-foreground mt-2">
                    {t("Analyze and monitor every website TraceGuard has scanned")}
                </p>
            </div>

            {/* Unified Stats Row */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                <StatCard
                    title={t("Total Sites")}
                    value={totalSites}
                    subtitle={t("Unique domains")}
                    icon={Globe}
                    iconColor="text-blue-500"
                    valueColor="text-foreground"
                />
                <StatCard
                    title={t("Avg Safety")}
                    value={avgWSS}
                    subtitle={avgWSS >= 80 ? t("Excellent") : avgWSS >= 60 ? t("Good") : avgWSS >= 40 ? t("Fair") : t("Needs attention")}
                    icon={Shield}
                    iconColor={avgWSS >= 80 ? "text-green-500" : avgWSS >= 60 ? "text-blue-500" : avgWSS >= 40 ? "text-yellow-500" : "text-red-500"}
                    valueColor={avgWSS >= 60 ? "text-green-500" : avgWSS >= 40 ? "text-yellow-500" : "text-red-500"}
                />
                <StatCard
                    title={t("At Risk")}
                    value={criticalSites + poorSites}
                    subtitle={t("Critical & poor safety")}
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                    valueColor={criticalSites + poorSites > 0 ? "text-red-500" : "text-green-500"}
                />
                <StatCard
                    title={t("Safe Sites")}
                    value={excellentSites + goodSites}
                    subtitle={t("Excellent & good safety")}
                    icon={CheckCircle}
                    iconColor="text-green-500"
                    valueColor="text-green-500"
                />
                <StatCard
                    title={t("Today")}
                    value={todayCount}
                    subtitle={t("Sites visited")}
                    icon={Calendar}
                    iconColor="text-purple-500"
                    valueColor="text-purple-500"
                />
            </div>

            {/* Shared Search + Filter Bar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="sites-search"
                                type="text"
                                placeholder={t("Search domains…")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filterLevel} onValueChange={setFilterLevel}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder={t("Filter by safety")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("All Sites")}</SelectItem>
                                <SelectItem value="excellent"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" />{t("Excellent")}</span></SelectItem>
                                <SelectItem value="good"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" />{t("Good")}</span></SelectItem>
                                <SelectItem value="fair"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-yellow-500" />{t("Fair")}</span></SelectItem>
                                <SelectItem value="poor"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-orange-500" />{t("Poor")}</span></SelectItem>
                                <SelectItem value="critical"><span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-red-500" />{t("Critical")}</span></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="safety" className="w-full">
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger value="safety" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Shield className="h-4 w-4" />
                        {t("Safety Analysis")}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <TrendingUp className="h-4 w-4" />
                        {t("Visit History")}
                    </TabsTrigger>
                </TabsList>

                {/* ── Safety Analysis Tab ── */}
                <TabsContent value="safety" className="mt-6 space-y-4">
                    {/* Risk Distribution */}
                    {totalSites > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-semibold">{t("Safety Distribution")}</CardTitle>
                                <CardDescription>{t("Overview of website safety levels across all analyzed sites")}</CardDescription>
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

                    {/* Site cards */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">{t("Analyzed Sites")}</h2>
                            <Badge variant="secondary">{sortedBySafety.length} {t("of")} {totalSites} {t("sites")}</Badge>
                        </div>
                        {sortedBySafety.length > 0 ? (
                            <div className="space-y-3">
                                {sortedBySafety.map(([domain, data]) => (
                                    <SiteCard key={domain} domain={domain} data={data} />
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12">
                                    <div className="text-center text-muted-foreground">
                                        <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">
                                            {filterLevel !== "all" || searchQuery ? t("No sites match the selected filters") : t("No sites analyzed yet")}
                                        </p>
                                        <p className="text-sm mt-1">
                                            {filterLevel !== "all" || searchQuery ? t("Try adjusting your search or filter criteria") : t("Browse some websites to see safety scores")}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* ── Visit History Tab ── */}
                <TabsContent value="history" className="mt-6 space-y-6">
                    {/* Chart */}
                    {chartData.length > 0 && (
                        <div className="w-full lg:w-1/2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-primary" />
                                        {t("Most Visited Sites")}
                                    </CardTitle>
                                    <CardDescription>{t("Top 10 sites by visit count")}</CardDescription>
                                </CardHeader>
                                <CardContent className="pb-4">
                                    <ChartContainer
                                        config={{ visits: { label: t("Visits"), color: "hsl(var(--primary))" } }}
                                        className="h-[300px] w-full aspect-auto"
                                    >
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
                                                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} ticks={xAxisTicks} domain={[0, tickMax]} />
                                                <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
                                                <ChartTooltip
                                                    content={<ChartTooltipContent />}
                                                    formatter={(value: any, _name: any, props: any) => (
                                                        <div className="flex flex-col gap-1 py-1">
                                                            <div className="font-bold text-foreground">{value} {t("visits")}</div>
                                                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("WSS:")} {props.payload.wss}</div>
                                                        </div>
                                                    )}
                                                />
                                                <Bar dataKey="visits" fill="#FFFFFF" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Site list */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-primary" />
                                    {t("All Sites")}
                                </CardTitle>
                            </div>
                            <CardDescription>{t("Showing")} {historyFiltered.length} {t("of")} {totalSites} {t("sites")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {sortedByVisit.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedByVisit.map(([domain, data]) => (
                                        <div
                                            key={domain}
                                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-medium text-foreground text-sm truncate">{domain}</h3>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(data.lastVisit || data.lastAnalyzed).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <TrendingUp className="h-3 w-3" />
                                                            {data.visitCount || 1} {t("visits")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right ml-3">
                                                <div className={cn("text-lg font-bold", getSafetyColor(data.wss))}>{data.wss}</div>
                                                <div className="text-xs text-muted-foreground">{t("WSS")}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    {searchQuery ? t("No sites match your search") : t("No sites analyzed yet")}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
