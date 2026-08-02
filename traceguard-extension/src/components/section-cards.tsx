import { TrendingUpIcon, TrendingDownIcon, ShieldIcon, ActivityIcon, GlobeIcon, NetworkIcon, FingerprintIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAppState, useDetectorLogs, useActivityLogs, useSiteCache } from "@/lib/useStorage"
import { SiteRiskData } from "@/lib/types"

export function SectionCards() {
  const { t } = useTranslation()
  const appState = useAppState()
  const detectorLogs = useDetectorLogs()
  const piiLogs = useActivityLogs()
  const { siteCache } = useSiteCache()

  // Calculate today and yesterday boundaries
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000

  // 1. Trackers Blocked
  const totalTrackers = appState?.trackersDetected || 0
  const trackersToday = detectorLogs
    .filter(log => log.detector === 'tracking' && log.timestamp >= startOfToday)
    .reduce((sum, log) => sum + (log.details?.trackerCount || 0), 0)
  const trackersYesterday = detectorLogs
    .filter(log => log.detector === 'tracking' && log.timestamp >= startOfYesterday && log.timestamp < startOfToday)
    .reduce((sum, log) => sum + (log.details?.trackerCount || 0), 0)
  const trackersPercent = trackersYesterday === 0 ? (trackersToday > 0 ? 100 : 0) : Math.round(((trackersToday - trackersYesterday) / trackersYesterday) * 100)

  // 2. Sites Analyzed
  const totalSites = appState?.sitesAnalyzed || 0
  const sitesToday = new Set(
    detectorLogs
      .filter(log => log.timestamp >= startOfToday)
      .map(log => log.domain)
  ).size
  const sitesYesterday = new Set(
    detectorLogs
      .filter(log => log.timestamp >= startOfYesterday && log.timestamp < startOfToday)
      .map(log => log.domain)
  ).size
  const sitesPercent = sitesYesterday === 0 ? (sitesToday > 0 ? 100 : 0) : Math.round(((sitesToday - sitesYesterday) / sitesYesterday) * 100)

  // 3. PII Risk Events
  const totalPii = appState?.piiEventsCount || 0
  const piiToday = piiLogs.filter(log => log.timestamp >= startOfToday).length
  const piiYesterday = piiLogs.filter(log => log.timestamp >= startOfYesterday && log.timestamp < startOfToday).length
  const piiPercent = piiYesterday === 0 ? (piiToday > 0 ? 100 : 0) : Math.round(((piiToday - piiYesterday) / piiYesterday) * 100)

  // 4. Safe Browsing Streak
  const streak = appState?.safeVisitStreak || 0
  const streakPercent = sitesToday > 0 ? Math.round((sitesToday / Math.max(totalSites, 1)) * 100) : 0

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

  // 5. Network Requests — aggregate third-party + tracker requests from enriched data
  const netToday = cacheSitesToday.reduce((acc, s) => {
    const summary = s.enrichedDetails?.networkRequests?.summary
    if (!summary) return acc
    return {
      total: acc.total + summary.total,
      thirdParty: acc.thirdParty + summary.thirdParty,
      trackerRequests: acc.trackerRequests + summary.trackerRequests,
      blocked: acc.blocked + summary.blocked,
    }
  }, { total: 0, thirdParty: 0, trackerRequests: 0, blocked: 0 })

  const netYesterday = cacheSitesYesterday.reduce((acc, s) => {
    const summary = s.enrichedDetails?.networkRequests?.summary
    if (!summary) return acc
    return {
      total: acc.total + summary.total,
      thirdParty: acc.thirdParty + summary.thirdParty,
      trackerRequests: acc.trackerRequests + summary.trackerRequests,
      blocked: acc.blocked + summary.blocked,
    }
  }, { total: 0, thirdParty: 0, trackerRequests: 0, blocked: 0 })

  const totalNetRequests = Object.values(siteCache as Record<string, SiteRiskData>).reduce(
    (sum, s) => sum + (s.enrichedDetails?.networkRequests?.summary.thirdParty ?? 0), 0
  )
  const netPercent = netYesterday.thirdParty === 0
    ? (netToday.thirdParty > 0 ? 100 : 0)
    : Math.round(((netToday.thirdParty - netYesterday.thirdParty) / netYesterday.thirdParty) * 100)

  // 6. Fingerprinting — aggregate attempts from enriched data
  const fpToday = cacheSitesToday.reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )
  const fpYesterday = cacheSitesYesterday.reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )
  const totalFp = Object.values(siteCache as Record<string, SiteRiskData>).reduce(
    (sum, s) => sum + (s.enrichedDetails?.fingerprinting?.summary.totalAttempts ?? 0), 0
  )
  const fpPercent = fpYesterday === 0
    ? (fpToday > 0 ? 100 : 0)
    : Math.round(((fpToday - fpYesterday) / fpYesterday) * 100)

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-3 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("Trackers Blocked")}
          </CardTitle>
          <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
            {trackersPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {trackersPercent >= 0 ? `+${trackersPercent}%` : `${trackersPercent}%`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {totalTrackers.toLocaleString()}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="text-xs font-medium flex items-center gap-1">
              {t("Activity")} {trackersPercent >= 0 ? t('up') : t('down')} {t("today")} {trackersPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Tracking scripts intercepted")}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("Sites Analyzed")}
          </CardTitle>
          <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
            {sitesPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {sitesPercent >= 0 ? `+${sitesPercent}%` : `${sitesPercent}%`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {totalSites.toLocaleString()}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="text-xs font-medium flex items-center gap-1">
              {t("Traffic")} {sitesPercent >= 0 ? t('up') : t('down')} {t("today")} {sitesPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Unique domains scanned")}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("PII Risk Events")}
          </CardTitle>
          <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
            {piiPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {piiPercent >= 0 ? `+${piiPercent}%` : `${piiPercent}%`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {totalPii.toLocaleString()}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="text-xs font-medium flex items-center gap-1">
              {t("Risk")} {piiPercent > 0 ? t('up') : (piiPercent < 0 ? t('down') : t('stable'))} {t("today")} {piiPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Sensitive info entries")}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("Safe Browsing Streak")}
          </CardTitle>
          <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
            {streakPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {streakPercent >= 0 ? `+${streakPercent}%` : `${streakPercent}%`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {streak.toLocaleString()}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="text-xs font-medium flex items-center gap-1">
              {t("Performance")} {streakPercent >= 0 ? t('steady') : t('dropping')} {streakPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Consecutive safe visits")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Requests card — tracker-flagged requests aggregated from enriched data */}
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("Cross-site Network Requests")}
          </CardTitle>
          <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
            {netPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {netPercent >= 0 ? `+${netPercent}%` : `${netPercent}%`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {totalNetRequests.toLocaleString()}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="text-xs font-medium flex items-center gap-1">
              {netToday.thirdParty > 0
                ? `${netToday.thirdParty} ${t("third-party")} · ${netToday.blocked} ${t("blocked")} ${t("today")}`
                : t("No data yet today")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Cross-site network calls detected")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fingerprinting card — fingerprinting attempts aggregated from enriched data */}
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("Fingerprinting Attempts")}
          </CardTitle>
          <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
            {fpPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {fpPercent >= 0 ? `+${fpPercent}%` : `${fpPercent}%`}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {totalFp.toLocaleString()}
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="text-xs font-medium flex items-center gap-1">
              {fpToday > 0
                ? `${fpToday} ${t("attempts")} ${t("today")} ${fpPercent >= 0 ? '' : '↓'}`
                : t("None detected today")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Canvas, WebGL, audio & more")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
