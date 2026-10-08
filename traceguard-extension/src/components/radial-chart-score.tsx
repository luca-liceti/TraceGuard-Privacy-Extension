import * as React from "react"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useActivityLogs, useAppState, useScoreHistory } from "@/lib/useStorage"

/*
 * Ring geometry, in pixels. The band is 8px wide with its centre line 85px from
 * the middle, which is the ring the shadcn radial chart drew before this, so the
 * size of the chart does not change. The band's outer edge is therefore 89px from
 * the middle of a 250px box, which is why the ring sits at a 14.4% inset:
 * (125 - 89) / 250.
 *
 * The ring is painted rather than charted. A conic-gradient paints it around its
 * circumference, which is the fade Apple's Activity rings use, and an SVG chart
 * cannot express that: SVG has no circular gradient. The sweep angle is the
 * registered custom property --score-ring-sweep in globals.css, which is what
 * allows the ring to grow smoothly.
 */
const RING_THICKNESS_PX = 8
const RING_ANIMATION_MS = 1200

// Keep only the band of the box: transparent in the middle, opaque for the last
// RING_THICKNESS_PX of the radius. Everything that paints a ring uses it.
const ringMask = {
  WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - ${RING_THICKNESS_PX}px), #000 calc(100% - ${RING_THICKNESS_PX}px))`,
  maskImage: `radial-gradient(farthest-side, transparent calc(100% - ${RING_THICKNESS_PX}px), #000 calc(100% - ${RING_THICKNESS_PX}px))`,
} as React.CSSProperties

// A round end cap: a dot the width of the band, sitting on the band's centre line.
const endCapStyle: React.CSSProperties = {
  width: RING_THICKNESS_PX,
  height: RING_THICKNESS_PX,
}

export function RadialChartScore({ timeRange = "30d" }: { timeRange?: string }) {
  const { t } = useTranslation()
  const state = useAppState()
  const history = useScoreHistory()
  const piiEvents = useActivityLogs()
  const targetScore = !state ? 0 : (state.ups ?? 100)

  const [currentScore, setCurrentScore] = React.useState(0)

  React.useEffect(() => {
    const timer = setTimeout(() => setCurrentScore(targetScore), 100)
    return () => clearTimeout(timer)
  }, [targetScore])

  let days = 30;
  if (timeRange === "1d") days = 1;
  else if (timeRange === "7d") days = 7;

  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);
  if (days > 1) {
    targetDate.setDate(targetDate.getDate() - days);
  }

  // Anchor the change at the score the user had when the window STARTED (the
  // last recorded point before it), matching the area chart's series. Using
  // the first entry INSIDE the window would misattribute mid-window movement
  // to the window's start (e.g. a drop at 2pm would look like "no change").
  const beforeWindow = (history || []).filter(h => h.timestamp < targetDate.getTime())
  const anchorScore = beforeWindow.length > 0 ? beforeWindow[beforeWindow.length - 1].ups : 100

  const scoreChange = currentScore - anchorScore
  const isUp = scoreChange >= 0

  // The ring is full at 100, and only then does its end reach its start.
  const percent = Math.max(0, Math.min(1, currentScore / 100))
  const isFull = currentScore >= 100

  const timeText = timeRange === "1d" ? t("today") : timeRange === "7d" ? t("this week") : t("this month")

  // The score is not a mystery number: it moves when personal data is entered on
  // a risky site. Naming the most recent handover that cost points is the
  // attribution the reader needs, and it is recorded, so it does not have to be
  // inferred.
  const lastDrop = (piiEvents || [])
    .filter(event => event.scoreImpact < 0 && event.timestamp >= targetDate.getTime())
    .sort((a, b) => b.timestamp - a.timestamp)[0]

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>{t("Privacy Score")}</CardTitle>
        <CardDescription>{t("From the data you entered and how risky each site was")}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0 flex items-center justify-center">
        {history && history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full w-full gap-3 text-center pb-6">
            <div className="p-3 rounded-full bg-muted/50">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("No data yet")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("Your privacy score will appear here.")}</p>
            </div>
          </div>
        ) : (
          <div className="relative mx-auto aspect-square w-full max-w-[250px]">
            <div className="absolute inset-[14.4%]">
              {/* The part the score has not reached. */}
              <div
                className="absolute inset-0 rounded-full border-muted"
                style={{ borderWidth: RING_THICKNESS_PX }}
              />

              {/* The score itself: a conic-gradient cut off at the sweep angle, so
                  the fade runs around the ring rather than across it. */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  ...ringMask,
                  "--score-ring-sweep": `${percent * 360}deg`,
                  background:
                    "conic-gradient(from -90deg, var(--score-ring-start) 0deg, var(--score-ring-end) var(--score-ring-sweep), transparent var(--score-ring-sweep))",
                  transitionProperty: "--score-ring-sweep",
                  transitionDuration: `${RING_ANIMATION_MS}ms`,
                  transitionTimingFunction: "ease-out",
                } as React.CSSProperties}
              />

              {/* The gradient changes colour at 12 o'clock, where the ring starts
                  and stops, so each end gets a round cap over that seam. */}
              {percent > 0 && (
                <div
                  className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
                  style={{ ...endCapStyle, background: "var(--score-ring-start)" }}
                />
              )}
              {percent > 0 && (
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `rotate(${percent * 360}deg)`,
                    transition: `transform ${RING_ANIMATION_MS}ms ease-out`,
                  }}
                >
                  <div
                    className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
                    style={{
                      ...endCapStyle,
                      background: "var(--score-ring-end)",
                      // Once the ring is closed the end lands on the start, so it
                      // is given a gap and a shadow to read as the part on top.
                      boxShadow: isFull
                        ? "0 0 0 2px var(--card), 0 2px 6px var(--score-ring-cap-shadow)"
                        : undefined,
                    }}
                  />
                </div>
              )}
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-foreground">{Math.ceil(currentScore)}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>
        )}
      </CardContent>
      {(history && history.length > 0) && (
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center justify-center gap-2 font-medium leading-none text-center">
            {scoreChange === 0
              ? `${t("Score is stable")} ${timeText}`
              : `${t("Trending")} ${isUp ? t('up') : t('down')} ${t("by")} ${Math.ceil(Math.abs(scoreChange))} ${t("pts")} ${timeText}`}
            {isUp ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
          </div>
          <div className="leading-none text-muted-foreground text-center">
            {lastDrop
              ? t("Last drop: {{points}} pts from {{fieldType}} on {{site}}", {
                  points: Math.abs(lastDrop.scoreImpact),
                  fieldType: t(lastDrop.fieldType),
                  site: lastDrop.site,
                })
              : t("No drop from data you entered {{period}}", { period: timeText })}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
