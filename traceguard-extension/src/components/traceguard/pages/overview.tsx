import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable, SiteVisit } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { RadialChartScore } from "@/components/radial-chart-score"
import { useDetectorLogs, useSiteCache } from "@/lib/useStorage"
import { DetectorType } from "@/lib/types"

export default function OverviewPage() {
  const { t } = useTranslation()
  const detectorLogs = useDetectorLogs()
  const { siteCache } = useSiteCache()
  const [timeRange, setTimeRange] = React.useState("30d")

  const groupedVisits = useMemo(() => {
    const groups = new Map<string, { domain: string; timestamp: number; wss: number; detectors: Record<string, { score: number, details: any }> }>()

    const sortedLogs = [...detectorLogs].sort((a, b) => b.timestamp - a.timestamp)

    for (const log of sortedLogs) {
      const timeWindow = Math.floor(log.timestamp / 5000) * 5000
      const key = `${log.domain}-${timeWindow}`

      if (!groups.has(key)) {
        groups.set(key, {
          domain: log.domain,
          timestamp: log.timestamp,
          wss: 0,
          detectors: {}
        })
      }

      const group = groups.get(key)!
      group.detectors[log.detector] = { score: log.score, details: log.details || {} }
    }

    const weights: Record<string, number> = {
      reputation: 0.30,
      tracking: 0.30,
      cookies: 0.20,
      inputs: 0.15,
      policy: 0.05,
      permissions: 0
    }

    const getSafetyLevel = (wss: number): string => {
      if (wss >= 80) return t("Excellent")
      if (wss >= 60) return t("Good")
      if (wss >= 40) return t("Fair")
      if (wss >= 20) return t("Poor")
      return t("Critical")
    }

    const visits: SiteVisit[] = []

    for (const group of groups.values()) {
      let totalScore = 0
      let totalWeight = 0

      for (const [detector, data] of Object.entries(group.detectors)) {
        const weight = weights[detector as DetectorType] || 0
        totalScore += data.score * weight
        totalWeight += weight
      }

      const wss = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
      const safetyLevel = getSafetyLevel(wss)
      
      const cachedDetails = siteCache[group.domain]?.detectionDetails || {};

      const trackingDetails = Object.keys(group.detectors.tracking?.details || {}).length > 0 
        ? group.detectors.tracking?.details 
        : cachedDetails.tracking;

      const cookiesDetails = Object.keys(group.detectors.cookies?.details || {}).length > 0 
        ? group.detectors.cookies?.details 
        : cachedDetails.cookies;
      
      const inputsDetails = Object.keys(group.detectors.inputs?.details || {}).length > 0 
        ? group.detectors.inputs?.details 
        : cachedDetails.input;

      const policyDetails = Object.keys(group.detectors.policy?.details || {}).length > 0 
        ? group.detectors.policy?.details 
        : cachedDetails.policy;

      const reputationDetails = Object.keys(group.detectors.reputation?.details || {}).length > 0 && group.detectors.reputation?.details?.status
        ? group.detectors.reputation?.details 
        : { status: group.detectors.reputation?.score === 100 ? t('Clean') : group.detectors.reputation?.score === 0 ? t('Blacklisted') : t('Suspicious') };

      const enriched = siteCache[group.domain]?.enrichedDetails

      const trackersCount = enriched?.trackers?.summary?.total ?? trackingDetails?.trackerCount ?? trackingDetails?.count ?? 0
      const cookiesCount = enriched?.cookies?.summary?.total ?? cookiesDetails?.tracking ?? 0
      const sensitiveInputsCount = inputsDetails?.sensitive ?? 0
      const reputationStatus = reputationDetails?.status ?? t("Unknown")
      const policyGrade = policyDetails?.grade ?? t("N/A")

      const finalDetails = {
         tracking: { details: trackingDetails },
         cookies: { details: cookiesDetails },
         inputs: { details: inputsDetails },
         policy: { details: policyDetails },
         reputation: { details: reputationDetails }
      }

      const headersGrade = enriched?.headers?.summary?.grade ?? undefined
      const fingerprintingAttempts = enriched?.fingerprinting?.summary?.totalAttempts ?? undefined

      visits.push({
        id: `${group.domain}-${group.timestamp}`,
        domain: group.domain,
        timestamp: group.timestamp,
        wss,
        safetyLevel,
        trackers: trackersCount,
        cookies: cookiesCount,
        inputs: sensitiveInputsCount > 0 ? t("Yes") : t("No"),
        reputation: reputationStatus,
        policy: policyGrade,
        headersGrade,
        fingerprintingAttempts,
        details: finalDetails
      })
    }

    return visits
  }, [detectorLogs, siteCache, t])

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 lg:px-6 lg:gap-6">
        <div className="lg:col-span-1">
          <RadialChartScore timeRange={timeRange} />
        </div>
        <div className="lg:col-span-2">
          <ChartAreaInteractive timeRange={timeRange} onTimeRangeChange={setTimeRange} />
        </div>
      </div>
      <SectionCards />
      <DataTable data={groupedVisits} siteCache={siteCache} />
    </>
  )
}
