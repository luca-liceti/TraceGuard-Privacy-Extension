import { cn } from "@/lib/utils"
import { SAFETY_CONFIGS } from "@/lib/risk-utils"

/**
 * Standardized color mappings for letter grades (A-F)
 * Palette: A=emerald-500, B=emerald-400, C=yellow-500, D=orange-500, E/F=red-500
 */
export function getGradeTextColor(grade: string | undefined | null): string {
    switch (grade?.toUpperCase()) {
        case "A": return `${SAFETY_CONFIGS.excellent.color} font-bold`
        case "B": return `${SAFETY_CONFIGS.good.color} font-bold`
        case "C": return `${SAFETY_CONFIGS.fair.color} font-bold`
        case "D": return `${SAFETY_CONFIGS.poor.color} font-bold`
        case "E":
        case "F": return `${SAFETY_CONFIGS.critical.color} font-bold`
        default: return "text-muted-foreground font-bold"
    }
}

/**
 * Standardized background styles for letter grades
 */
export function getGradeBgColor(grade: string | undefined | null): string {
    switch (grade?.toUpperCase()) {
        case "A": return "bg-emerald-500/10 border-transparent"
        case "B": return "bg-emerald-400/10 border-transparent"
        case "C": return "bg-yellow-500/10 border-transparent"
        case "D": return "bg-orange-500/10 border-transparent"
        case "E":
        case "F": return "bg-red-500/10 border-transparent"
        default: return "bg-muted/20 border-transparent"
    }
}

/**
 * Standardized text colors for safety levels
 */
export function getSafetyTextColor(level: string | undefined | null): string {
    switch (level?.toLowerCase()) {
        case "excellent": return SAFETY_CONFIGS.excellent.color
        case "good":      return SAFETY_CONFIGS.good.color
        case "fair":      return SAFETY_CONFIGS.fair.color
        case "poor":      return SAFETY_CONFIGS.poor.color
        case "critical":  return SAFETY_CONFIGS.critical.color
        default: return "text-muted-foreground"
    }
}

/**
 * Standardized background styles for safety levels
 */
export function getSafetyBgColor(level: string | undefined | null): string {
    switch (level?.toLowerCase()) {
        case "excellent": return "bg-emerald-500/10 border-transparent"
        case "good":      return "bg-emerald-400/10 border-transparent"
        case "fair":      return "bg-yellow-500/10 border-transparent"
        case "poor":      return "bg-orange-500/10 border-transparent"
        case "critical":  return "bg-red-500/10 border-transparent"
        default: return "bg-muted/20 border-transparent"
    }
}

/**
 * Standardized border styles for safety levels
 */
export function getSafetyBorderColor(level: string | undefined | null): string {
    switch (level?.toLowerCase()) {
        case "excellent": return "border-l-emerald-500 dark:border-l-emerald-400"
        case "good":      return "border-l-emerald-400 dark:border-l-emerald-300"
        case "fair":      return "border-l-yellow-500 dark:border-l-yellow-400"
        case "poor":      return "border-l-orange-500 dark:border-l-orange-400"
        case "critical":  return "border-l-red-500 dark:border-l-red-400"
        default: return "border-l-muted-foreground"
    }
}

/**
 * Standardized badge styles for risk levels
 */
export function getRiskLevelBadge(riskLevel: string | undefined | null): { variant: "outline" | "secondary", extra: string } {
    switch (riskLevel?.toLowerCase()) {
        case "high":   return { variant: "outline", extra: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400" }
        case "medium": return { variant: "outline", extra: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400" }
        case "low":    return { variant: "outline", extra: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" }
        default:       return { variant: "outline", extra: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" }
    }
}

/**
 * Standardized colors for status indicators/icons
 */
export function getIndicatorTextColor(type: 'success' | 'warning' | 'error'): string {
    switch (type) {
        case 'success': return "text-emerald-500 dark:text-emerald-400"
        case 'warning': return "text-yellow-500 dark:text-yellow-400"
        case 'error': return "text-red-500 dark:text-red-400"
        default: return "text-muted-foreground"
    }
}

/**
 * Standardized badge styles for category tags
 */
export function getCategoryBadge(category: string | undefined | null): { variant: "outline" | "secondary", extra: string } {
    switch (category?.toLowerCase()) {
        case "marketing":
        case "advertising":
            return { variant: "outline", extra: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400" }
        case "analytics":
            return { variant: "outline", extra: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400" }
        case "social":
            return { variant: "outline", extra: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400 dark:text-emerald-300" }
        case "functional":
        case "necessary":
        case "content":
        case "cdn":
            return { variant: "outline", extra: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" }
        case "fingerprinting":
        case "cryptomining":
            return { variant: "outline", extra: "border-purple-500/40 bg-purple-500/10 text-purple-500 dark:text-purple-400" }
        default:
            return { variant: "secondary", extra: "" }
    }
}

/**
 * Standardized badge styles for header rating
 */
export function getHeaderRatingBadge(rating: string | undefined | null): { variant: "outline" | "secondary", extra: string } {
    switch (rating?.toLowerCase()) {
        case "good":    return { variant: "outline", extra: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" }
        case "fair":    return { variant: "outline", extra: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400" }
        case "poor":    return { variant: "outline", extra: "border-orange-500/40 bg-orange-500/10 text-orange-500 dark:text-orange-400" }
        case "missing": return { variant: "outline", extra: "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400" }
        default:        return { variant: "secondary", extra: "" }
    }
}

/**
 * Standardized text colors based on numerical WSS score (0-100)
 * Aligned with SAFETY_CONFIGS in risk-utils.ts
 */
export function getSafetyColorFromScore(score: number): string {
    if (score >= 80) return SAFETY_CONFIGS.excellent.color
    if (score >= 60) return SAFETY_CONFIGS.good.color
    if (score >= 40) return SAFETY_CONFIGS.fair.color
    if (score >= 20) return SAFETY_CONFIGS.poor.color
    return SAFETY_CONFIGS.critical.color
}
