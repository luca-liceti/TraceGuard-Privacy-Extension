import { TrendingUpIcon, TrendingDownIcon, ShieldIcon, ActivityIcon, GlobeIcon, FingerprintIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAppState, useDetectorLogs, useActivityLogs } from "@/lib/useStorage"

export function SectionCards() {
  const appState = useAppState()
  const detectorLogs = useDetectorLogs()
  const piiLogs = useActivityLogs()

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
  // Safe streak percentage could just be a flat 0% or positive if it increased
  const streakPercent = sitesToday > 0 ? Math.round((sitesToday / Math.max(totalSites, 1)) * 100) : 0

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Trackers Blocked</CardDescription>
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
            Activity {trackersPercent >= 0 ? 'up' : 'down'} today {trackersPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Tracking scripts intercepted
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Sites Analyzed</CardDescription>
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
            Traffic {sitesPercent >= 0 ? 'up' : 'down'} today {sitesPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Unique domains scanned
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>PII Risk Events</CardDescription>
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
            Risk {piiPercent > 0 ? 'up' : (piiPercent < 0 ? 'down' : 'stable')} today {piiPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">Sensitive info entries</div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Safe Browsing Streak</CardDescription>
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
            Performance {streakPercent >= 0 ? 'steady' : 'dropping'} {streakPercent >= 0 ? <TrendingUpIcon className="size-4" /> : <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">Consecutive safe visits</div>
        </CardFooter>
      </Card>
    </div>
  )
}
