"use client"

import React from "react"
import { useAppState, useScoreHistory } from "@/lib/useStorage"
import { ShieldCheck, TrendingUp, TrendingDown, Info } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

    // Get score level
    const getScoreLevel = (score: number) => {
        if (score >= 90) return { level: "EXCELLENT", color: "text-green-500", bg: "bg-green-500/10" }
        if (score >= 70) return { level: "GOOD", color: "text-blue-500", bg: "bg-blue-500/10" }
        if (score >= 50) return { level: "FAIR", color: "text-yellow-500", bg: "bg-yellow-500/10" }
        if (score >= 30) return { level: "POOR", color: "text-orange-500", bg: "bg-orange-500/10" }
        return { level: "CRITICAL", color: "text-red-500", bg: "bg-red-500/10" }
    }

    const scoreLevel = getScoreLevel(state.ups)

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Privacy Score (UPS)
                </h1>
                <p className="text-muted-foreground mt-2">
                    Your User Privacy Score reflects how safely you browse the web
                </p>
            </div>

            {/* Score Overview */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                {/* Current Score */}
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Current Score
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-5xl font-bold ${scoreLevel.color}`}>
                            {state.ups}
                        </div>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm mt-3 ${scoreLevel.bg} ${scoreLevel.color}`}>
                            {scoreLevel.level}
                        </div>
                    </CardContent>
                </Card>

                {/* Trend */}
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Recent Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {trend > 0 ? (
                                <>
                                    <TrendingUp className="h-8 w-8 text-green-500" />
                                    <span className="text-3xl font-bold text-green-500">+{trend}</span>
                                </>
                            ) : trend < 0 ? (
                                <>
                                    <TrendingDown className="h-8 w-8 text-red-500" />
                                    <span className="text-3xl font-bold text-red-500">{trend}</span>
                                </>
                            ) : (
                                <>
                                    <TrendingUp className="h-8 w-8 text-gray-500" />
                                    <span className="text-3xl font-bold text-gray-500">0</span>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {trend > 0 ? "Improving" : trend < 0 ? "Declining" : "Stable"}
                        </p>
                    </CardContent>
                </Card>

                {/* Total Events */}
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Score History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">
                            {scoreHistory.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Total data points
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Score History Chart */}
            <Card className=" ">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
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
                                    color: "hsl(142, 76%, 36%)",
                                },
                            }}
                            className="h-[400px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
                                    <XAxis
                                        dataKey="date"
                                        className="text-muted-foreground text-xs"
                                        tick={{ fill: 'currentColor' }}
                                    />
                                    <YAxis
                                        className="text-muted-foreground text-xs"
                                        domain={[0, 100]}
                                        tick={{ fill: 'currentColor' }}
                                    />
                                    <ChartTooltip
                                        content={<ChartTooltipContent />}
                                        formatter={(value: number) => [`${value}`, "Privacy Score"]}
                                        labelFormatter={(label, payload) => {
                                            const data = payload?.[0]?.payload
                                            return data?.fullDate || label
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="score"
                                        stroke="var(--color-score)"
                                        strokeWidth={3}
                                        dot={{ fill: "var(--color-score)", r: 5 }}
                                        activeDot={{ r: 7 }}
                                        name="Privacy Score"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                            No score history available yet
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* How UPS is Calculated */}
            <Card className=" ">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <Info className="h-5 w-5" />
                        How Your Privacy Score is Calculated
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">Starting Score</h3>
                        <p className="text-sm text-muted-foreground">
                            Everyone starts with a perfect score of 100. Your score decreases when you enter personal information on websites.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">Score Decay</h3>
                        <p className="text-sm text-muted-foreground">
                            When you enter sensitive information (passwords, credit cards, emails, etc.), your score decreases based on:
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                            <li><strong>Sensitivity Level:</strong> High (passwords, credit cards) cause more decay than Low (names, usernames)</li>
                            <li><strong>Website Risk:</strong> Entering data on risky websites causes more decay</li>
                            <li><strong>Frequency:</strong> Multiple entries compound the effect</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">Score Recovery</h3>
                        <p className="text-sm text-muted-foreground">
                            Your score gradually recovers over time when you practice safe browsing habits. Recovery is automatic and happens daily.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
