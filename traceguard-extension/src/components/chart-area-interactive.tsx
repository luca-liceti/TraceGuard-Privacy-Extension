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

const chartConfig = {
  visitors: {
    label: "Score",
  },
  score: {
    label: "Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({
  timeRange: externalTimeRange,
  onTimeRangeChange,
}: {
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
} = {}) {
  const isMobile = useIsMobile()
  const [internalTimeRange, setInternalTimeRange] = React.useState("30d")
  
  const timeRange = externalTimeRange !== undefined ? externalTimeRange : internalTimeRange
  const setTimeRange = onTimeRangeChange || setInternalTimeRange

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const history = useScoreHistory()

  const { dailyData, todayData } = React.useMemo(() => {
    const isLoading = history === null;
    const actualHistory = history || [];
    if (!isLoading && actualHistory.length === 0) return { dailyData: [], todayData: [] };
    
    // Group by day
    const dailyScores = new Map<string, { sum: number; count: number }>();
    actualHistory.forEach(entry => {
      const date = new Date(entry.timestamp);
      // Adjust for local time
      const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const existing = dailyScores.get(dateString) || { sum: 0, count: 0 };
      dailyScores.set(dateString, { sum: existing.sum + entry.ups, count: existing.count + 1 });
    });
    
    const dailyData = Array.from(dailyScores.entries()).map(([date, { sum, count }]) => ({
      date,
      score: Math.round(sum / count)
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Today data (Raw history from midnight to now)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const beforeToday = actualHistory.filter(entry => entry.timestamp < startOfToday.getTime());
    const lastScore = isLoading ? 0 : (beforeToday.length > 0 ? beforeToday[beforeToday.length - 1].ups : 100); 
    
    const rawToday = actualHistory
      .filter(entry => entry.timestamp >= startOfToday.getTime())
      .map(entry => ({
        date: new Date(entry.timestamp).toISOString(),
        score: entry.ups
      }));
      
    // Create a continuous line from midnight to current time
    const todayData = [
      { date: startOfToday.toISOString(), score: lastScore },
      ...rawToday,
      { date: new Date().toISOString(), score: rawToday.length > 0 ? rawToday[rawToday.length - 1].score : lastScore }
    ];

    return { dailyData, todayData };
  }, [history]);

  const filteredData = React.useMemo(() => {
    if (timeRange === "1d") return todayData;

    const daysToSubtract = timeRange === "7d" ? 7 : 30;
    const result = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = daysToSubtract - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // Format as YYYY-MM-DD in local time
      const dateString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const existing = dailyData.find(item => item.date === dateString);
      
      if (existing) {
        result.push(existing);
      } else {
        // Backfill with the most recent score prior to this date
        const before = dailyData.filter(item => item.date < dateString);
        const isLoading = history === null;
        const lastScore = isLoading ? 0 : (before.length > 0 ? before[before.length - 1].score : 100);
        
        result.push({
          date: dateString,
          score: lastScore
        });
      }
    }
    
    return result;
  }, [dailyData, todayData, timeRange, history]);

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>User Privacy Score</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Average score for {timeRange === '1d' ? 'today' : timeRange === '7d' ? 'the last 7 days' : 'the last 30 days'}
          </span>
          <span className="@[540px]/card:hidden">
            {timeRange === '1d' ? 'Today' : timeRange === '7d' ? 'Last 7 days' : 'Last 30 days'}
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
              Today
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              Last 7 days
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              Last 30 days
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-40"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 30 days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">
                Today
              </SelectItem>
              <SelectItem value="7d">
                Last 7 days
              </SelectItem>
              <SelectItem value="30d">
                Last 30 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
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
      </CardContent>
    </Card>
  )
}
