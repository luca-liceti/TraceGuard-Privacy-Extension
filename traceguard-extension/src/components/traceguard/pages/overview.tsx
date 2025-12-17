"use client"

import { useEffect, useState } from "react"
import { useAppState, useNotifications, useScoreHistory, useSettings } from "@/lib/useStorage"
import {
    Globe,
    TrendingUp,
    TrendingDown,
    FileText,
    ShieldCheck,
    ShieldAlert,
    Bell,
    ChevronRight,
    AlertTriangle,
    AlertCircle,
    Info,
    Flame,
    Minus,
} from "lucide-react"
import { ResponsiveContainer, AreaChart, Area } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { SiteRiskData, NotificationEvent } from "@/lib/types"

function getScoreStatus(score: number): { label: string; color: string; bgColor: string } {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-500', bgColor: 'bg-green-500/10' }
    if (score >= 70) return { label: 'Good', color: 'text-blue-500', bgColor: 'bg-blue-500/10' }
    if (score >= 50) return { label: 'Fair', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' }
    if (score >= 30) return { label: 'Poor', color: 'text-orange-500', bgColor: 'bg-orange-500/10' }
    return { label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500/10' }
}

function formatTimeAgo(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
}

function getSeverityIcon(severity: NotificationEvent['severity']) {
    switch (severity) {
        case 'critical':
            return <AlertTriangle className="h-4 w-4 text-red-500" />
        case 'warning':
            return <AlertCircle className="h-4 w-4 text-yellow-500" />
        case 'info':
        default:
            return <Info className="h-4 w-4 text-blue-500" />
    }
}

// Stat card component for consistent styling
function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor = "text-primary",
    href,
}: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ComponentType<{ className?: string }>
    iconColor?: string
    href?: string
}) {
    const content = (
        <Card className={cn("transition-all", href && "hover:border-primary/50 hover:shadow-md cursor-pointer")}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {title}
                        </p>
                        <p className="text-2xl font-bold">{value}</p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <div className={cn("p-2.5 rounded-lg bg-muted", iconColor)}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )

    if (href) {
        return <Link to={href}>{content}</Link>
    }
    return content
}

export default function OverviewPage() {
    const state = useAppState()
    const settings = useSettings()
    const scoreHistory = useScoreHistory()
    const { notifications } = useNotifications()
    const [siteCache, setSiteCache] = useState<Record<string, SiteRiskData>>({})
    const [todayVisits, setTodayVisits] = useState(0)
    const [highRiskCount, setHighRiskCount] = useState(0)

    // Load site cache
    useEffect(() => {
        const loadSiteCache = async () => {
            const result = await chrome.storage.local.get('siteCache')
            const cache = (result.siteCache || {}) as Record<string, SiteRiskData>
            setSiteCache(cache)

            // Calculate today's visits
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const todayStart = today.getTime()

            let todayCount = 0
            let highRisk = 0

            Object.values(cache).forEach(site => {
                if (site.lastVisit && site.lastVisit >= todayStart) {
                    todayCount++
                }
                // High risk = low safety score (WSS < 40)
                if (site.wss < 40) {
                    highRisk++
                }
            })

            setTodayVisits(todayCount)
            setHighRiskCount(highRisk)
        }

        loadSiteCache()

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.siteCache) {
                loadSiteCache()
            }
        }
        chrome.storage.onChanged.addListener(listener)
        return () => chrome.storage.onChanged.removeListener(listener)
    }, [])

    if (!state) return <div className="p-4">Loading...</div>

    // Calculate trend
    const trend = scoreHistory.length >= 2
        ? scoreHistory[scoreHistory.length - 1].ups - scoreHistory[scoreHistory.length - 2].ups
        : 0

    // Calculate average WSS (safety score)
    const siteValues = Object.values(siteCache)
    const avgWSS = siteValues.length > 0
        ? Math.round(siteValues.reduce((sum, site) => sum + site.wss, 0) / siteValues.length)
        : 0

    // Prepare sparkline data for Privacy Score hero (last 10 entries)
    const sparklineData = scoreHistory.slice(-10).map(entry => ({
        score: entry.ups
    }))

    // Get recent notifications (last 5)
    const recentNotifications = notifications.slice(0, 5)

    // Get whitelist/blacklist counts from settings
    const whitelistCount = settings?.whitelist?.length || 0
    const blacklistCount = settings?.blacklist?.length || 0

    const scoreStatus = getScoreStatus(state.ups)

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Overview</h1>
                <p className="text-muted-foreground mt-2">
                    Your privacy and security at a glance
                </p>
            </div>

            {/* Hero - Privacy Score */}
            <Link to="/privacy-score">
                <Card className="relative overflow-hidden hover:shadow-lg transition-all hover:border-primary/50">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-8">
                                {/* Score Circle */}
                                <div className={cn(
                                    "relative flex items-center justify-center w-28 h-28 rounded-full",
                                    scoreStatus.bgColor
                                )}>
                                    <div className="text-center">
                                        <span className={cn("text-4xl font-bold", scoreStatus.color)}>
                                            {state.ups}
                                        </span>
                                    </div>
                                    {state.ups >= 70 ? (
                                        <ShieldCheck className={cn("absolute -bottom-1 -right-1 h-8 w-8", scoreStatus.color)} />
                                    ) : (
                                        <ShieldAlert className={cn("absolute -bottom-1 -right-1 h-8 w-8", scoreStatus.color)} />
                                    )}
                                </div>

                                {/* Score Info */}
                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold text-foreground">Privacy Score</h2>
                                    <Badge className={cn("mt-1", scoreStatus.bgColor, scoreStatus.color, "border-0")}>
                                        {scoreStatus.label}
                                    </Badge>
                                    {/* Sparkline showing recent UPS trend */}
                                    {sparklineData.length > 1 ? (
                                        <div className="w-32 h-10 mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={sparklineData}>
                                                    <defs>
                                                        <linearGradient id="upsGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area
                                                        type="monotone"
                                                        dataKey="score"
                                                        stroke="hsl(var(--primary))"
                                                        strokeWidth={2}
                                                        fill="url(#upsGradient)"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            {trend > 0 ? (
                                                <>
                                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                                    <span className="text-green-500">+{trend} pts</span>
                                                </>
                                            ) : trend < 0 ? (
                                                <>
                                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                                    <span className="text-red-500">{trend} pts</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Minus className="h-4 w-4" />
                                                    <span>No change</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
            </Link>

            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Sites Analyzed"
                    value={state.sitesAnalyzed}
                    subtitle={`${todayVisits} today`}
                    icon={Globe}
                    iconColor="text-blue-500"
                    href="/sites"
                />
                <StatCard
                    title="Safe Streak"
                    value={state.safeVisitStreak}
                    subtitle="Consecutive safe sites"
                    icon={Flame}
                    iconColor="text-orange-500"
                    href="/privacy-score"
                />
                <StatCard
                    title="High Risk Sites"
                    value={highRiskCount}
                    subtitle="Need attention"
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                    href="/website-safety"
                />
                <StatCard
                    title="PII Events"
                    value={state.piiEventsCount}
                    subtitle="Data entries logged"
                    icon={FileText}
                    iconColor="text-orange-500"
                    href="/activity-logs"
                />
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Website Safety Quick View */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Globe className="h-4 w-4 text-primary" />
                                Website Safety
                            </CardTitle>
                            <Link to="/website-safety">
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                    View All
                                    <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50">
                                <span className="text-sm text-muted-foreground">Average Safety Score</span>
                                <Badge variant="outline" className={cn(
                                    avgWSS >= 70 ? "border-green-500 text-green-500" :
                                        avgWSS >= 40 ? "border-yellow-500 text-yellow-500" :
                                            "border-red-500 text-red-500"
                                )}>
                                    {avgWSS}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50">
                                <span className="text-sm text-muted-foreground">Trusted Sites</span>
                                <Badge variant="secondary">{whitelistCount}</Badge>
                            </div>
                            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50">
                                <span className="text-sm text-muted-foreground">Blocked Sites</span>
                                <Badge variant="secondary">{blacklistCount}</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Notifications */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Bell className="h-4 w-4 text-primary" />
                                Recent Activity
                            </CardTitle>
                            <Link to="/activity-logs">
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                    View All
                                    <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {recentNotifications.length > 0 ? (
                            <div className="space-y-1.5">
                                {recentNotifications.slice(0, 3).map((notification) => (
                                    <Link
                                        key={notification.id}
                                        to={notification.actionUrl || '/activity-logs'}
                                        className={cn(
                                            "flex items-center gap-2.5 p-2.5 rounded-lg transition-colors hover:bg-muted/50",
                                            !notification.read && "bg-primary/5"
                                        )}
                                    >
                                        <div className="flex-shrink-0">
                                            {getSeverityIcon(notification.severity)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "text-sm truncate",
                                                !notification.read && "font-medium"
                                            )}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {formatTimeAgo(notification.timestamp)}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-muted-foreground">
                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No activity yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
