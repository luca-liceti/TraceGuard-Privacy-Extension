"use client"

import React from "react"
import { Link } from "react-router-dom"
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getSafetyTextColor, getSafetyBgColor, getSafetyBorderColor } from "@/lib/theme-utils"

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
    success: 'border-l-success',
    warning: 'border-l-warning',
    danger: 'border-l-destructive',
    neutral: 'border-l-primary'
}

const statusTextColors = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
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
                                    <TrendingUp className="h-3 w-3 text-success" />
                                )}
                                {trend.direction === 'down' && (
                                    <TrendingDown className="h-3 w-3 text-destructive" />
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
    excellent: { label: 'EXCELLENT' },
    good: { label: 'GOOD' },
    fair: { label: 'FAIR' },
    poor: { label: 'POOR' },
    critical: { label: 'CRITICAL' }
}

export function HeroTile({ score, trend, status, href }: HeroTileProps) {
    const config = heroStatusConfig[status]

    return (
        <Link to={href} className="block group">
            <Card className={cn(
                "relative overflow-hidden transition-all duration-200 border-l-4",
                "hover:bg-accent hover:shadow-md",
                getSafetyBorderColor(status)
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
                                <Badge variant="secondary" className={cn(
                                    "text-xs font-semibold px-2.5 py-0.5 border-transparent",
                                    getSafetyTextColor(status),
                                    getSafetyBgColor(status)
                                )}>
                                    {config.label}
                                </Badge>
                                {trend && (
                                    <div className="flex items-center gap-1 mt-2">
                                        {trend.direction === 'up' && (
                                            <TrendingUp className="h-4 w-4 text-success" />
                                        )}
                                        {trend.direction === 'down' && (
                                            <TrendingDown className="h-4 w-4 text-destructive" />
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
