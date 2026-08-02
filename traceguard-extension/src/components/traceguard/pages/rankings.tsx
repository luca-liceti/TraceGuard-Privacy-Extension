import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart"
import { useDetectorLogs, useActivityLogs, useSiteCache } from "@/lib/useStorage"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Configuration for Tracker Categories Pie Chart (Monotone)
const pieChartConfig = {
  tracking: { label: "Tracking", color: "var(--primary)" },
  cookies: { label: "Cookies", color: "var(--muted-foreground)" },
  inputs: { label: "Inputs", color: "var(--secondary)" },
  reputation: { label: "Reputation", color: "var(--accent)" },
  policy: { label: "Policy", color: "var(--border)" },
  permissions: { label: "Permissions", color: "var(--foreground)" }
} satisfies ChartConfig

// Configuration for Activity Chart
const activityConfig = {
  events: { label: "Events Blocked", color: "var(--primary)" }
} satisfies ChartConfig

// Configuration for Leaderboard
const leaderboardConfig = {
  count: { label: "Trackers Blocked", color: "var(--primary)" }
} satisfies ChartConfig

// Configuration for PII Chart
const piiConfig = {
  count: { label: "Interceptions", color: "var(--primary)" }
} satisfies ChartConfig

// Configuration for WSS Chart
const wssConfig = {
  count: { label: "Sites", color: "var(--primary)" }
} satisfies ChartConfig

export default function RankingsPage() {
  const { t } = useTranslation()
  const logs = useDetectorLogs()
  const piiLogs = useActivityLogs()
  const { sites } = useSiteCache()
  
  const [timeRange, setTimeRange] = useState("1d")

  // 1. Prepare data for Tracker Categories (Pie Chart)
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {
      tracking: 0, cookies: 0, inputs: 0, reputation: 0, policy: 0, permissions: 0
    }
    logs.forEach(log => {
      if (counts[log.detector] !== undefined) {
        counts[log.detector]++
      }
    })
    
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name,
        value,
        fill: `var(--color-${name})`
      }))
  }, [logs])

  // 2. Prepare data for Top Offenders (Bar Chart horizontal)
  const leaderboardData = useMemo(() => {
    const domainCounts: Record<string, number> = {}
    logs.forEach(log => {
      if (log.detector === 'tracking' || log.detector === 'cookies') {
        domainCounts[log.domain] = (domainCounts[log.domain] || 0) + 1
      }
    })
    
    return Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5
      .map(([domain, count]) => ({ 
        domain, 
        count,
        fill: `var(--primary)` 
      }))
  }, [logs])

  // 3. Prepare data for Threat Vector (Radar Chart - Threat Level)
  const radarData = useMemo(() => {
    const totals: Record<string, { sum: number, count: number }> = {
      tracking: { sum: 0, count: 0 },
      cookies: { sum: 0, count: 0 },
      inputs: { sum: 0, count: 0 },
      reputation: { sum: 0, count: 0 },
      policy: { sum: 0, count: 0 }
    }
    
    logs.forEach(log => {
      if (totals[log.detector]) {
        totals[log.detector].sum += log.score
        totals[log.detector].count++
      }
    })

    return Object.entries(totals).map(([detector, data]) => {
      const averageSafety = data.count > 0 ? Math.round(data.sum / data.count) : 100
      const threatLevel = 100 - averageSafety // 0 is safe, 100 is max threat
      
      return {
        subject: detector.charAt(0).toUpperCase() + detector.slice(1),
        threat: threatLevel, 
        fullMark: 100
      }
    })
  }, [logs])

  // 4. Prepare Activity Data (Bar Chart dynamic time range)
  const activityData = useMemo(() => {
    const days: Record<string, number> = {}
    
    const daysToSubtract = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = daysToSubtract - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      days[dateStr] = 0
    }

    logs.forEach(log => {
      const d = new Date(log.timestamp)
      // Only include if within time range
      if (d.getTime() >= (today.getTime() - ((daysToSubtract - 1) * 24 * 60 * 60 * 1000))) {
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        if (days[dateStr] !== undefined) {
          days[dateStr]++
        }
      }
    })

    if (timeRange === '1d') {
      const formatHour = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`
      const hours: Record<string, number> = {}
      for (let i = 0; i < 24; i++) {
        hours[formatHour(i)] = 0
      }
      
      logs.forEach(log => {
        const d = new Date(log.timestamp)
        if (d.getTime() >= today.getTime()) {
          const hourStr = formatHour(d.getHours())
          if (hours[hourStr] !== undefined) {
            hours[hourStr]++
          }
        }
      })
      
      return Object.entries(hours).map(([time, events]) => ({
        date: time,
        events
      }))
    }

    return Object.entries(days).map(([date, events]) => ({
      date,
      events
    }))
  }, [logs, timeRange])

  // 5. Prepare PII Data (Horizontal Bar Chart)
  const piiData = useMemo(() => {
    const counts: Record<string, number> = {}
    piiLogs.forEach(log => {
      const label = log.fieldType.charAt(0).toUpperCase() + log.fieldType.slice(1)
      counts[label] = (counts[label] || 0) + 1
    })
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Sort descending
      .map(([type, count]) => ({ type, count }))
  }, [piiLogs])

  // 6. Prepare Web Safety Score Data (Vertical Histogram)
  const wssData = useMemo(() => {
    const bins = {
      Critical: 0,
      Poor: 0,
      Fair: 0,
      Good: 0,
      Excellent: 0
    }
    
    sites.forEach(([_, data]) => {
      const score = data.wss
      if (score < 20) bins.Critical++
      else if (score < 40) bins.Poor++
      else if (score < 60) bins.Fair++
      else if (score < 80) bins.Good++
      else bins.Excellent++
    })
    
    return [
      { category: "Critical", count: bins.Critical },
      { category: "Poor", count: bins.Poor },
      { category: "Fair", count: bins.Fair },
      { category: "Good", count: bins.Good },
      { category: "Excellent", count: bins.Excellent }
    ]
  }, [sites])

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 lg:px-6 lg:py-6 @container/main">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("Rankings & Stats")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("In-depth analytics and gamified rankings of your privacy data.")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6 mt-4">
        
        {/* 1. Daily Activity (Full Width) */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-2 @container/card">
          <CardHeader className="relative">
            <CardTitle>{t("Activity Volume")}</CardTitle>
            <CardDescription>
              <span className="@[540px]/card:block hidden">
                {t("Volume of privacy events blocked")} {timeRange === '1d' ? t('today') : timeRange === '7d' ? t('over the last 7 days') : t('over the last 30 days')}
              </span>
              <span className="@[540px]/card:hidden">
                {timeRange === '1d' ? t('Today') : timeRange === '7d' ? t('Last 7 days') : t('Last 30 days')}
              </span>
            </CardDescription>
            <div className="absolute right-4 top-4">
              <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={(val) => val && setTimeRange(val)}
                variant="outline"
                className="@[767px]/card:flex hidden"
              >
                <ToggleGroupItem value="1d" className="h-8 px-2.5">
                  {t("Today")}
                </ToggleGroupItem>
                <ToggleGroupItem value="7d" className="h-8 px-2.5">
                  {t("Last 7 days")}
                </ToggleGroupItem>
                <ToggleGroupItem value="30d" className="h-8 px-2.5">
                  {t("Last 30 days")}
                </ToggleGroupItem>
              </ToggleGroup>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger
                  className="@[767px]/card:hidden flex w-40"
                  aria-label="Select a time range"
                >
                  <SelectValue placeholder="Last 7 days" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1d" className="rounded-lg">
                    {t("Today")}
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    {t("Last 7 days")}
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    {t("Last 30 days")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={activityConfig} className="h-[250px] w-full">
              <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickMargin={8} />
                <ChartTooltip cursor={{fill: 'var(--muted)'}} content={<ChartTooltipContent />} />
                <Bar dataKey="events" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 2. Top Offenders Leaderboard (Full Width) */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("Top Offenders Leaderboard")}</CardTitle>
            <CardDescription>{t("Domains with the highest volume of blocked trackers and cookies")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={leaderboardConfig} className="h-[250px] w-full">
              <BarChart
                data={leaderboardData}
                layout="vertical"
                margin={{ top: 0, right: 0, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis dataKey="domain" type="category" tickLine={false} axisLine={false} width={150} tick={{ fill: "var(--foreground)", fontSize: 12 }} tickMargin={8} />
                <ChartTooltip cursor={{fill: 'var(--muted)'}} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 3. Threat Categories (Half Width) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Threat Categories")}</CardTitle>
            <CardDescription>{t("Distribution of threats by type")}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center pb-0">
            <ChartContainer config={pieChartConfig} className="h-[250px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  stroke="var(--background)"
                  strokeWidth={2}
                />
                <ChartLegend content={<ChartLegendContent />} className="-translate-y-2 flex-wrap gap-2" />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 4. Threat Vector Radar (Half Width) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Threat Vector Analysis")}</CardTitle>
            <CardDescription>{t("Severity of threats across different vectors (Higher is more risky)")}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center">
            <ChartContainer config={pieChartConfig} className="h-[250px] w-full">
              <RadarChart data={radarData} outerRadius={80}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--foreground)", fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Threat Level"
                  dataKey="threat"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.4}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 5. Sensitive Data Targeted (PII) (Half Width) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Sensitive Data Targeted")}</CardTitle>
            <CardDescription>{t("Types of personal info most frequently intercepted by sites")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={piiConfig} className="h-[250px] w-full">
              <BarChart
                data={piiData}
                layout="vertical"
                margin={{ top: 0, right: 0, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis dataKey="type" type="category" tickLine={false} axisLine={false} width={100} tick={{ fill: "var(--foreground)", fontSize: 12 }} tickMargin={8} />
                <ChartTooltip cursor={{fill: 'var(--muted)'}} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 6. Web Safety Score Distribution (Half Width) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Web Safety Score Distribution")}</CardTitle>
            <CardDescription>{t("Overall safety ratings of the sites you visit")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={wssConfig} className="h-[250px] w-full">
              <BarChart data={wssData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="category" tickLine={false} axisLine={false} tick={{ fill: "var(--foreground)", fontSize: 12 }} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickMargin={8} />
                <ChartTooltip cursor={{fill: 'var(--muted)'}} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
