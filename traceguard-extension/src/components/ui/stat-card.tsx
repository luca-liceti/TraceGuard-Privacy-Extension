/**
 * =============================================================================
 * STAT CARD - Reusable Statistics Display Component
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This component displays a single statistic/metric in a nice card format.
 * It's used throughout the dashboard to show key numbers like:
 * - "Sites Analyzed: 42"
 * - "High Risk: 5"
 * - "Privacy Score: 85"
 * 
 * WHY THIS EXISTS:
 * Before this unified component, each page had its own StatCard with slightly
 * different props and styling. Now we have ONE component that handles all cases.
 * 
 * USAGE EXAMPLES:
 * 
 * Basic:
 * <StatCard title="Total Sites" value={42} />
 * 
 * With icon and color:
 * <StatCard 
 *     title="High Risk" 
 *     value={5} 
 *     icon={AlertTriangle} 
 *     valueColor="text-red-500"
 * />
 * 
 * With subtitle and link:
 * <StatCard 
 *     title="Sites Analyzed" 
 *     value={42}
 *     subtitle="3 today"
 *     href="/sites"
 * />
 * 
 * With trend indicator:
 * <StatCard 
 *     title="Average Risk" 
 *     value={35}
 *     trend={{ direction: 'down', value: '-5%' }}
 * />
 * =============================================================================
 */

"use client"

import * as React from "react"
import { Link } from "react-router-dom"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Trend indicator for showing change direction
 */
export interface TrendIndicator {
    /** Which direction the metric is trending */
    direction: 'up' | 'down' | 'stable';
    /** Display value like "+5%", "-3 pts", etc. */
    value: string;
    /** Override: is this trend good or bad? (default: up=bad for risk, down=good) */
    isPositive?: boolean;
}

/**
 * Props for the StatCard component
 */
export interface StatCardProps {
    /** The metric label (displayed as uppercase heading) */
    title: string;
    /** The main value to display */
    value: string | number;
    /** Optional descriptive text below the value */
    subtitle?: string;
    /** Optional icon component to display */
    icon?: React.ComponentType<{ className?: string }>;
    /** Color class for the icon (e.g., "text-blue-500") */
    iconColor?: string;
    /** Color class for the value text */
    valueColor?: string;
    /** If provided, wraps the card in a Link to this path */
    href?: string;
    /** Optional trend indicator */
    trend?: TrendIndicator;
    /** Additional className for the card */
    className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A versatile statistic display card used throughout the dashboard.
 * 
 * Features:
 * - Displays a title, value, and optional subtitle
 * - Supports an optional icon with custom color
 * - Can show trend indicators (up/down arrows with values)
 * - Optionally clickable with navigation
 * - Consistent styling across all pages
 */
export function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor,
    valueColor,
    href,
    trend,
    className,
}: StatCardProps) {
    // Build the card content
    const content = (
        <Card
            className={cn(
                "transition-all",
                href && "hover:border-primary/50 hover:shadow-md cursor-pointer",
                className
            )}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    {/* Main content area */}
                    <div className="space-y-1 min-w-0 flex-1">
                        {/* Title */}
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {title}
                        </p>

                        {/* Value with optional trend */}
                        <div className="flex items-baseline gap-2">
                            <span className={cn("text-2xl font-bold", valueColor)}>
                                {value}
                            </span>

                            {/* Trend indicator */}
                            {trend && (
                                <span
                                    className={cn(
                                        "text-xs flex items-center",
                                        // Determine color based on direction and isPositive
                                        trend.isPositive !== undefined
                                            ? trend.isPositive
                                                ? "text-green-500"
                                                : "text-red-500"
                                            : trend.direction === 'up'
                                                ? "text-red-500" // Default: up is bad (increasing risk)
                                                : trend.direction === 'down'
                                                    ? "text-green-500" // Default: down is good
                                                    : "text-muted-foreground"
                                    )}
                                >
                                    {trend.direction === 'up' && (
                                        <TrendingUp className="h-3 w-3 mr-0.5" />
                                    )}
                                    {trend.direction === 'down' && (
                                        <TrendingDown className="h-3 w-3 mr-0.5" />
                                    )}
                                    {trend.value}
                                </span>
                            )}
                        </div>

                        {/* Subtitle */}
                        {subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {/* Icon (if provided) */}
                    {Icon && (
                        <Icon className={cn("h-5 w-5 flex-shrink-0 ml-3", iconColor || "text-muted-foreground")} />
                    )}
                </div>
            </CardContent>
        </Card>
    )

    // Wrap in Link if href is provided
    if (href) {
        return <Link to={href}>{content}</Link>
    }

    return content
}

// Export as default for backward compatibility
export default StatCard
