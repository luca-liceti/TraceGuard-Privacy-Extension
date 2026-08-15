"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  Globe,
  Palette,
  ShieldUser,
  Bell,
  HardDrive,
  Info,
  LayoutGrid,
  Settings,
  MonitorSmartphone,
  Lock,
  AlertTriangle,
  OctagonAlert,
  Database,
  Download,
  Trash2,
  RotateCcw,
  BarChart2,
  HelpCircle,
  Sparkles,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSiteCache } from "@/lib/useStorage"
import { useSettingsModal } from "./settings-context"
import { SiteDetailsPanel } from "./site-details-panel"
import { getSafetyTextColor } from "@/lib/theme-utils"
import { getSafetyLevel } from "@/lib/risk-utils"
import { SiteRiskData } from "@/lib/types"
import { useAuth } from "@/components/traceguard/auth-provider"

const MAX_VISIBLE_SITES = 5

export function SearchCommand() {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const { sites } = useSiteCache()
  const { setSettingsOpen, setActiveTab } = useSettingsModal()
  const navigate = useNavigate()
  const { lock } = useAuth()

  // State for Site Details Panel
  const [selectedSiteData, setSelectedSiteData] = React.useState<SiteRiskData | null>(null)
  const [selectedDomain, setSelectedDomain] = React.useState<string>("")
  const [isSitePanelOpen, setIsSitePanelOpen] = React.useState(false)

  // ⌘K shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const goTo = (path: string) => {
    setOpen(false)
    setTimeout(() => {
      navigate(path)
    }, 50)
  }

  const openSettings = (tab: string) => {
    setOpen(false)
    setTimeout(() => {
      setActiveTab(tab)
      setSettingsOpen(true)
    }, 50)
  }

  const openSiteDetails = (domain: string, data: SiteRiskData) => {
    setOpen(false)
    setTimeout(() => {
      setSelectedDomain(domain)
      setSelectedSiteData(data)
      setIsSitePanelOpen(true)
    }, 50)
  }

  // ── Quick Actions ──────────────────────────────────────────────────────────

  const handleLockExtension = () => {
    setOpen(false)
    setTimeout(() => {
      if (!confirm(t("Lock TraceGuard? You will need to re-enter your PIN to continue."))) return
      lock()
    }, 50)
  }

  const handleExportData = async () => {
    setOpen(false)
    setTimeout(async () => {
      try {
        const allData = await chrome.storage.local.get(null)
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `traceguard-backup-${new Date().toISOString().split("T")[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(t("Data Exported"), {
          description: t("Your activity logs and settings have been exported."),
          duration: 3000,
        })
      } catch {
        toast.error(t("Export Failed"), {
          description: t("Could not export data. Please try again."),
        })
      }
    }, 50)
  }

  const handleClearLogs = async () => {
    setOpen(false)
    setTimeout(async () => {
      if (!confirm(t("Clear all activity logs? This cannot be undone."))) return
      await chrome.storage.local.set({ logs: [], piiDetections: [], detectorLogs: [] })
      toast.success(t("Activity Logs Cleared"), {
        description: t("All logged events have been removed."),
        duration: 3000,
      })
    }, 50)
  }

  const handleResetScore = async () => {
    setOpen(false)
    setTimeout(async () => {
      if (!confirm(t("Reset your Privacy Score to 100? This will clear your browsing history data."))) return
      const currentState = (await chrome.storage.local.get("state")).state || {}
      await chrome.storage.local.set({
        state: { ...currentState, ups: 100, sitesAnalyzed: 0, trackersBlocked: 0, piiEventsCount: 0 },
        scoreHistory: [],
        siteCache: {},
      })
      toast.success(t("Privacy Score Reset"), {
        description: t("Your UPS has been reset to 100."),
        duration: 3000,
      })
    }, 50)
  }

  // ── Data processing ────────────────────────────────────────────────────────

  // Top 3 most recently analyzed sites for the Suggestions section
  const recentSites = React.useMemo(() => {
    if (!sites || sites.length === 0) return []
    return [...sites]
      .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 3)
  }, [sites])

  // All sites capped for the Analyzed Sites section
  const visibleSites = React.useMemo(() => {
    if (!sites) return []
    return sites.slice(0, MAX_VISIBLE_SITES)
  }, [sites])

  const hasMoreSites = sites && sites.length > MAX_VISIBLE_SITES

  // ── Render helpers ─────────────────────────────────────────────────────────

  const SiteItem = ({ domain, data }: { domain: string; data: SiteRiskData }) => {
    const wss = data.wss || 0
    const safetyLevelStr = getSafetyLevel(wss)
    const colorClass = getSafetyTextColor(safetyLevelStr)
    return (
      <CommandItem
        key={String(domain)}
        value={String(domain)}
        onSelect={() => openSiteDetails(domain, data)}
        className="flex items-center justify-between group"
      >
        <div className="flex items-center flex-1 min-w-0 mr-4">
          <Globe className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{domain}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold tabular-nums ${colorClass}`}>{wss}</span>
          <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${colorClass}`}>
            {safetyLevelStr}
          </Badge>
        </div>
      </CommandItem>
    )
  }

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        className="relative h-8 w-full justify-start bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <span className="hidden lg:inline-flex">{t("Search data or settings...")}</span>
        <span className="inline-flex lg:hidden">{t("Search...")}</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("Type a command or search...")} />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>{t("No results found.")}</CommandEmpty>

          {/* ── Suggestions: top 3 most recent sites ─────────────────────── */}
          {recentSites.length > 0 && (
            <>
              <CommandGroup heading={t("Suggestions")}>
                {recentSites.map(([domain, data]) => (
                  <SiteItem key={String(domain)} domain={domain} data={data} />
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* ── Pages ────────────────────────────────────────────────────── */}
          <CommandGroup heading={t("Pages")}>
            <CommandItem value="overview dashboard home" onSelect={() => goTo("/overview")}>
              <LayoutGrid className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Overview")}</span>
            </CommandItem>
            <CommandItem value="rankings stats sites analysis" onSelect={() => goTo("/rankings")}>
              <BarChart2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Rankings & Stats")}</span>
            </CommandItem>
            <CommandItem value="privacy score ups breakdown detail" onSelect={() => goTo("/privacy-score")}>
              <Shield className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Privacy Score Breakdown")}</span>
            </CommandItem>
            <CommandItem value="help documentation faq guide support" onSelect={() => goTo("/help")}>
              <HelpCircle className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Help & Documentation")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Quick Actions ─────────────────────────────────────────────── */}
          <CommandGroup heading={t("Quick Actions")}>
            <CommandItem value="lock extension vault security" onSelect={handleLockExtension}>
              <Lock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Lock Extension")}</span>
            </CommandItem>
            <CommandItem value="export data backup download json" onSelect={handleExportData}>
              <Download className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Export Data")}</span>
            </CommandItem>
            <CommandItem value="clear activity logs delete events" onSelect={handleClearLogs}>
              <Trash2 className="mr-2 h-4 w-4 shrink-0 text-destructive/70" />
              <span className="text-destructive">{t("Clear Activity Logs")}</span>
            </CommandItem>
            <CommandItem value="reset privacy score ups history" onSelect={handleResetScore}>
              <RotateCcw className="mr-2 h-4 w-4 shrink-0 text-destructive/70" />
              <span className="text-destructive">{t("Reset Privacy Score")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Appearance & Display ──────────────────────────────────────── */}
          <CommandGroup heading={t("Appearance & Display")}>
            <CommandItem value="theme dark light system mode color" onSelect={() => openSettings("appearance")}>
              <Palette className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Theme")}</span>
            </CommandItem>
            <CommandItem value="display mode popup sidebar panel view" onSelect={() => openSettings("appearance")}>
              <MonitorSmartphone className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Display Mode")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Privacy & Security ────────────────────────────────────────── */}
          <CommandGroup heading={t("Privacy & Security")}>
            <CommandItem value="pii detection privacy monitor personal data" onSelect={() => openSettings("privacy")}>
              <ShieldUser className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("PII Detection")}</span>
            </CommandItem>
            <CommandItem value="vault auto-lock auto lock timeout pin" onSelect={() => openSettings("privacy")}>
              <Lock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Vault Auto-Lock")}</span>
            </CommandItem>
            <CommandItem value="safety threshold alert level risk trigger" onSelect={() => openSettings("privacy")}>
              <AlertTriangle className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Safety Threshold")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Notifications ─────────────────────────────────────────────── */}
          <CommandGroup heading={t("Notifications")}>
            <CommandItem value="notifications alert level silent balanced aggressive" onSelect={() => openSettings("notifications")}>
              <Bell className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Alert Level")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Domain Lists ──────────────────────────────────────────────── */}
          <CommandGroup heading={t("Domain Lists")}>
            <CommandItem value="whitelist allowed sites exceptions trusted" onSelect={() => openSettings("domain-lists")}>
              <Globe className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Allowed Sites (Whitelist)")}</span>
            </CommandItem>
            <CommandItem value="blacklist blocked sites dangerous malicious" onSelect={() => openSettings("domain-lists")}>
              <OctagonAlert className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Blocked Sites (Blacklist)")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Data & Storage ────────────────────────────────────────────── */}
          <CommandGroup heading={t("Data & Storage")}>
            <CommandItem value="data retention logs keep days delete duration" onSelect={() => openSettings("data")}>
              <Database className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Data Retention")}</span>
            </CommandItem>
            <CommandItem value="storage used usage size quota disk" onSelect={() => openSettings("data")}>
              <HardDrive className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("Storage Used")}</span>
            </CommandItem>
            <CommandItem value="about version info traceguard extension" onSelect={() => openSettings("about")}>
              <Info className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("About TraceGuard")}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Analyzed Sites (capped) ───────────────────────────────────── */}
          {sites && sites.length > 0 && (
            <CommandGroup heading={t("Analyzed Sites")}>
              {visibleSites.map(([domain, data]) => (
                <SiteItem key={String(domain)} domain={domain} data={data} />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {/* Site Details Panel */}
      <SiteDetailsPanel
        siteData={selectedSiteData}
        legacyDetails={selectedSiteData?.legacyDetails}
        domain={selectedDomain}
        timestamp={selectedSiteData?.timestamp || 0}
        wss={selectedSiteData?.wss || 0}
        safetyLevel={getSafetyLevel(selectedSiteData?.wss || 0)}
        open={isSitePanelOpen}
        onOpenChange={setIsSitePanelOpen}
      />
    </>
  )
}
