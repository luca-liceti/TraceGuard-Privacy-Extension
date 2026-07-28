import { TrendingUpIcon, TrendingDownIcon, ShieldIcon, ActivityIcon, GlobeIcon, NetworkIcon, FingerprintIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
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
    .reduce((sum, log) => sum + (log.details?.count || 0), 0)
  const trackersYesterday = detectorLogs
    .filter(log => log.detector === 'tracking' && log.timestamp >= startOfYesterday && log.timestamp < startOfToday)
    .reduce((sum, log) => sum + (log.details?.count || 0), 0)
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
        <CardHeader className="relative">
          <CardDescription>{t("Trackers Blocked")}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {totalTrackers.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {trackersPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              {trackersPercent >= 0 ? `+${trackersPercent}%` : `${trackersPercent}%`}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("Activity")} {trackersPercent >= 0 ? t('up') : t('down')} {t("today")} {trackersPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            {t("Tracking scripts intercepted")}
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{t("Sites Analyzed")}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {totalSites.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {sitesPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              {sitesPercent >= 0 ? `+${sitesPercent}%` : `${sitesPercent}%`}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("Traffic")} {sitesPercent >= 0 ? t('up') : t('down')} {t("today")} {sitesPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            {t("Unique domains scanned")}
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{t("PII Risk Events")}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {totalPii.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {piiPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              {piiPercent >= 0 ? `+${piiPercent}%` : `${piiPercent}%`}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("Risk")} {piiPercent > 0 ? t('up') : (piiPercent < 0 ? t('down') : t('stable'))} {t("today")} {piiPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">{t("Sensitive info entries")}</div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{t("Safe Browsing Streak")}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {streak.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {streakPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              {streakPercent >= 0 ? `+${streakPercent}%` : `${streakPercent}%`}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {t("Performance")} {streakPercent >= 0 ? t('steady') : t('dropping')} {streakPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">{t("Consecutive safe visits")}</div>
        </CardFooter>
      </Card>

      {/* Network Requests card — tracker-flagged requests aggregated from enriched data */}
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{t("Cross-site Network Requests")}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {totalNetRequests.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {netPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              {netPercent >= 0 ? `+${netPercent}%` : `${netPercent}%`}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {netToday.thirdParty > 0
              ? `${netToday.thirdParty} ${t("third-party")} · ${netToday.blocked} ${t("blocked")} ${t("today")}`
              : t("No data yet today")}
          </div>
          <div className="text-muted-foreground">{t("Cross-site network calls detected")}</div>
        </CardFooter>
      </Card>

      {/* Fingerprinting card — fingerprinting attempts aggregated from enriched data */}
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{t("Fingerprinting Attempts")}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {totalFp.toLocaleString()}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {fpPercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
              {fpPercent >= 0 ? `+${fpPercent}%` : `${fpPercent}%`}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {fpToday > 0
              ? `${fpToday} ${t("attempts")} ${t("today")} ${fpPercent >= 0 ? '' : '↓'}`
              : t("None detected today")}
          </div>
          <div className="text-muted-foreground">{t("Canvas, WebGL, audio & more")}</div>
        </CardFooter>
      </Card>
    </div>
  )
}
