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
} from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"
import { toast } from "sonner"

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

const columns: ColumnDef<SiteVisit>[] = [
  {
    accessorKey: "domain",
    header: "Domain",
    cell: ({ row }) => <div className="font-medium">{row.getValue("domain")}</div>,
  },
  {
    accessorKey: "timestamp",
    header: "Visit Time",
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
    header: "Safety Level",
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
    header: "Trackers",
    cell: ({ row }) => <div>{row.getValue("trackers")}</div>,
  },
  {
    accessorKey: "cookies",
    header: "Cookies",
    cell: ({ row }) => <div>{row.getValue("cookies")}</div>,
  },
  {
    accessorKey: "inputs",
    header: "PII Risk",
    cell: ({ row }) => <div>{row.getValue("inputs")}</div>,
  },
  {
    accessorKey: "reputation",
    header: "Reputation",
    cell: ({ row }) => <div>{row.getValue("reputation")}</div>,
  },
  {
    accessorKey: "policy",
    header: "Policy",
    cell: ({ row }) => {
      const grade = row.getValue("policy") as string
      return <div className={`font-semibold ${getPolicyColor(grade)}`}>{grade}</div>
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
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => (table.options.meta as any)?.onViewDetails(row.original)}>
              View details
            </DropdownMenuItem>
            <DropdownMenuItem>Export</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Delete log
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function DataTable({ data }: { data: SiteVisit[] }) {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    reputation: false,
    policy: false,
  })
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
      columnVisibility,
      columnFilters,
      pagination,
    },
    meta: {
      onViewDetails: handleViewDetails,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const handleAddLogSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddLogOpen(false)
    toast.success("Log added successfully")
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search domain..."
            value={(table.getColumn("domain")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("domain")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <ColumnsIcon className="mr-2 size-4" />
                Columns
                <ChevronDownIcon className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Dialog open={isAddLogOpen} onOpenChange={setIsAddLogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusIcon />
              <span className="hidden lg:inline">Add Log</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Manual Log</DialogTitle>
              <DialogDescription>
                Manually record a site visit and safety score.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLogSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="domain" className="text-right">
                  Domain
                </Label>
                <Input id="domain" placeholder="example.com" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="wss" className="text-right">
                  Score
                </Label>
                <Input id="wss" type="number" placeholder="85" min="0" max="100" className="col-span-3" required />
              </div>
              <DialogFooter className="sm:justify-start">
                <Button type="submit" className="w-full">Save log</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                  No logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} logs
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
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
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">{selectedVisit?.domain}</SheetTitle>
            <SheetDescription>
              {selectedVisit && format(new Date(selectedVisit.timestamp), "MMM d, yyyy HH:mm:ss")}
            </SheetDescription>
          </SheetHeader>

          {selectedVisit?.details && (
            <div className="flex flex-col gap-6">
              {/* Overall Score */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Overall Safety Score</h3>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold">{selectedVisit.wss}</span>
                  <Badge variant="outline" className={getSafetyColor(selectedVisit.safetyLevel)}>
                    {selectedVisit.safetyLevel}
                  </Badge>
                </div>
              </div>

              <hr />

              {/* Cookies Section */}
              {selectedVisit.details.cookies && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Cookies Detected</h3>
                  
                  <div className="flex flex-col gap-4">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        Cross-Site Trackers
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">Highest penalty impact. These follow you across multiple websites.</p>
                      <div className="text-sm">Found: {selectedVisit.details.cookies.details?.['cross-site-tracker'] || 0}</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        Analytics & Third-Party Cookies
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">Moderate penalty impact. Standard HTTP tracking cookies.</p>
                      <div className="text-sm">Found: {(selectedVisit.details.cookies.details?.analytics || 0) + (selectedVisit.details.cookies.details?.['third-party'] || 0)}</div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        First-Party Cookies
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">No penalty impact. Essential for modern web functionality.</p>
                      <div className="text-sm">Found: {selectedVisit.details.cookies.details?.['first-party'] || 0}</div>
                    </div>
                  </div>
                </div>
              )}

              <hr />

              {/* Trackers Section */}
              {selectedVisit.details.tracking && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Third-Party Trackers</h3>
                  <div className="text-sm mb-2">Total Detected: <span className="font-medium">{selectedVisit.details.tracking.details?.count || 0}</span></div>
                  {selectedVisit.details.tracking.details?.knownTrackers?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Known Trackers:</div>
                      <div className="text-sm text-muted-foreground break-all">
                        {selectedVisit.details.tracking.details.knownTrackers.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <hr />

              {/* PII Risk Section */}
              {selectedVisit.details.inputs && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Sensitive Input Fields</h3>
                  <div className="text-sm mb-2">Total Detected: <span className="font-medium">{selectedVisit.details.inputs.details?.sensitive || 0}</span></div>
                  {selectedVisit.details.inputs.details?.types?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Field Types:</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedVisit.details.inputs.details.types.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
