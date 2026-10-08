"use client"

import * as React from "react"
import {
  ColumnDef,
} from "@tanstack/react-table"
import {
  AlertCircle,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MoreVerticalIcon,
  DownloadIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
} from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"
import { toast } from "@/components/ui/toast"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { getGradeTextColor, getSafetyBgColor, getSafetyTextColor } from "@/lib/theme-utils"
import { getSafetyLabel } from "@/lib/risk-utils"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { captureError } from "@/lib/diagnostics"
import { storage } from "@/lib/storage"
import { downloadJson } from "@/lib/export"
import { ExportDataDialog } from "@/components/traceguard/export-data-dialog"

import {
  DropdownMenu,
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
import { useSiteDetails } from "@/components/traceguard/site-details-context"
import { getColumns } from "./data-table-columns"
import { SiteRiskData } from "@/lib/types"
import { DomainGroup } from "@/lib/types"

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

// ── Safety level ordering for worst-case aggregation ────────────────────────
const SAFETY_ORDER: Record<string, number> = {
  Critical: 0,
  Poor: 1,
  Fair: 2,
  Good: 3,
  Excellent: 4,
}

const REPUTATION_ORDER: Record<string, number> = {
  Blacklisted: 0,
  Suspicious: 1,
  Clean: 2,
  Unknown: 3,
}

/**
 * Converts an array of SiteVisit rows for the same domain into a single
 * aggregated DomainGroup using the agreed-upon worst-case / avg / recency rules.
 */
export function buildDomainGroups(visits: SiteVisit[]): DomainGroup[] {
  const map = new Map<string, SiteVisit[]>()
  for (const v of visits) {
    const arr = map.get(v.domain) ?? []
    arr.push(v)
    map.set(v.domain, arr)
  }

  const groups: DomainGroup[] = []

  for (const [domain, domVisits] of map.entries()) {
    // Sort newest-first so [0] is the most recent visit
    const sorted = [...domVisits].sort((a, b) => b.timestamp - a.timestamp)
    const newest = sorted[0]

    // WSS: average
    const avgWss = Math.round(sorted.reduce((s, v) => s + v.wss, 0) / sorted.length)

    // Safety Level: worst-case
    const worstSafety = sorted.reduce((worst, v) => {
      return (SAFETY_ORDER[v.safetyLevel] ?? 99) < (SAFETY_ORDER[worst] ?? 99)
        ? v.safetyLevel
        : worst
    }, sorted[0].safetyLevel)

    // Trackers: max
    const maxTrackers = Math.max(...sorted.map(v => v.trackers))

    // Cookies: max
    const maxCookies = Math.max(...sorted.map(v => v.cookies))

    // PII: "Yes" if any visit had Yes
    const anyPii = sorted.some(v => v.inputs === "Yes" || v.inputs === "Sì" || v.inputs?.toLowerCase() === "yes")
      ? sorted.find(v => v.inputs === "Yes" || v.inputs === "Sì" || v.inputs?.toLowerCase() === "yes")!.inputs
      : sorted[0].inputs

    // Reputation: worst-case
    const worstReputation = sorted.reduce((worst, v) => {
      return (REPUTATION_ORDER[v.reputation] ?? 99) < (REPUTATION_ORDER[worst] ?? 99)
        ? v.reputation
        : worst
    }, sorted[0].reputation)

    // Policy: most recent
    const latestPolicy = newest.policy

    // Headers: most recent
    const latestHeaders = newest.headersGrade

    // Fingerprinting: max
    const maxFp = sorted.reduce((m, v) => Math.max(m, v.fingerprintingAttempts ?? 0), 0)

    const summary: SiteVisit = {
      id: `group-${domain}`,
      domain,
      timestamp: newest.timestamp,
      wss: avgWss,
      safetyLevel: worstSafety,
      trackers: maxTrackers,
      cookies: maxCookies,
      inputs: anyPii,
      reputation: worstReputation,
      policy: latestPolicy,
      headersGrade: latestHeaders,
      fingerprintingAttempts: maxFp || undefined,
      details: newest.details,
    }

    groups.push({ domain, visitCount: sorted.length, summary, visits: sorted })
  }

  // Sort groups by most recent visit timestamp descending
  groups.sort((a, b) => b.summary.timestamp - a.summary.timestamp)
  return groups
}

// ── Column definitions live in ./data-table-columns ─────────────────────

// ── Grouped row renderer ─────────────────────────────────────────────────────

// ── Clickable log value ──────────────────────────────────────────────────────

/**
 * A log value that opens the site details panel at the section it summarizes.
 * The summary row toggles the visit list on a row click, so the button stops
 * the click, and its activating key press, from reaching the row.
 */
function SectionLink({
  section,
  label,
  visit,
  onViewDetails,
  variant = "text",
  children,
}: {
  section: string
  label: string
  visit: SiteVisit
  onViewDetails: (visit: SiteVisit, section?: string) => void
  /** "text" underlines on hover; "pill" shifts the badge background instead. */
  variant?: "text" | "pill"
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      title={t("View details")}
      aria-label={`${t("View details")}: ${t(label)}`}
      onClick={(e) => {
        e.stopPropagation()
        onViewDetails(visit, section)
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={
        variant === "pill"
          ? "group inline-flex cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "cursor-pointer text-left hover:underline focus-visible:underline focus-visible:outline-none"
      }
    >
      {children}
    </button>
  )
}

interface GroupedTableBodyProps {
  groups: DomainGroup[]
  columns: ColumnDef<SiteVisit>[]
  expandedDomains: Set<string>
  onToggle: (domain: string) => void
  onViewDetails: (visit: SiteVisit, section?: string) => void
  onExportLog: (visit: SiteVisit) => void
  onDeleteLog: (visit: SiteVisit) => void
  t: (key: string, opts?: any) => string
}

function GroupedTableBody({
  groups,
  columns,
  expandedDomains,
  onToggle,
  onViewDetails,
  onExportLog,
  onDeleteLog,
  t,
}: GroupedTableBodyProps) {
  const colCount = columns.length

  if (groups.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colCount} className="h-24 text-center">
          {t("No logs found.")}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {groups.map((group) => {
        const isExpanded = expandedDomains.has(group.domain)
        const isMulti = group.visitCount > 1
        const s = group.summary

        return (
          <React.Fragment key={group.domain}>
            {/* ── Parent / Summary Row ─────────────────────────────────── */}
            <TableRow
              className={`transition-colors ${isMulti ? "cursor-pointer hover:bg-muted/60" : ""}`}
              onClick={() => isMulti && onToggle(group.domain)}
              onKeyDown={(e) => {
                if (isMulti && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  onToggle(group.domain)
                }
              }}
              tabIndex={isMulti ? 0 : undefined}
              role={isMulti ? "button" : undefined}
              aria-expanded={isMulti ? isExpanded : undefined}
            >
              {/* Domain cell with expand toggle */}
              <TableCell>
                <div className="flex items-center gap-2">
                  {isMulti ? (
                    <span
                      className="flex-shrink-0 text-muted-foreground transition-transform duration-200"
                      style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-3.5" />
                  )}
                  <button
                    type="button"
                    title={t("View details")}
                    aria-label={`${t("View details")}: ${s.domain}`}
                    onClick={(e) => {
                      // The row itself toggles the visit list; the domain label
                      // opens the details panel instead, so keep the click (and
                      // the key press that fires it) away from the row.
                      e.stopPropagation()
                      onViewDetails(s)
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="font-medium text-left hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {s.domain}
                  </button>
                  {isMulti && (
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[10px] px-1.5 py-0 h-4 font-mono tabular-nums bg-muted text-muted-foreground"
                    >
                      ×{group.visitCount}
                    </Badge>
                  )}
                </div>
              </TableCell>

              {/* Visit Time: most recent */}
              <TableCell>
                <div className="text-muted-foreground text-xs">
                  {format(new Date(s.timestamp), "MMM d, yyyy HH:mm:ss")}
                </div>
              </TableCell>

              {/* Safety Level: worst-case */}
              <TableCell>
                <Badge
                  variant="secondary"
                  className={`px-2.5 py-0.5 ${getSafetyBgColor(s.safetyLevel)} ${getSafetyTextColor(s.safetyLevel)}`}
                >
                  {t(getSafetyLabel(s.safetyLevel))}
                </Badge>
              </TableCell>

              {/* Trackers: max */}
              <TableCell>
                <SectionLink section="trackers" label="Trackers" visit={s} onViewDetails={onViewDetails}>
                  <div className="flex items-center gap-1">
                    <span>{s.trackers}</span>
                    {isMulti && s.trackers > 0 && (
                      <span className="text-[10px] text-muted-foreground">{t("max")}</span>
                    )}
                  </div>
                </SectionLink>
              </TableCell>

              {/* Cookies: max */}
              <TableCell>
                <SectionLink section="cookies" label="Cookies" visit={s} onViewDetails={onViewDetails}>
                  <div className="flex items-center gap-1">
                    <span>{s.cookies}</span>
                    {isMulti && s.cookies > 0 && (
                      <span className="text-[10px] text-muted-foreground">{t("max")}</span>
                    )}
                  </div>
                </SectionLink>
              </TableCell>

              {/* PII Risk: any Yes wins */}
              <TableCell>
                <SectionLink section="inputs" label="PII Risk" visit={s} onViewDetails={onViewDetails}>
                  <div>{t(s.inputs)}</div>
                </SectionLink>
              </TableCell>

              {/* Reputation: worst-case */}
              <TableCell>
                <SectionLink section="reputation" label="Reputation" visit={s} onViewDetails={onViewDetails}>
                  <div>{t(s.reputation)}</div>
                </SectionLink>
              </TableCell>

              {/* Policy: most recent */}
              <TableCell>
                <SectionLink section="policy" label="Policy" visit={s} onViewDetails={onViewDetails}>
                  <div className={`font-semibold ${getGradeTextColor(s.policy)}`}>{t(s.policy)}</div>
                </SectionLink>
              </TableCell>

              {/* Headers: most recent */}
              <TableCell>
                {s.headersGrade
                  ? (
                    <SectionLink section="headers" label="Headers" visit={s} onViewDetails={onViewDetails}>
                      <div className={`font-semibold ${getGradeTextColor(s.headersGrade)}`}>{s.headersGrade}</div>
                    </SectionLink>
                  )
                  : <div className="text-muted-foreground text-xs">—</div>
                }
              </TableCell>

              {/* Fingerprinting: max */}
              <TableCell>
                {s.fingerprintingAttempts === undefined || s.fingerprintingAttempts === null
                  ? <div className="text-muted-foreground text-xs">—</div>
                  : s.fingerprintingAttempts === 0
                    ? (
                      <SectionLink section="fingerprinting" label="Fingerprinting" visit={s} onViewDetails={onViewDetails}>
                        <div>0</div>
                      </SectionLink>
                    )
                    : (
                      <SectionLink section="fingerprinting" label="Fingerprinting" visit={s} onViewDetails={onViewDetails} variant="pill">
                        <Badge variant="secondary" className="text-xs bg-warning/20 text-warning border-transparent group-hover:bg-warning/30">
                          {s.fingerprintingAttempts}
                        </Badge>
                      </SectionLink>
                    )
                }
              </TableCell>

              {/* Actions */}
              <TableCell onClick={(e) => e.stopPropagation()}>
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
                    <DropdownMenuItem onClick={() => onViewDetails(s)}>
                      {t("View details")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExportLog(s)}>
                      {t("Export")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteLog(s)}
                    >
                      {t("Delete log")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>

            {/* ── Child / Individual Visit Rows (expanded only) ─────────── */}
            {isMulti && isExpanded && group.visits.map((visit, idx) => (
              <TableRow
                key={visit.id ?? `${visit.domain}-${visit.timestamp}`}
                className="bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                {/* Domain cell with indent + left border accent */}
                <TableCell>
                  <div className="flex items-center gap-2 pl-7">
                    <button
                      type="button"
                      title={t("View details")}
                      aria-label={`${t("View details")}: ${visit.domain}`}
                      onClick={() => onViewDetails(visit)}
                      className="border-l-2 border-muted-foreground/30 pl-2 text-sm text-muted-foreground text-left hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {visit.domain}
                    </button>
                    {idx === 0 && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 font-medium bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                        {t("Latest")}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Visit time */}
                <TableCell>
                  <div className="text-muted-foreground text-xs">
                    {format(new Date(visit.timestamp), "MMM d, yyyy HH:mm:ss")}
                  </div>
                </TableCell>

                {/* Safety Level */}
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`px-2 py-0 text-xs ${getSafetyBgColor(visit.safetyLevel)} ${getSafetyTextColor(visit.safetyLevel)}`}
                  >
                    {t(visit.safetyLevel)}
                  </Badge>
                </TableCell>

                {/* Trackers */}
                <TableCell>
                  <SectionLink section="trackers" label="Trackers" visit={visit} onViewDetails={onViewDetails}>
                    <div className="text-sm">{visit.trackers}</div>
                  </SectionLink>
                </TableCell>

                {/* Cookies */}
                <TableCell>
                  <SectionLink section="cookies" label="Cookies" visit={visit} onViewDetails={onViewDetails}>
                    <div className="text-sm">{visit.cookies}</div>
                  </SectionLink>
                </TableCell>

                {/* PII */}
                <TableCell>
                  <SectionLink section="inputs" label="PII Risk" visit={visit} onViewDetails={onViewDetails}>
                    <div className="text-sm">{t(visit.inputs)}</div>
                  </SectionLink>
                </TableCell>

                {/* Reputation */}
                <TableCell>
                  <SectionLink section="reputation" label="Reputation" visit={visit} onViewDetails={onViewDetails}>
                    <div className="text-sm">{t(visit.reputation)}</div>
                  </SectionLink>
                </TableCell>

                {/* Policy */}
                <TableCell>
                  <SectionLink section="policy" label="Policy" visit={visit} onViewDetails={onViewDetails}>
                    <div className={`font-semibold text-sm ${getGradeTextColor(visit.policy)}`}>{t(visit.policy)}</div>
                  </SectionLink>
                </TableCell>

                {/* Headers */}
                <TableCell>
                  {visit.headersGrade
                    ? (
                      <SectionLink section="headers" label="Headers" visit={visit} onViewDetails={onViewDetails}>
                        <div className={`font-semibold text-sm ${getGradeTextColor(visit.headersGrade)}`}>{visit.headersGrade}</div>
                      </SectionLink>
                    )
                    : <div className="text-muted-foreground text-xs">—</div>
                  }
                </TableCell>

                {/* Fingerprinting */}
                <TableCell>
                  {visit.fingerprintingAttempts === undefined || visit.fingerprintingAttempts === null
                    ? <div className="text-muted-foreground text-xs">—</div>
                    : visit.fingerprintingAttempts === 0
                      ? (
                        <SectionLink section="fingerprinting" label="Fingerprinting" visit={visit} onViewDetails={onViewDetails}>
                          <div className="text-sm">0</div>
                        </SectionLink>
                      )
                      : (
                        <SectionLink section="fingerprinting" label="Fingerprinting" visit={visit} onViewDetails={onViewDetails} variant="pill">
                          <Badge variant="secondary" className="text-xs bg-warning/20 text-warning border-transparent group-hover:bg-warning/30">
                            {visit.fingerprintingAttempts}
                          </Badge>
                        </SectionLink>
                      )
                  }
                </TableCell>

                {/* Actions */}
                <TableCell>
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
                      <DropdownMenuItem onClick={() => onViewDetails(visit)}>
                        {t("View details")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExportLog(visit)}>
                        {t("Export")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteLog(visit)}
                      >
                        {t("Delete log")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── Main DataTable component ─────────────────────────────────────────────────

export function DataTable({
  data,
  siteCache = {},
  domainGroups,
}: {
  data: SiteVisit[]
  siteCache?: Record<string, SiteRiskData>
  /** Pre-built domain groups. If omitted, groups are built from `data`. */
  domainGroups?: DomainGroup[]
}) {
  const { t } = useTranslation()
  const columns = React.useMemo(() => getColumns(t), [t])

  // Build groups if not provided
  const groups = React.useMemo<DomainGroup[]>(() => {
    return domainGroups ?? buildDomainGroups(data)
  }, [domainGroups, data])

  // Filter state, we filter groups by domain name
  const [domainFilter, setDomainFilter] = React.useState("")
  const filteredGroups = React.useMemo(() => {
    if (!domainFilter) return groups
    const q = domainFilter.toLowerCase()
    return groups.filter(g => g.domain.toLowerCase().includes(q))
  }, [groups, domainFilter])

  // Pagination (operates on filteredGroups)
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / pageSize))
  const pagedGroups = filteredGroups.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  // Accordion expand state
  const [expandedDomains, setExpandedDomains] = React.useState<Set<string>>(new Set())
  const allExpandable = pagedGroups.filter(g => g.visitCount > 1).map(g => g.domain)
  const allExpanded = allExpandable.length > 0 && allExpandable.every(d => expandedDomains.has(d))

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedDomains(new Set())
    } else {
      setExpandedDomains(new Set(allExpandable))
    }
  }

  const [exportDataOpen, setExportDataOpen] = React.useState(false)
  const { openSiteDetails } = useSiteDetails()
  const [searchParams, setSearchParams] = useSearchParams()

  React.useEffect(() => {
    const domainToView = searchParams.get('viewSite')
    // Optional deep-link target, e.g. `section=inputs` from a PII notification
    const sectionToView = searchParams.get('section') ?? undefined
    if (!domainToView) return

    // Prefer the journal row, then fall back to the site cache (detector logs
    // are capped at ~200 visits, so a notification for an older site would
    // otherwise silently do nothing). A domain with neither still does nothing,
    // as before: an empty panel would read as "this site is clean".
    const visit = data.find(v => v.domain === domainToView)
    if (visit) {
      openSiteDetails(domainToView, { visit, highlightSection: sectionToView })
    } else if (siteCache[domainToView]) {
      openSiteDetails(domainToView, { highlightSection: sectionToView })
    } else {
      return
    }
    searchParams.delete('viewSite')
    searchParams.delete('section')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, data, siteCache, openSiteDetails, setSearchParams])

  // Reset to first page when filter or page size changes
  React.useEffect(() => { setPageIndex(0) }, [domainFilter, pageSize])

  const handleViewDetails = (visit: SiteVisit, section?: string) => {
    openSiteDetails(visit.domain, { visit, highlightSection: section })
  }

  const handleExportSingleLog = async (visit: SiteVisit) => {
    try {
      await downloadJson(
        JSON.stringify(visit, null, 2),
        `traceguard-log-${visit.domain}-${visit.timestamp}.json`
      )
      toast.add({ type: "success", title: t("Log exported successfully") })
    } catch (e) {
      captureError('dashboard', e, 'log_export_failed')
      toast.add({ type: "error", title: t("Failed to export log"), priority: "high" })
    }
  }

  const handleDeleteLog = async (visit: SiteVisit) => {
    try {
      const key = await storage.getVaultKey()
      const timeWindow = Math.floor(visit.timestamp / 5000) * 5000
      await storage.removeDetectorLogs((log: any) => {
        const logTimeWindow = Math.floor(log.timestamp / 5000) * 5000
        return log.domain === visit.domain && logTimeWindow === timeWindow
      }, key)
      toast.add({ type: "success", title: t("Log deleted successfully") })
    } catch (e) {
      captureError('dashboard', e, 'log_delete_failed')
      toast.add({ type: "error", title: t("Failed to delete log"), priority: "high" })
    }
  }

  return (
    <ErrorBoundary fallback={
      <div className="flex w-full h-64 border rounded-md items-center justify-center text-muted-foreground gap-2">
        <AlertCircle className="h-6 w-6" />
        <p>{t("Failed to load activity logs table")}</p>
      </div>
    }>
    <div className="flex w-full flex-col gap-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder={t("Search domain...")}
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {/* Expand / Collapse All, only shown when there are multi-visit groups */}
          {allExpandable.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="h-8 gap-1.5 text-xs text-muted-foreground"
            >
              {allExpanded
                ? <><ChevronsDownUpIcon className="size-3.5" /><span className="hidden sm:inline">{t("Collapse All")}</span></>
                : <><ChevronsUpDownIcon className="size-3.5" /><span className="hidden sm:inline">{t("Expand All")}</span></>
              }
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setExportDataOpen(true)}>
            <DownloadIcon />
            <span className="hidden lg:inline">{t("Export")}</span>
          </Button>
          {/* ── Export (shared dialog: full backup, optional encryption) ── */}
          <ExportDataDialog open={exportDataOpen} onOpenChange={setExportDataOpen} />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const id = (col as any).accessorKey ?? (col as any).id
                const header = typeof col.header === "string" ? col.header : id
                return (
                  <TableHead key={id}>
                    {header}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            <GroupedTableBody
              groups={pagedGroups}
              columns={columns}
              expandedDomains={expandedDomains}
              onToggle={toggleDomain}
              onViewDetails={handleViewDetails}
              onExportLog={handleExportSingleLog}
              onDeleteLog={handleDeleteLog}
              t={t}
            />
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {t("Showing {{length}} of {{total}} sites", {
            length: pagedGroups.length,
            total: filteredGroups.length,
          })}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              {t("Rows per page")}
            </Label>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="w-20 h-8" id="rows-per-page">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((ps) => (
                  <SelectItem key={ps} value={`${ps}`}>{ps}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            {t("Page {{index}} of {{count}}", { index: pageIndex + 1, count: pageCount })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
            >
              <span className="sr-only">{t("Go to first page")}</span>
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setPageIndex(i => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
            >
              <span className="sr-only">{t("Go to previous page")}</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setPageIndex(i => Math.min(pageCount - 1, i + 1))}
              disabled={pageIndex >= pageCount - 1}
            >
              <span className="sr-only">{t("Go to next page")}</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={pageIndex >= pageCount - 1}
            >
              <span className="sr-only">{t("Go to last page")}</span>
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}
