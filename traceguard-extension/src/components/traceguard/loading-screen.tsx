import { useTranslation } from "react-i18next"
import { stripEllipsis } from "@/components/ui/pending"

/**
 * Keeps the pre-React HTML placeholder and React loading states visually
 * consistent. The `.startup-loading` wrapper draws the animated circle itself
 * (see the page's CSS), so this renders the label only — one circle, no dots.
 */
export function LoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="startup-loading">
      <span role="status">{stripEllipsis(t("Loading TraceGuard..."))}</span>
    </div>
  )
}
