import { cn } from "@/lib/utils"
import { SAFETY_CONFIGS } from "@/lib/risk-utils"

/**
 * Standardized color mappings for letter grades (A-F)
 * Palette: A=success, B=success, C=warning, D=alert, E/F=destructive
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
        case "A": return "bg-success/10 border-transparent"
        case "B": return "bg-success/10 border-transparent"
        case "C": return "bg-warning/10 border-transparent"
        case "D": return "bg-alert/10 border-transparent"
        case "E":
        case "F": return "bg-destructive/10 border-transparent"
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
        case "excellent": return "bg-success/10 border-transparent"
        case "good":      return "bg-success/10 border-transparent"
        case "fair":      return "bg-warning/10 border-transparent"
        case "poor":      return "bg-alert/10 border-transparent"
        case "critical":  return "bg-destructive/10 border-transparent"
        default: return "bg-muted/20 border-transparent"
    }
}

/**
 * Standardized border styles for safety levels
 */
export function getSafetyBorderColor(level: string | undefined | null): string {
    switch (level?.toLowerCase()) {
        case "excellent": return "border-l-success"
        case "good":      return "border-l-success"
        case "fair":      return "border-l-warning"
        case "poor":      return "border-l-alert"
        case "critical":  return "border-l-destructive"
        default: return "border-l-muted-foreground"
    }
}

/**
 * Standardized badge styles for risk levels
 */
export function getRiskLevelBadge(riskLevel: string | undefined | null): { variant: "outline" | "secondary", extra: string } {
    switch (riskLevel?.toLowerCase()) {
        case "high":   return { variant: "outline", extra: "border-destructive/40 bg-destructive/10 text-destructive" }
        case "medium": return { variant: "outline", extra: "border-warning/40 bg-warning/10 text-warning" }
        case "low":    return { variant: "outline", extra: "border-success/40 bg-success/10 text-success" }
        default:       return { variant: "outline", extra: "border-success/40 bg-success/10 text-success" }
    }
}

/**
 * Standardized colors for status indicators/icons
 */
export function getIndicatorTextColor(type: 'success' | 'warning' | 'error'): string {
    switch (type) {
        case 'success': return "text-success"
        case 'warning': return "text-warning"
        case 'error': return "text-destructive"
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
            return { variant: "outline", extra: "border-destructive/40 bg-destructive/10 text-destructive" }
        case "analytics":
            return { variant: "outline", extra: "border-warning/40 bg-warning/10 text-warning" }
        case "social":
            return { variant: "outline", extra: "border-success/40 bg-success/10 text-success" }
        case "functional":
        case "necessary":
        case "content":
        case "cdn":
            return { variant: "outline", extra: "border-success/40 bg-success/10 text-success" }
        case "fingerprinting":
        case "cryptomining":
            // Replacing purple with destructive since it's highly malicious
            return { variant: "outline", extra: "border-destructive/40 bg-destructive/10 text-destructive" }
        default:
            return { variant: "secondary", extra: "" }
    }
}

/**
 * Standardized badge styles for header rating
 */
export function getHeaderRatingBadge(rating: string | undefined | null): { variant: "outline" | "secondary", extra: string } {
    switch (rating?.toLowerCase()) {
        case "good":    return { variant: "outline", extra: "border-success/40 bg-success/10 text-success" }
        case "fair":    return { variant: "outline", extra: "border-warning/40 bg-warning/10 text-warning" }
        case "poor":    return { variant: "outline", extra: "border-alert/40 bg-alert/10 text-alert" }
        case "missing": return { variant: "outline", extra: "border-destructive/40 bg-destructive/10 text-destructive" }
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
