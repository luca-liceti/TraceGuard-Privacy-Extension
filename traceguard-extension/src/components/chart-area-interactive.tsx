import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
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
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useScoreHistory } from "@/lib/useStorage"
import { buildDailySeries, buildRangeSeries, buildTodaySeries, ScoreHistoryLike } from "@/lib/score-history"
import { useTranslation } from "react-i18next"

const chartConfig = {
  visitors: {
    label: "Score",
  },
  score: {
    label: "Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig

import { Activity, AlertCircle } from "lucide-react"
import { ErrorBoundary } from "@/components/ErrorBoundary"

// Stable reference so chart memos don't recompute while history is loading.
const EMPTY_HISTORY: ScoreHistoryLike[] = []

// ... (in imports at top)

export function ChartAreaInteractive({
  timeRange: externalTimeRange,
  onTimeRangeChange,
}: {
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
} = {}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [internalTimeRange, setInternalTimeRange] = React.useState("1d")
  
  const timeRange = externalTimeRange !== undefined ? externalTimeRange : internalTimeRange
  const setTimeRange = onTimeRangeChange || setInternalTimeRange

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const history = useScoreHistory()
  // Stable reference so the memos below only recompute when history changes.
  const actualHistory = history ?? EMPTY_HISTORY

  // Today: the raw score trajectory from midnight to now.
  const todayData = React.useMemo(() => buildTodaySeries(actualHistory), [actualHistory])
  // Last 7 / 30 days: one point per day at that day's last (closing) score.
  const dailyData = React.useMemo(() => buildDailySeries(actualHistory), [actualHistory])

  const filteredData = React.useMemo(() => {
    if (timeRange === "1d") return todayData;
    const days = timeRange === "7d" ? 7 : 30;
    return buildRangeSeries(dailyData, days)
  }, [todayData, dailyData, timeRange])

  return (
    <ErrorBoundary fallback={
      <Card className="h-[300px] flex items-center justify-center text-muted-foreground">
        <AlertCircle className="mr-2 h-5 w-5" />
        {t("Failed to load chart")}
      </Card>
    }>
    <Card className="@container/card h-full">
      <CardHeader className="relative">
        <CardTitle>{t("User Privacy Score")}</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            {t('Score for')} {timeRange === '1d' ? t('today') : timeRange === '7d' ? t('the last 7 days') : t('the last 30 days')}
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
              aria-label="Select a value"
            >
              <SelectValue placeholder={t("Last 30 days")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">
                {t("Today")}
              </SelectItem>
              <SelectItem value="7d">
                {t("Last 7 days")}
              </SelectItem>
              <SelectItem value="30d">
                {t("Last 30 days")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {history === null ? (
          <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground pb-6">
            {t("Loading...")}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 w-full gap-3 text-center pb-6">
            <div className="p-3 rounded-full bg-muted/50">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("No data yet")}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{t("Your privacy score history will appear here over time.")}</p>
            </div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-64 w-full"
          >
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-score)"
                    stopOpacity={0.5}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-score)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  if (timeRange === '1d') {
                    return new Date(value).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit"
                    })
                  }
                  const [y, m, d] = value.split('T')[0].split('-');
                  const localDate = new Date(Number(y), Number(m) - 1, Number(d));
                  return localDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis 
                domain={[0, 100]} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} 
                tickMargin={8} 
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      if (timeRange === '1d') {
                        return new Date(value).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit"
                        })
                      }
                      const [y, m, d] = value.split('T')[0].split('-');
                      const localDate = new Date(Number(y), Number(m) - 1, Number(d));
                      return localDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="score"
                type="monotone"
                fill="url(#fillScore)"
                stroke="var(--color-score)"
                strokeWidth={2}
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
    </ErrorBoundary>
  )
}
