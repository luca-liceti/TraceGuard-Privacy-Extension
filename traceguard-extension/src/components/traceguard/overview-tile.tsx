"use client"

import React from "react"
import { Link } from "react-router-dom"
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface OverviewTileProps {
    title: string
    icon: React.ComponentType<{ className?: string }>
    value: string | number
    subtitle: string
    href: string
    status?: 'success' | 'warning' | 'danger' | 'neutral'
    trend?: {
        direction: 'up' | 'down' | 'stable'
        value: string
    }
    className?: string
}

const statusColors = {
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    danger: 'border-l-red-500',
    neutral: 'border-l-primary'
}

const statusTextColors = {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    neutral: 'text-foreground'
}

export function OverviewTile({
    title,
    icon: Icon,
    value,
    subtitle,
    href,
    status = 'neutral',
    trend,
    className
}: OverviewTileProps) {
    return (
        <Link to={href} className="block group">
            <Card className={cn(
                "border-l-4 transition-all duration-200 cursor-pointer",
                "hover:bg-accent hover:shadow-md",
                "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2",
                statusColors[status],
                className
            )}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={cn("text-2xl font-bold", statusTextColors[status])}>
                        {value}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                        {trend && (
                            <div className="flex items-center gap-1">
                                {trend.direction === 'up' && (
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                )}
                                {trend.direction === 'down' && (
                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                )}
                                {trend.direction === 'stable' && (
                                    <Minus className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {trend.value}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-primary flex items-center gap-1">
                            View details
                            <ChevronRight className="h-3 w-3" />
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

// Hero variant for the Privacy Score on Overview page
interface HeroTileProps {
    score: number
    trend?: {
        direction: 'up' | 'down' | 'stable'
        value: string
    }
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    href: string
}

const heroStatusConfig = {
    excellent: { color: 'text-green-500', bg: 'bg-green-500/10', label: 'EXCELLENT' },
    good: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'GOOD' },
    fair: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'FAIR' },
    poor: { color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'POOR' },
    critical: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'CRITICAL' }
}

export function HeroTile({ score, trend, status, href }: HeroTileProps) {
    const config = heroStatusConfig[status]

    return (
        <Link to={href} className="block group">
            <Card className={cn(
                "border-l-4 transition-all duration-200 cursor-pointer",
                "hover:bg-accent hover:shadow-md",
                status === 'excellent' || status === 'good' ? 'border-l-green-500' :
                    status === 'fair' ? 'border-l-yellow-500' :
                        status === 'poor' ? 'border-l-orange-500' : 'border-l-red-500'
            )}>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            {/* Score */}
                            <div className="text-center">
                                <div className={cn("text-5xl font-bold", config.color)}>
                                    {score}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    out of 100
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-16 w-px bg-border" />

                            {/* Status & Trend */}
                            <div>
                                <div className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                                    config.bg,
                                    config.color
                                )}>
                                    {config.label}
                                </div>
                                {trend && (
                                    <div className="flex items-center gap-1 mt-2">
                                        {trend.direction === 'up' && (
                                            <TrendingUp className="h-4 w-4 text-green-500" />
                                        )}
                                        {trend.direction === 'down' && (
                                            <TrendingDown className="h-4 w-4 text-red-500" />
                                        )}
                                        {trend.direction === 'stable' && (
                                            <Minus className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="text-sm text-muted-foreground">
                                            {trend.value}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground mb-2">
                                Your Privacy Score
                            </p>
                            <span className="text-sm text-primary flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                View full report
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

export default OverviewTile
