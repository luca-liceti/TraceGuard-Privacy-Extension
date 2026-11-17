import { useTranslation } from "react-i18next"
import { getSafetyConfig } from "@/lib/risk-utils"
import { cn } from "@/lib/utils"

interface SafetyRatingProps {
    score: number
    className?: string
    scoreClassName?: string
    showScale?: boolean
}

/** Present the score as one colored rating, rather than a number beside a badge. */
export function SafetyRating({ score, className, scoreClassName, showScale = true }: SafetyRatingProps) {
    const { t } = useTranslation()
    const rating = getSafetyConfig(score)

    return (
        <span
            aria-label={`${score}${showScale ? " out of 100" : ""}, ${t(rating.label)}`}
            className={cn("inline-flex items-baseline gap-1 whitespace-nowrap", className)}
        >
            <span className={cn("font-semibold tabular-nums", rating.color, scoreClassName)}>
                {score}
                {showScale && <span className="ml-0.5 text-[0.75em] font-normal opacity-70">/100</span>}
            </span>
            <span aria-hidden="true" className={cn("font-medium", rating.color)}>{t(rating.label)}</span>
        </span>
    )
}
