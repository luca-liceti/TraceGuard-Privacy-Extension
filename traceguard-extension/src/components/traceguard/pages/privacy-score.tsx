/**
 * =============================================================================
 * PRIVACY SCORE PAGE - User Privacy Score (UPS) Dashboard
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This page shows a detailed view of your User Privacy Score (UPS), including
 * history, trends, and explanations of how the score is calculated.
 * 
 * DISPLAYED INFORMATION:
 * 
 * 1. HERO SECTION
 *    - Large score display with color-coded status
 *    - Status levels: Excellent (90+), Good (70-89), Fair (50-69), 
 *      Poor (30-49), Critical (0-29)
 *    - Trend indicator showing improvement/decline
 * 
 * 2. STATISTICS ROW
 *    - Current Score: Your current UPS
 *    - Average Score: All-time average
 *    - Lowest Score: Historical minimum
 * 
 * 3. SCORE HISTORY CHART
 *    - 30-day trend chart showing UPS over time
 *    - Interactive area chart with tooltips
 * 
 * 4. HOW IT'S CALCULATED
 *    - Explanation of starting score (100)
 *    - Score decay factors (PII entry, site risk, frequency)
 *    - Score recovery through safe browsing
 * 
 * SCORE COLORS:
 *    - Green (90+): Excellent privacy practices
 *    - Blue (70-89): Good habits
 *    - Yellow (50-69): Room for improvement
 *    - Orange (30-49): Needs attention
 *    - Red (0-29): Critical - action needed
 * =============================================================================
 */

"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { useAppState, useScoreHistory } from "@/lib/useStorage"
import {
    ShieldUser,
    TrendingUp,
    TrendingDown,
    Info,
    Minus,
    Calendar,
    BarChart2,
    Target,
} from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { StatCard } from "@/components/ui/stat-card"
import { getStatusConfig } from "@/lib/risk-utils"

// getScoreLevel replaced by getStatusConfig from @/lib/risk-utils
// StatCard moved to @/components/ui/stat-card.tsx

export default function PrivacyScorePage() {
    const { t } = useTranslation()
    const state = useAppState()
    const scoreHistory = useScoreHistory()

    if (!state) return <div className="p-4">{t("Loading...")}</div>

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

    const scoreLevel = getStatusConfig(state.ups)

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    {t("Privacy Score")}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {t("Your User Privacy Score (UPS) reflects how safely you browse the web")}
                </p>
            </div>

            {/* Hero Score Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Score Circle */}
                        <div className={cn(
                            "relative flex items-center justify-center w-32 h-32 rounded-full",
                            scoreLevel.bgColor
                        )}>
                            <div className="text-center">
                                <span className={cn("text-5xl font-bold", scoreLevel.color)}>
                                    {state.ups}
                                </span>
                            </div>
                            <ShieldUser className={cn(
                                "absolute -bottom-2 -right-2 h-10 w-10",
                                scoreLevel.color
                            )} />
                        </div>

                        {/* Score Info */}
                        <div className="flex-1 text-center md:text-left">
                            <Badge className={cn("mb-2", scoreLevel.bgColor, scoreLevel.color, "border-0")}>
                                {t(scoreLevel.label)}
                            </Badge>
                            <p className="text-muted-foreground">
                                {t(scoreLevel.description)}
                            </p>

                            {/* Trend */}
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-4">
                                {trend > 0 ? (
                                    <>
                                        <TrendingUp className="h-5 w-5 text-success" />
                                        <span className="text-success font-medium">+{trend} {t("from previous")}</span>
                                    </>
                                ) : trend < 0 ? (
                                    <>
                                        <TrendingDown className="h-5 w-5 text-destructive" />
                                        <span className="text-destructive font-medium">{trend} {t("from previous")}</span>
                                    </>
                                ) : (
                                    <>
                                        <Minus className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-muted-foreground font-medium">{t("No change")}</span>
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
                    title={t("Current Score")}
                    value={state.ups}
                    subtitle={t("Your privacy rating")}
                    icon={Target}
                    iconColor="text-primary"
                    valueColor={scoreLevel.color}
                />
                <StatCard
                    title={t("Average Score")}
                    value={avgScore}
                    subtitle={t("All-time average")}
                    icon={BarChart3}
                    iconColor="text-warning"
                    valueColor={getStatusConfig(avgScore).color}
                />
                <StatCard
                    title={t("Lowest Score")}
                    value={lowestScore}
                    subtitle={t("Historical low")}
                    icon={Calendar}
                    iconColor="text-destructive"
                    valueColor={getStatusConfig(lowestScore).color}
                />
            </div>

            {/* Score History Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-primary" />
                        {t("30-Day Privacy Score Trend")}
                    </CardTitle>
                    <CardDescription>
                        {t("Track how your privacy score changes over time")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {chartData.length > 0 ? (
                        <ChartContainer
                            config={{
                                score: {
                                    label: t("Privacy Score"),
                                    color: "var(--primary)",
                                },
                            }}
                            className="h-[300px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-score)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--color-score)" stopOpacity={0} />
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
                                        formatter={(value: number) => [`${value}`, t("Privacy Score")]}
                                        labelFormatter={(label, payload) => {
                                            const data = payload?.[0]?.payload
                                            return data?.fullDate || label
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="var(--color-score)"
                                        strokeWidth={2}
                                        fill="url(#scoreGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{t("No score history available yet")}</p>
                                <p className="text-xs mt-1">{t("Browse some websites to start tracking")}</p>
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
                        {t("How Your Privacy Score is Calculated")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                1
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">{t("Starting Score")}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t("Everyone starts with a perfect score of 100. Your score decreases when you enter personal information on websites.")}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                2
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">{t("Score Decay")}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t("When you enter sensitive information, your score decreases based on:")}
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1 ml-2">
                                    <li><strong>{t("Sensitivity Level:")}</strong> {t("High (passwords, credit cards) cause more decay")}</li>
                                    <li><strong>{t("Website Risk:")}</strong> {t("Entering data on risky websites causes more decay")}</li>
                                    <li><strong>{t("Frequency:")}</strong> {t("Multiple entries compound the effect")}</li>
                                </ul>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                3
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">{t("Score Recovery")}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t("Your score recovers when you visit safe websites (safety score ≥ 70). The safer the site, the more recovery you earn. Building a streak of 10+ safe sites grants bonus recovery.")}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
