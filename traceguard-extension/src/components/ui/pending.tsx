import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Three dots that pulse in sequence while work is running. */
export function LoadingDots({ className }: { className?: string }) {
    return (
        <span aria-hidden="true" className={cn("inline-flex items-end gap-0.5", className)}>
            {[0, 1, 2].map((index) => (
                <span
                    key={index}
                    className="size-1 rounded-full bg-current motion-safe:animate-bounce"
                    style={{ animationDelay: `${index * 140}ms`, animationDuration: "1s" }}
                />
            ))}
        </span>
    )
}

/** Drops the static trailing dots a translated label usually carries. */
export function stripEllipsis(label: string) {
    return label.replace(/\s*(\.\.\.|…)\s*$/, "")
}

/**
 * An inline progress label: the translated text plus animated dots, with no
 * spinner. Use it inside a row, a button or a sentence, where the moving dots
 * are the only indicator and a second one would just repeat them.
 *
 * The label keeps its own translation (which usually ends in "..."), so no
 * translation keys change; the static dots are dropped here and replaced by the
 * animated ones. The animation stops when the caller stops rendering this, so
 * an error or a timeout is visible by the label disappearing rather than by
 * dots that keep moving forever.
 */
export function PendingLabel({
    label,
    className,
}: {
    label: string
    className?: string
}) {
    return (
        <span role="status" className={cn("inline-flex items-center gap-1.5", className)}>
            <span>{stripEllipsis(label)}</span>
            <LoadingDots />
        </span>
    )
}

/**
 * A block-level progress indicator: the animated circle and the translated
 * text, with no dots. Use it for a page, panel or card that is still loading,
 * where the circle is the only indicator.
 */
export function LoadingSpinner({
    label,
    className,
}: {
    label?: string
    className?: string
}) {
    return (
        <span role="status" className={cn("inline-flex items-center gap-2", className)}>
            <Loader2 aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
            {label ? <span>{stripEllipsis(label)}</span> : null}
        </span>
    )
}
