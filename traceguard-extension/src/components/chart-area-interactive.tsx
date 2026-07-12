import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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
const chartData = [
  { date: "2024-06-01", score: 85 },
  { date: "2024-06-02", score: 82 },
  { date: "2024-06-03", score: 88 },
  { date: "2024-06-04", score: 90 },
  { date: "2024-06-05", score: 75 },
  { date: "2024-06-06", score: 70 },
  { date: "2024-06-07", score: 78 },
  { date: "2024-06-08", score: 85 },
  { date: "2024-06-09", score: 88 },
  { date: "2024-06-10", score: 92 },
  { date: "2024-06-11", score: 95 },
  { date: "2024-06-12", score: 91 },
  { date: "2024-06-13", score: 86 },
  { date: "2024-06-14", score: 80 },
  { date: "2024-06-15", score: 72 },
  { date: "2024-06-16", score: 68 },
  { date: "2024-06-17", score: 75 },
  { date: "2024-06-18", score: 82 },
  { date: "2024-06-19", score: 88 },
  { date: "2024-06-20", score: 94 },
  { date: "2024-06-21", score: 96 },
  { date: "2024-06-22", score: 92 },
  { date: "2024-06-23", score: 85 },
  { date: "2024-06-24", score: 79 },
  { date: "2024-06-25", score: 74 },
  { date: "2024-06-26", score: 80 },
  { date: "2024-06-27", score: 86 },
  { date: "2024-06-28", score: 91 },
  { date: "2024-06-29", score: 95 },
  { date: "2024-06-30", score: 98 },
]

const chartConfig = {
  visitors: {
    label: "Score",
  },
  score: {
    label: "Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 30
    if (timeRange === "1d") {
      daysToSubtract = 0
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    } else if (timeRange === "30d") {
      daysToSubtract = 30
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

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
            onValueChange={setTimeRange}
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
            <SelectContent className="rounded-xl">
              <SelectItem value="1d" className="rounded-lg">
                Today
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-score)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-score)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
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
              type="natural"
              fill="url(#fillScore)"
              stroke="var(--color-score)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
