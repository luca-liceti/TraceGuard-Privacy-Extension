"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { Globe, Palette, ShieldUser, Bell, HardDrive, Info, LayoutGrid, Settings, MonitorSmartphone, Lock, AlertTriangle, OctagonAlert, Database, RefreshCw, Download, Trash2, RotateCcw } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { useSiteCache } from "@/lib/useStorage"
import { useSettingsModal } from "./settings-context"
import { SiteDetailsPanel } from "./site-details-panel"
import { Badge } from "@/components/ui/badge"
import { getRiskLevelBadge, getSafetyTextColor } from "@/lib/theme-utils"
import { getSafetyLevel } from "@/lib/risk-utils"
import { SiteRiskData } from "@/lib/types"

export function SearchCommand() {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const { sites } = useSiteCache()
  const { setSettingsOpen, setActiveTab } = useSettingsModal()

  // State for Site Details Panel
  const [selectedSiteData, setSelectedSiteData] = React.useState<SiteRiskData | null>(null)
  const [selectedDomain, setSelectedDomain] = React.useState<string>("")
  const [isSitePanelOpen, setIsSitePanelOpen] = React.useState(false)

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

  const openSettings = (tab: string) => {
    setOpen(false)
    setActiveTab(tab)
    setSettingsOpen(true)
  }

  const openSiteDetails = (domain: string, data: SiteRiskData) => {
    setOpen(false)
    setSelectedDomain(domain)
    setSelectedSiteData(data)
    setIsSitePanelOpen(true)
  }

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
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
        <CommandList>
          <CommandEmpty>{t("No results found.")}</CommandEmpty>
          
          <CommandGroup heading={t("Navigation")}>
            <CommandItem value="overview dashboard home" onSelect={() => setOpen(false)}>
              <LayoutGrid className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{t("Overview Dashboard")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Pages > Overview")}</span>
              </div>
            </CommandItem>
            <CommandItem value="settings preferences modal" onSelect={() => openSettings("appearance")}>
              <Settings className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{t("Settings")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Pages > Settings Modal")}</span>
              </div>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />
          
          {sites && sites.length > 0 && (
            <>
              <CommandGroup heading={t("Analyzed Sites")}>
                {sites.map(([domain, data]) => {
                  const wss = data.wss || 0;
                  const safetyLevelStr = getSafetyLevel(wss);
                  const colorClass = getSafetyTextColor(safetyLevelStr);
                  
                  return (
                    <CommandItem
                      key={String(domain)}
                      value={String(domain)}
                      onSelect={() => openSiteDetails(domain, data)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center flex-1 min-w-0 mr-4">
                        <Globe className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col truncate">
                          <span className="truncate font-medium">{domain}</span>
                          <span className="text-[10px] text-muted-foreground tracking-wider uppercase truncate">
                            {t("Data > Analyzed Sites")} &gt; {domain}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold ${colorClass}`}>
                          {wss}
                        </span>
                        <Badge variant="outline" className={`text-[10px] uppercase ${colorClass}`}>
                          {safetyLevelStr}
                        </Badge>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          
          <CommandGroup heading={t("Settings")}>
            <CommandItem value="theme appearance dark light system" onSelect={() => openSettings("appearance")}>
              <Palette className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Theme")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Appearance")}</span>
              </div>
            </CommandItem>
            <CommandItem value="display mode popup sidebar panel" onSelect={() => openSettings("appearance")}>
              <MonitorSmartphone className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Display Mode")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Appearance")}</span>
              </div>
            </CommandItem>

            <CommandItem value="pii detection privacy monitor" onSelect={() => openSettings("privacy")}>
              <ShieldUser className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("PII Detection")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Privacy")}</span>
              </div>
            </CommandItem>
            <CommandItem value="vault auto-lock auto lock timeout privacy" onSelect={() => openSettings("privacy")}>
              <Lock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Vault Auto-Lock")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Privacy")}</span>
              </div>
            </CommandItem>
            <CommandItem value="safety threshold alert privacy" onSelect={() => openSettings("privacy")}>
              <AlertTriangle className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Safety Threshold")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Privacy")}</span>
              </div>
            </CommandItem>

            <CommandItem value="notifications alert level silent balanced aggressive" onSelect={() => openSettings("notifications")}>
              <Bell className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Alert Level")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Notifications")}</span>
              </div>
            </CommandItem>

            <CommandItem value="whitelist allowed sites exceptions domain lists" onSelect={() => openSettings("domain-lists")}>
              <Globe className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Allowed Sites (Whitelist)")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Domain Lists")}</span>
              </div>
            </CommandItem>
            <CommandItem value="blacklist blocked sites domain lists" onSelect={() => openSettings("domain-lists")}>
              <OctagonAlert className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Blocked Sites (Blacklist)")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Domain Lists")}</span>
              </div>
            </CommandItem>

            <CommandItem value="data retention logs keep days delete" onSelect={() => openSettings("data")}>
              <Database className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Data Retention")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Data")}</span>
              </div>
            </CommandItem>
            <CommandItem value="database refresh trackers update schedule" onSelect={() => openSettings("data")}>
              <RefreshCw className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Database Refresh")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Data")}</span>
              </div>
            </CommandItem>
            <CommandItem value="storage used usage size quota" onSelect={() => openSettings("data")}>
              <HardDrive className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Storage Used")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Data")}</span>
              </div>
            </CommandItem>
            <CommandItem value="export data backup download json" onSelect={() => openSettings("data")}>
              <Download className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Export Data")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Data")}</span>
              </div>
            </CommandItem>
            <CommandItem value="clear activity logs delete clear data" onSelect={() => openSettings("data")}>
              <Trash2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Clear Activity Logs")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Data")}</span>
              </div>
            </CommandItem>
            <CommandItem value="reset privacy score ups score clear" onSelect={() => openSettings("data")}>
              <RotateCcw className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("Reset Privacy Score")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > Data")}</span>
              </div>
            </CommandItem>

            <CommandItem value="about version info" onSelect={() => openSettings("about")}>
              <Info className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{t("About TraceGuard")}</span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{t("Settings > About")}</span>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <SiteDetailsPanel
        siteData={selectedSiteData}
        legacyDetails={selectedSiteData?.legacyDetails}
        domain={selectedDomain}
        timestamp={selectedSiteData?.timestamp || Date.now()}
        wss={selectedSiteData?.wss || 0}
        safetyLevel={getSafetyLevel(selectedSiteData?.wss || 0)}
        open={isSitePanelOpen}
        onOpenChange={setIsSitePanelOpen}
      />
    </>
  )
}
