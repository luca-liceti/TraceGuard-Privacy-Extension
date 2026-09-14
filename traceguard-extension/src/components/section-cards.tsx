import { useTranslation } from "react-i18next"

import { StatCard } from "@/components/ui/stat-card"
import { useAppState, useDetectorLogs, useSiteCache, useExposureReport } from "@/lib/useStorage"
import { SiteRiskData } from "@/lib/types"

export function SectionCards() {
  const { t } = useTranslation()
  const appState = useAppState()
  const detectorLogs = useDetectorLogs()
  const { siteCache } = useSiteCache()
  // The footprint report is the mechanism behind the shared-data card. It names
  // what was handed over and where, which is actionable, instead of counting
  // risk events, which is not.
  const { report } = useExposureReport()

  // Calculate today and yesterday boundaries
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000

  // Helper to format trend
  const formatTrend = (today: number, yesterday: number) => {
    if (yesterday === 0) return "—"
    const pct = Math.round(((today - yesterday) / yesterday) * 100)
    return `${today >= yesterday ? "+" : ""}${pct}%`
  }

  // 1. Trackers Detected
  const totalTrackers = appState?.trackersDetected || 0
  const trackersToday = detectorLogs
    .filter(log => log.detector === 'tracking' && log.timestamp >= startOfToday)
    .reduce((sum, log) => sum + (log.details?.trackerCount || 0), 0)
  const trackersYesterday = detectorLogs
    .filter(log => log.detector === 'tracking' && log.timestamp >= startOfYesterday && log.timestamp < startOfToday)
    .reduce((sum, log) => sum + (log.details?.trackerCount || 0), 0)
  const trackersTrend = formatTrend(trackersToday, trackersYesterday)

  // ─── Enriched aggregates from site cache ───────────────────────────────────

  // Helper: get sites analyzed today (have lastAnalyzed >= startOfToday)
  const cacheSitesToday = Object.values(siteCache as Record<string, SiteRiskData>).filter(
    s => {
      const ts = typeof s.lastAnalyzed === 'number' ? s.lastAnalyzed : new Date(s.lastAnalyzed as string).getTime()
      return ts >= startOfToday
    }
  )
  const cacheSitesYesterday = Object.values(siteCache as Record<string, SiteRiskData>).filter(
    s => {
      const ts = typeof s.lastAnalyzed === 'number' ? s.lastAnalyzed : new Date(s.lastAnalyzed as string).getTime()
      return ts >= startOfYesterday && ts < startOfToday
    }
  )

  // 5. Cross-site requests, counted as third-party requests from enriched data.
  // Only thirdParty is summed. The blocked field is deliberately not read here: a
  // request recorded as blocked was blocked by the browser or another extension.
  const netToday = cacheSitesToday.reduce(
    (sum, s) => sum + (s.enrichedDetails?.networkRequests?.summary.thirdParty ?? 0), 0
  )
  const netYesterday = cacheSitesYesterday.reduce(
    (sum, s) => sum + (s.enrichedDetails?.networkRequests?.summary.thirdParty ?? 0), 0
  )

  const totalNetRequests = Object.values(siteCache as Record<string, SiteRiskData>).reduce(
    (sum, s) => sum + (s.enrichedDetails?.networkRequests?.summary.thirdParty ?? 0), 0
  )
  const netTrend = formatTrend(netToday, netYesterday)

  // 6. Fingerprinting, aggregate attempts from enriched data
  const fpToday = cacheSitesToday.reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )
  const fpYesterday = cacheSitesYesterday.reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )
  const totalFp = Object.values(siteCache as Record<string, SiteRiskData>).reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )
  const fpTrend = formatTrend(fpToday, fpYesterday)

  return (
    <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-3 grid grid-cols-1 gap-4">
      <StatCard
        title={t("Trackers Detected")}
        value={totalTrackers.toLocaleString()}
        subtitle={t("Tracking scripts detected")}
        trend={{
          direction: trackersToday >= trackersYesterday ? "up" : "down",
          value: trackersTrend,
          isPositive: trackersToday < trackersYesterday
        }}
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
        title={t("Cross-site Network Requests")}
        value={totalNetRequests.toLocaleString()}
        subtitle={t("Cross-site network calls detected")}
        trend={{
          direction: netToday >= netYesterday ? "up" : "down",
          value: netTrend,
          isPositive: netToday < netYesterday
        }}
      />

      <StatCard
        title={t("Fingerprinting Attempts")}
        value={totalFp.toLocaleString()}
        subtitle={t("Canvas, WebGL, audio & more")}
        trend={{
          direction: fpToday >= fpYesterday ? "up" : "down",
          value: fpTrend,
          isPositive: fpToday <= fpYesterday
        }}
      />
    </div>
  )
}

