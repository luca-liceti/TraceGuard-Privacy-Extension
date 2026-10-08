"use client"

import type { TFunction } from "i18next"
import { ColumnDef } from "@tanstack/react-table"
import { MoreVerticalIcon } from "lucide-react"
import { format } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getGradeTextColor, getSafetyBgColor, getSafetyTextColor } from "@/lib/theme-utils"
import { getSafetyLabel } from "@/lib/risk-utils"
// Type-only import, so this does not create a runtime cycle with data-table.tsx.
import type { SiteVisit } from "./data-table"

/**
 * Extra callbacks the DataTable passes through `table.options.meta`. Typed here
 * so the row actions do not have to reach into `meta` as `any`.
 */
export interface DataTableMeta {
  onViewDetails?: (visit: SiteVisit) => void
  onExportLog?: (visit: SiteVisit) => void
  onDeleteLog?: (visit: SiteVisit) => void
}

// ── Column definitions (shared for both parent and child rows) ───────────────
export const getColumns = (t: TFunction): ColumnDef<SiteVisit>[] => [
  {
    accessorKey: "domain",
    header: t("Domain"),
    cell: ({ row }) => <div className="font-medium">{row.getValue("domain")}</div>,
  },
  {
    accessorKey: "timestamp",
    header: t("Visit Time"),
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground">
          {format(new Date(row.getValue("timestamp")), "MMM d, yyyy HH:mm:ss")}
        </div>
      )
    },
  },
  {
    accessorKey: "safetyLevel",
    header: t("Safety Level"),
    cell: ({ row }) => {
      const level = row.getValue("safetyLevel") as string
      return (
        <Badge variant="secondary" className={`px-2.5 py-0.5 ${getSafetyBgColor(level)} ${getSafetyTextColor(level)}`}>
          {t(getSafetyLabel(level))}
        </Badge>
      )
    },
  },
  {
    accessorKey: "trackers",
    header: t("Trackers"),
    cell: ({ row }) => <div>{row.getValue("trackers")}</div>,
  },
  {
    accessorKey: "cookies",
    header: t("Cookies"),
    cell: ({ row }) => <div>{row.getValue("cookies")}</div>,
  },
  {
    accessorKey: "inputs",
    header: t("PII Risk"),
    cell: ({ row }) => <div>{t(row.getValue("inputs") as string)}</div>,
  },
  {
    accessorKey: "reputation",
    header: t("Reputation"),
    cell: ({ row }) => <div>{t(row.getValue("reputation") as string)}</div>,
  },
  {
    accessorKey: "policy",
    header: t("Policy"),
    cell: ({ row }) => {
      const grade = row.getValue("policy") as string
      return <div className={`font-semibold ${getGradeTextColor(grade)}`}>{t(grade)}</div>
    },
  },
  {
    accessorKey: "headersGrade",
    header: t("Headers"),
    cell: ({ row }) => {
      const grade = row.getValue("headersGrade") as string | undefined
      if (!grade) return <div className="text-muted-foreground text-xs">—</div>
      return <div className={`font-semibold ${getGradeTextColor(grade)}`}>{grade}</div>
    },
  },
  {
    accessorKey: "fingerprintingAttempts",
    header: t("Fingerprinting"),
    cell: ({ row }) => {
      const count = row.getValue("fingerprintingAttempts") as number | undefined
      if (count === undefined || count === null) return <div className="text-muted-foreground text-xs">—</div>
      if (count === 0) return <div>0</div>
      return (
        <Badge variant="secondary" className="text-xs bg-warning/20 text-warning border-transparent">
          {count}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: t("Actions"),
    cell: ({ row, table }) => {
      const meta = table.options.meta as DataTableMeta | undefined
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
              size="icon"
            >
              <MoreVerticalIcon className="size-4" />
              <span className="sr-only">{t("Open menu")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => meta?.onViewDetails?.(row.original)}>
              {t("View details")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onExportLog?.(row.original)}>
              {t("Export")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => meta?.onDeleteLog?.(row.original)}
            >
              {t("Delete log")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
