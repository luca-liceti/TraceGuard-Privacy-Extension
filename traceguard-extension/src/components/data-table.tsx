"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  ChevronDownIcon,
  MoreVerticalIcon,
  PlusIcon,
  ShieldAlertIcon,
  AlertTriangleIcon,
  DownloadIcon,
} from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SiteDetailsPanel } from "@/components/traceguard/site-details-panel"
import { SiteRiskData } from "@/lib/types"

export const schema = z.object({
  id: z.string().optional(),
  domain: z.string(),
  timestamp: z.number(),
  wss: z.number(),
  safetyLevel: z.string(),
  trackers: z.number(),
  cookies: z.number(),
  inputs: z.string(),
  reputation: z.string(),
  policy: z.string(),
  headersGrade: z.string().optional(),
  fingerprintingAttempts: z.number().optional(),
  details: z.any().optional(),
})

export type SiteVisit = z.infer<typeof schema>

const getSafetyColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "excellent":
    case "good":
      return "text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400 border-transparent"
    case "fair":
      return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-400 border-transparent"
    case "poor":
    case "critical":
      return "text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400 border-transparent"
    default:
      return "text-muted-foreground border-transparent bg-muted/20"
  }
}

const getPolicyColor = (grade: string) => {
  switch (grade.toUpperCase()) {
    case "A":
      return "text-green-600 dark:text-green-400"
    case "B":
      return "text-blue-600 dark:text-blue-400"
    case "C":
      return "text-yellow-600 dark:text-yellow-400"
    case "D":
      return "text-orange-500 dark:text-orange-400"
    case "E":
      return "text-red-600 dark:text-red-400"
    default:
      return "text-muted-foreground"
  }
}

const getColumns = (t: any): ColumnDef<SiteVisit>[] => [
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
        <Badge variant="secondary" className={`px-2.5 py-0.5 ${getSafetyColor(level)}`}>
          {level}
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
    cell: ({ row }) => <div>{row.getValue("inputs")}</div>,
  },
  {
    accessorKey: "reputation",
    header: t("Reputation"),
    cell: ({ row }) => <div>{row.getValue("reputation")}</div>,
  },
  {
    accessorKey: "policy",
    header: t("Policy"),
    cell: ({ row }) => {
      const grade = row.getValue("policy") as string
      return <div className={`font-semibold ${getPolicyColor(grade)}`}>{grade}</div>
    },
  },
  {
    accessorKey: "headersGrade",
    header: t("Headers"),
    cell: ({ row }) => {
      const grade = row.getValue("headersGrade") as string | undefined
      if (!grade) return <div className="text-muted-foreground text-xs">—</div>
      return <div className={`font-semibold ${getPolicyColor(grade)}`}>{grade}</div>
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
        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400 border-transparent">
          {count}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
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
            <DropdownMenuItem onClick={() => (table.options.meta as any)?.onViewDetails(row.original)}>
              {t("View details")}
            </DropdownMenuItem>
            <DropdownMenuItem>{t("Export")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              {t("Delete log")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function DataTable({ data, siteCache = {} }: { data: SiteVisit[]; siteCache?: Record<string, SiteRiskData> }) {
  const { t } = useTranslation()
  const columns = React.useMemo(() => getColumns(t), [t])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "timestamp", desc: true }])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  
  const [isAddLogOpen, setIsAddLogOpen] = React.useState(false)
  const [selectedVisit, setSelectedVisit] = React.useState<SiteVisit | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false)

  const handleViewDetails = (visit: SiteVisit) => {
    setSelectedVisit(visit)
    setIsDetailsOpen(true)
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    meta: {
      onViewDetails: handleViewDetails,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const handleAddLogSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddLogOpen(false)
    toast.success(t("Log added successfully"))
  }

  const handleExport = async () => {
    try {
      const data = await chrome.storage.local.get('detectorLogs')
      const logs = data.detectorLogs || []
      
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `traceguard-logs-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(t("Logs exported successfully"))
    } catch (e) {
      console.error(e)
      toast.error(t("Failed to export logs"))
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder={t("Search domain...")}
            value={(table.getColumn("domain")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("domain")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon />
            <span className="hidden lg:inline">{t("Export")}</span>
          </Button>
          <Dialog open={isAddLogOpen} onOpenChange={setIsAddLogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon />
                <span className="hidden lg:inline">{t("Add Log")}</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("Add Manual Log")}</DialogTitle>
              <DialogDescription>
                {t("Manually record a site visit and safety metrics.")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLogSubmit} className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="domain">{t("Domain")}</Label>
                  <Input id="domain" placeholder="example.com" required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wss">{t("Safety Score")}</Label>
                  <Input id="wss" type="number" placeholder="85" min="0" max="100" required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="trackers">{t("Trackers Blocked")}</Label>
                  <Input id="trackers" type="number" placeholder="0" min="0" required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cookies">{t("Cookies Detected")}</Label>
                  <Input id="cookies" type="number" placeholder="0" min="0" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reputation">{t("Reputation")}</Label>
                  <Select required defaultValue="Clean">
                    <SelectTrigger id="reputation">
                      <SelectValue placeholder={t("Select")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Clean">{t("Clean")}</SelectItem>
                      <SelectItem value="Suspicious">{t("Suspicious")}</SelectItem>
                      <SelectItem value="Blacklisted">{t("Blacklisted")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="policy">{t("Policy Grade")}</Label>
                  <Select required defaultValue="N/A">
                    <SelectTrigger id="policy">
                      <SelectValue placeholder={t("Select")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="inputs">{t("Sensitive Inputs (PII Risk)")}</Label>
                <Select required defaultValue="No">
                  <SelectTrigger id="inputs">
                    <SelectValue placeholder={t("Select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">{t("Yes (Risk Detected)")}</SelectItem>
                    <SelectItem value="No">{t("No (Safe)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="sm:justify-start pt-2">
                <Button type="submit" className="w-full">{t("Save log")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t("No logs found.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {t("Showing {{length}} of {{total}} logs", { length: table.getRowModel().rows.length, total: table.getFilteredRowModel().rows.length })}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              {t("Rows per page")}
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger className="w-20 h-8" id="rows-per-page">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            {t("Page {{index}} of {{count}}", { index: table.getState().pagination.pageIndex + 1, count: table.getPageCount() || 1 })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t("Go to first page")}</span>
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t("Go to previous page")}</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t("Go to next page")}</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t("Go to last page")}</span>
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <SiteDetailsPanel
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        domain={selectedVisit?.domain ?? ""}
        timestamp={selectedVisit?.timestamp ?? 0}
        wss={selectedVisit?.wss ?? 0}
        safetyLevel={selectedVisit?.safetyLevel ?? ""}
        siteData={selectedVisit ? (siteCache[selectedVisit.domain] ?? null) : null}
        legacyDetails={selectedVisit?.details}
      />
    </div>
  )
}
