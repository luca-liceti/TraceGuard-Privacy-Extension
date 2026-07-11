import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { RadialChartScore } from "@/components/radial-chart-score"
import data from "@/app/dashboard/data.json"

export default function OverviewPage() {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 lg:px-6 lg:gap-6">
        <div className="lg:col-span-1">
          <RadialChartScore />
        </div>
        <div className="lg:col-span-2">
          <ChartAreaInteractive />
        </div>
      </div>
      <SectionCards />
      <DataTable data={data} />
    </>
  )
}
