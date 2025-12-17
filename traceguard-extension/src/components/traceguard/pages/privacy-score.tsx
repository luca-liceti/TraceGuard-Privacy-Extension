"use client"

import React from "react"
import { useAppState, useScoreHistory } from "@/lib/useStorage"
import {
    ShieldCheck,
    TrendingUp,
    TrendingDown,
    Info,
    Minus,
    Calendar,
    BarChart3,
    Target,
} from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

function getScoreLevel(score: number) {
    if (score >= 90) return { level: "Excellent", color: "text-green-500", bg: "bg-green-500/10", description: "Your browsing habits are excellent!" }
    if (score >= 70) return { level: "Good", color: "text-blue-500", bg: "bg-blue-500/10", description: "Good privacy practices, keep it up!" }
    if (score >= 50) return { level: "Fair", color: "text-yellow-500", bg: "bg-yellow-500/10", description: "Room for improvement in privacy." }
    if (score >= 30) return { level: "Poor", color: "text-orange-500", bg: "bg-orange-500/10", description: "Consider reviewing your browsing habits." }
    return { level: "Critical", color: "text-red-500", bg: "bg-red-500/10", description: "Immediate attention recommended." }
}

// Stat card component
function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    valueColor,
}: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ComponentType<{ className?: string }>
    valueColor?: string
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {title}
                        </p>
                        <p className={cn("text-2xl font-bold", valueColor)}>{value}</p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function PrivacyScorePage() {
    const state = useAppState()
    const scoreHistory = useScoreHistory()

    if (!state) return <div className="p-4">Loading...</div>

    // Prepare chart data
    const chartData = scoreHistory.length > 0
        ? scoreHistory.slice(-30).map(entry => ({
            date: new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: entry.ups,
            fullDate: new Date(entry.timestamp).toLocaleString(),
        }))
        : []

    // Calculate trend
    const trend = scoreHistory.length >= 2
        ? scoreHistory[scoreHistory.length - 1].ups - scoreHistory[scoreHistory.length - 2].ups
        : 0

    // Calculate average score
    const avgScore = scoreHistory.length > 0
        ? Math.round(scoreHistory.reduce((sum, entry) => sum + entry.ups, 0) / scoreHistory.length)
        : state.ups

    // Calculate lowest score
    const lowestScore = scoreHistory.length > 0
        ? Math.min(...scoreHistory.map(entry => entry.ups))
        : state.ups

    const scoreLevel = getScoreLevel(state.ups)

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Privacy Score
                </h1>
                <p className="text-muted-foreground mt-2">
                    Your User Privacy Score (UPS) reflects how safely you browse the web
                </p>
            </div>

            {/* Hero Score Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Score Circle */}
                        <div className={cn(
                            "relative flex items-center justify-center w-32 h-32 rounded-full",
                            scoreLevel.bg
                        )}>
                            <div className="text-center">
                                <span className={cn("text-5xl font-bold", scoreLevel.color)}>
                                    {state.ups}
                                </span>
                            </div>
                            <ShieldCheck className={cn(
                                "absolute -bottom-2 -right-2 h-10 w-10",
                                scoreLevel.color
                            )} />
                        </div>

                        {/* Score Info */}
                        <div className="flex-1 text-center md:text-left">
                            <Badge className={cn("mb-2", scoreLevel.bg, scoreLevel.color, "border-0")}>
                                {scoreLevel.level}
                            </Badge>
                            <p className="text-muted-foreground">
                                {scoreLevel.description}
                            </p>

                            {/* Trend */}
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-4">
                                {trend > 0 ? (
                                    <>
                                        <TrendingUp className="h-5 w-5 text-green-500" />
                                        <span className="text-green-500 font-medium">+{trend} from previous</span>
                                    </>
                                ) : trend < 0 ? (
                                    <>
                                        <TrendingDown className="h-5 w-5 text-red-500" />
                                        <span className="text-red-500 font-medium">{trend} from previous</span>
                                    </>
                                ) : (
                                    <>
                                        <Minus className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-muted-foreground font-medium">No change</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Row */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <StatCard
                    title="Current Score"
                    value={state.ups}
                    subtitle="Your privacy rating"
                    icon={Target}
                    valueColor={scoreLevel.color}
                />
                <StatCard
                    title="Average Score"
                    value={avgScore}
                    subtitle="All-time average"
                    icon={BarChart3}
                    valueColor={getScoreLevel(avgScore).color}
                />
                <StatCard
                    title="Lowest Score"
                    value={lowestScore}
                    subtitle="Historical low"
                    icon={Calendar}
                    valueColor={getScoreLevel(lowestScore).color}
                />
            </div>

            {/* Score History Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        30-Day Privacy Score Trend
                    </CardTitle>
                    <CardDescription>
                        Track how your privacy score changes over time
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {chartData.length > 0 ? (
                        <ChartContainer
                            config={{
                                score: {
                                    label: "Privacy Score",
                                    color: "hsl(var(--primary))",
                                },
                            }}
                            className="h-[300px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis
                                        dataKey="date"
                                        className="text-muted-foreground text-xs"
                                        tick={{ fill: 'currentColor', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        className="text-muted-foreground text-xs"
                                        domain={[0, 100]}
                                        tick={{ fill: 'currentColor', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <ChartTooltip
                                        content={<ChartTooltipContent />}
                                        formatter={(value: number) => [`${value}`, "Privacy Score"]}
                                        labelFormatter={(label, payload) => {
                                            const data = payload?.[0]?.payload
                                            return data?.fullDate || label
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        fill="url(#scoreGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No score history available yet</p>
                                <p className="text-xs mt-1">Browse some websites to start tracking</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* How UPS is Calculated */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Info className="h-4 w-4 text-primary" />
                        How Your Privacy Score is Calculated
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                1
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Starting Score</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Everyone starts with a perfect score of 100. Your score decreases when you enter personal information on websites.
                                </p>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                2
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Score Decay</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    When you enter sensitive information, your score decreases based on:
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1 ml-2">
                                    <li><strong>Sensitivity Level:</strong> High (passwords, credit cards) cause more decay</li>
                                    <li><strong>Website Risk:</strong> Entering data on risky websites causes more decay</li>
                                    <li><strong>Frequency:</strong> Multiple entries compound the effect</li>
                                </ul>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                3
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Score Recovery</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your score recovers when you visit safe websites (safety score ≥ 70). The safer the site, the more recovery you earn. Building a streak of 10+ safe sites grants bonus recovery.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
