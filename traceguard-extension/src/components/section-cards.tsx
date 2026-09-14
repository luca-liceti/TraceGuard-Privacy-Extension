import { useTranslation } from "react-i18next"

import { StatCard } from "@/components/ui/stat-card"
import { useAppState, useSiteCache, useExposureReport } from "@/lib/useStorage"
import { SiteRiskData } from "@/lib/types"

/**
 * The Overview stat row.
 *
 * Every card here reports a state, never a trend. A percentage against these
 * numbers implied a decision the reader could make about it, and there is none:
 * the count of trackers on the pages you happened to open is not something you
 * choose. The one card that can lead somewhere is the handover card, which names
 * the kinds of data involved and opens the page where the sites are listed.
 */
export function SectionCards() {
  const { t } = useTranslation()
  const appState = useAppState()
  const { siteCache } = useSiteCache()
  // The footprint report is the mechanism behind the handover card. It names
  // what was handed over and where, which is actionable, instead of counting
  // risk events, which is not.
  const { report } = useExposureReport()

  const totalTrackers = appState?.trackersDetected || 0

  // Fingerprinting attempts, aggregated from the enriched per-site data.
  const totalFingerprinting = Object.values(siteCache as Record<string, SiteRiskData>).reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )

  return (
    <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-3 grid grid-cols-1 gap-4">
      <StatCard
        title={t("Trackers Detected")}
        value={totalTrackers.toLocaleString()}
        subtitle={t("Tracking scripts detected")}
      />

      <StatCard
        title={t("Sites Holding Your Data")}
        value={report.totals.domains.toLocaleString()}
        subtitle={
          report.handedOver.length === 0
            ? t("Nothing handed over yet")
            : report.handedOver.map(group => t(group.fieldType)).join(", ")
        }
        href="/exposure"
      />

      <StatCard
        title={t("Fingerprinting Attempts")}
        value={totalFingerprinting.toLocaleString()}
        subtitle={t("Canvas, WebGL, audio & more")}
      />
    </div>
  )
}
