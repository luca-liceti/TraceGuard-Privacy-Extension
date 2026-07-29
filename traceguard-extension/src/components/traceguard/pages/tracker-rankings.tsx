"use client"

import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert, Cookie, Shield, EyeOff, AlertTriangle } from "lucide-react"
import { type SiteVisit } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface DomainStat {
  domain: string
  total: number
}

export default function TrackerRankingsPage() {
  const { t } = useTranslation()
  const [topTrackers, setTopTrackers] = useState<DomainStat[]>([])
  const [topCookies, setTopCookies] = useState<DomainStat[]>([])
  const [topFingerprinters, setTopFingerprinters] = useState<DomainStat[]>([])
  const [lowestScores, setLowestScores] = useState<SiteVisit[]>([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await chrome.storage.local.get(['detectorLogs'])
        const logs: SiteVisit[] = data.detectorLogs || []

        // Aggregate by domain
        const domainStats: Record<string, { trackers: number, cookies: number, fingerprinting: number }> = {}
        const latestVisits: Record<string, SiteVisit> = {}

        logs.forEach(log => {
          if (!domainStats[log.domain]) {
            domainStats[log.domain] = { trackers: 0, cookies: 0, fingerprinting: 0 }
          }
          domainStats[log.domain].trackers += log.trackers || 0
          domainStats[log.domain].cookies += log.cookies || 0
          domainStats[log.domain].fingerprinting += log.fingerprintingAttempts || 0

          // Keep latest visit for WSS score
          if (!latestVisits[log.domain] || latestVisits[log.domain].timestamp < log.timestamp) {
            latestVisits[log.domain] = log
          }
        })

        // Sort for top lists (top 5)
        const sortedTrackers = Object.entries(domainStats)
          .map(([domain, stats]) => ({ domain, total: stats.trackers }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)

        const sortedCookies = Object.entries(domainStats)
          .map(([domain, stats]) => ({ domain, total: stats.cookies }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)

        const sortedFingerprinters = Object.entries(domainStats)
          .map(([domain, stats]) => ({ domain, total: stats.fingerprinting }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)

        const sortedLowestScores = Object.values(latestVisits)
          .sort((a, b) => a.wss - b.wss)
          .slice(0, 5)

        setTopTrackers(sortedTrackers)
        setTopCookies(sortedCookies)
        setTopFingerprinters(sortedFingerprinters)
        setLowestScores(sortedLowestScores)
      } catch (e) {
        console.error("Failed to load rankings", e)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("Rankings & Stats")}</h1>
        <p className="text-muted-foreground mt-2">{t("Insights and patterns from your browsing history")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <EyeOff className="h-4 w-4 text-warning" />
              {t("Most Trackers")}
            </CardTitle>
            <CardDescription>{t("Sites with the highest number of blocked trackers")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topTrackers.map((stat, i) => (
                <div key={stat.domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-muted-foreground w-4">{i + 1}.</div>
                    <span className="font-medium">{stat.domain}</span>
                  </div>
                  <Badge variant="secondary" className="bg-warning/10 text-warning">{stat.total}</Badge>
                </div>
              ))}
              {topTrackers.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t("No data available")}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cookie className="h-4 w-4 text-primary" />
              {t("Most Cookies")}
            </CardTitle>
            <CardDescription>{t("Sites that placed the most cookies")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCookies.map((stat, i) => (
                <div key={stat.domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-muted-foreground w-4">{i + 1}.</div>
                    <span className="font-medium">{stat.domain}</span>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">{stat.total}</Badge>
                </div>
              ))}
              {topCookies.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t("No data available")}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("Fingerprinting Attempts")}
            </CardTitle>
            <CardDescription>{t("Sites with detected browser fingerprinting")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topFingerprinters.map((stat, i) => (
                <div key={stat.domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-muted-foreground w-4">{i + 1}.</div>
                    <span className="font-medium">{stat.domain}</span>
                  </div>
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">{stat.total}</Badge>
                </div>
              ))}
              {topFingerprinters.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t("No data available")}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              {t("Lowest Safety Scores")}
            </CardTitle>
            <CardDescription>{t("Sites with the lowest TraceGuard Website Safety Score (WSS)")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowestScores.map((site, i) => (
                <div key={site.domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-muted-foreground w-4">{i + 1}.</div>
                    <span className="font-medium">{site.domain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={site.wss} className="w-16 h-2" />
                    <span className="text-sm font-bold w-6 text-right">{site.wss}</span>
                  </div>
                </div>
              ))}
              {lowestScores.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t("No data available")}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
