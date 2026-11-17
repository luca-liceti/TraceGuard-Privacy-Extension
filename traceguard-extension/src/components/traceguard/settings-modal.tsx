/**
 * =============================================================================
 * SETTINGS PAGE - User Preferences and Data Management
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the main settings page where users can customize TraceGuard's
 * behavior and manage their stored data.
 * 
 * SETTINGS TABS:
 * 
 * 1. APPEARANCE TAB
 *    - Theme: Light/Dark/System mode
 *    - Display Mode: Popup vs Side Panel
 * 
 * 2. PRIVACY TAB
 *    - Browsing analysis, personal-info detection, rating lookup, and local AI
 *    - Vault auto-lock
 * 
 * 3. NOTIFICATIONS TAB
 *    - Alert Level: Silent/Balanced/Aggressive notification modes
 *    - Safety Threshold: Which safety bands trigger an alert
 * 
 * 4. DATA TAB
 *    - Data Retention: How long to keep logs (preset windows)
 *    - Storage Usage: Visual display of storage used
 *    - Clear Actions: Delete activity logs, reset score
 *    - Reset to Defaults: Restore settings, keeping logs and site lists
 *    - Danger Zone: Delete all data
 * 
 * 5. ABOUT TAB
 *    - Version info and extension description
 * 
 * FEATURES:
 *    - Changes are tracked and require manual save
 *    - Discard unsaved changes reverts to the last saved values
 *    - Reset to defaults option
 *    - Storage usage monitoring
 *    - Danger zone with confirmation dialogs
 * =============================================================================
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useAppState, useSettings } from "@/lib/useStorage"
import { ExportDataDialog } from "./export-data-dialog"
import { ImportDataDialog } from "./import-data-dialog"
import { storage } from "@/lib/storage"
import { logEvent } from "@/lib/diagnostics"
import { clearCachedPolicyReports } from "@/lib/ai/policy-report-cache"
import { LoadingSpinner } from "@/components/ui/pending"
import { getErrorLog, clearErrorLog, type ErrorLogEntry } from "@/lib/error-log"
import { setDevMode } from "@/lib/diagnostics"
import { toast } from '@/components/ui/toast'
import { Bell, Database, Info, OctagonAlert, Palette, ShieldUser, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/components/theme-provider"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ModelRecommendation } from "./model-recommendation"
import { useSettingsModal } from "./settings-context"


// Validates a bare domain (e.g. example.com, sub.example.co.uk). Rejects
// whitespace, ports, paths, and other junk that would silently never match.
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z]{2,})+$/i;

function isValidDomain(value: string): boolean {
    return DOMAIN_PATTERN.test(value);
}

// Safety-band alert cutoffs. A site scoring below the chosen value triggers an
// alert: 20 = critical only, 40 = poor and critical, 60 = fair and worse,
// 80 = good and worse. The stored value is still a number, so a value from the
// old slider that is not one of these stays selectable as a custom option.
const THRESHOLD_OPTIONS = [20, 40, 60, 80]

// Preset retention windows in days. Legacy values from the old slider that are
// not listed here stay selectable as a custom option rather than being changed.
const RETENTION_OPTIONS = [7, 14, 30, 60, 90]


// Setting item component for consistent styling
function SettingItem({
    label,
    description,
    descriptionClassName,
    note,
    controlId,
    controlOnMobileTop = false,
    stacked = false,
    children
}: {
    label: string
    description?: string
    descriptionClassName?: string
    /** Optional caveat shown under the description, e.g. when a setting is inert. */
    note?: string
    /** Optional id linking this label to its control via htmlFor */
    controlId?: string
    /** Keep compact controls such as switches beside their label on phones. */
    controlOnMobileTop?: boolean
    /** Keep wide controls below their description at every viewport size. */
    stacked?: boolean
    children: React.ReactNode
}) {
    const text = (
        <>
            <Label htmlFor={controlId} className="text-base font-medium">{label}</Label>
            {description && (
                <p className={`${descriptionClassName ?? "text-sm"} text-muted-foreground break-words`}>{description}</p>
            )}
            {note && (
                <p className="text-sm text-warning break-words">{note}</p>
            )}
        </>
    )

    if (controlOnMobileTop) {
        return (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg border p-4 sm:items-center sm:gap-x-6">
                <div className="col-start-1 row-start-1 min-w-0"><Label htmlFor={controlId} className="text-base font-medium">{label}</Label></div>
                <div className="col-start-1 row-start-2 min-w-0 space-y-0.5">
                    {description && <p className={`${descriptionClassName ?? "text-sm"} text-muted-foreground break-words`}>{description}</p>}
                    {note && <p className="text-sm text-warning break-words">{note}</p>}
                </div>
                <div className="col-start-2 row-span-2 row-start-1 self-center">{children}</div>
            </div>
        )
    }

    // The control sits beside the description whenever it fits and drops below
    // it only when the card is genuinely too narrow. Wrapping on content beats a
    // fixed breakpoint: a short description never leaves a dead gap beside it.
    return (
        <div className={`rounded-lg border p-4 ${stacked ? 'flex flex-col gap-3' : 'flex flex-wrap items-center justify-between gap-x-6 gap-y-3'}`}>
            <div className={`min-w-0 space-y-0.5${stacked ? '' : ' flex-1 basis-[280px]'}`}>{text}</div>
            <div className={`flex [&>*]:max-w-full${stacked ? ' w-full' : ' w-full flex-shrink-0 sm:w-auto'}`}>
                {children}
            </div>
        </div>
    )
}

export function SettingsModal() {
    const { t } = useTranslation()
    const state = useAppState()
    const settings = useSettings()
    const { setTheme: applyTheme } = useTheme()
    const { isSettingsOpen, setSettingsOpen, activeTab, setActiveTab } = useSettingsModal()

    const [hasChanges, setHasChanges] = useState(false)
    const [discardOpen, setDiscardOpen] = useState(false)
    const [storageInfo, setStorageInfo] = useState({ bytesInUse: 0, quota: 0 })
    const [manifestVersion, setManifestVersion] = useState("1.0.0")
    const [schemaVersion, setSchemaVersion] = useState(1)

    // Local state for settings
    const [themeLocal, setThemeLocal] = useState(settings?.theme || "system")
    const [notificationLevel, setNotificationLevel] = useState(settings?.notificationLevel || "balanced")
    const [logRetentionDays, setLogRetentionDays] = useState(settings?.logRetentionDays || 30)
    const [databaseRefreshDays, setDatabaseRefreshDays] = useState(settings?.databaseRefreshDays ?? 0)
    const [wssThreshold, setWssThreshold] = useState(settings?.wssThreshold || 60)
    const [enabled, setEnabled] = useState(settings?.enabled ?? true)
    const [enablePIIDetection, setEnablePIIDetection] = useState(settings?.enablePIIDetection ?? true)
    const [weeklyDigest, setWeeklyDigest] = useState(settings?.weeklyDigest ?? true)
    const [enableCloudTosdr, setEnableCloudTosdr] = useState(settings?.enableCloudTosdr ?? false)
    const [enableLocalSummaries, setEnableLocalSummaries] = useState(settings?.enableLocalSummaries ?? false)
    const [localSummaryModel, setLocalSummaryModel] = useState(settings?.localSummaryModel ?? 'qwen3.5:0.8b')
    const [ollamaModels, setOllamaModels] = useState<string[]>([])
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false)
    const [ollamaModelsError, setOllamaModelsError] = useState(false)
    const [enableLocalPolicyReports, setEnableLocalPolicyReports] = useState(settings?.enableLocalPolicyReports ?? false)
    const [displayMode, setDisplayMode] = useState(settings?.displayMode || "sidebar")
    // Legacy "Never" (0) behaved exactly like "On Browser Close" (-1): both
    // simply skip the idle timer, and session storage clears on browser close
    // either way. Normalize any stored 0 to -1 and drop the redundant option.
    const [autoLockTimeout, setAutoLockTimeout] = useState(
        settings?.autoLockTimeout === 0 ? -1 : (settings?.autoLockTimeout ?? -1)
    )
    const [whitelist, setWhitelist] = useState<string[]>(settings?.whitelist || [])
    const [blacklist, setBlacklist] = useState<string[]>(settings?.blacklist || [])
    const [errorLog, setErrorLog] = useState<ErrorLogEntry[]>([])
    const [devMode, setDevModeLocal] = useState(settings?.devMode === true)
    const [exportOpen, setExportOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    const refreshOllamaModels = useCallback(async () => {
        setOllamaModelsLoading(true)
        setOllamaModelsError(false)
        try {
            const { listOllamaModels } = await import('@/lib/ai/ollama')
            setOllamaModels(await listOllamaModels())
        } catch (error) {
            setOllamaModelsError(true)
            logEvent('ui', 'warn', 'ai_summary_model_list_ui_failed', 'Settings could not refresh locally installed Ollama models', {
                error: error instanceof Error ? error.message : String(error),
            })
        } finally {
            setOllamaModelsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isSettingsOpen && (enableLocalSummaries || enableLocalPolicyReports)) {
            void refreshOllamaModels()
        }
    }, [isSettingsOpen, enableLocalSummaries, enableLocalPolicyReports, refreshOllamaModels])

    // Fetch manifest version
    useEffect(() => {
        const manifest = chrome.runtime.getManifest()
        setManifestVersion(manifest.version)
    }, [])

    // Fetch schema version from storage
    useEffect(() => {
        chrome.storage.local.get<{ schemaVersion?: number }>('schemaVersion').then((result) => {
            setSchemaVersion(result.schemaVersion || 1)
        })
    }, [])

    // Fetch storage usage
    useEffect(() => {
        const updateStorageInfo = async () => {
            setStorageInfo(await storage.getStorageUsage())
        }

        updateStorageInfo()
        const interval = setInterval(updateStorageInfo, 5000)
        return () => clearInterval(interval)
    }, [])

    // Refresh the local-only error list whenever the modal opens, and follow new
    // errors while it stays open. The list is cleared when the browser starts.
    useEffect(() => {
        if (!isSettingsOpen) return
        getErrorLog().then(setErrorLog)
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.errorLog) {
                getErrorLog().then(setErrorLog)
            }
        }
        chrome.storage.onChanged.addListener(listener)
        return () => chrome.storage.onChanged.removeListener(listener)
    }, [isSettingsOpen])

    // Copies the stored settings into the form's local state. Used on load and
    // when the user discards unsaved edits, so both paths apply the same values.
    const syncLocalFromSettings = useCallback((s: NonNullable<typeof settings>) => {
        setThemeLocal(s.theme || "system")
        setNotificationLevel(s.notificationLevel || "balanced")
        setLogRetentionDays(s.logRetentionDays || 30)
        setDatabaseRefreshDays(s.databaseRefreshDays ?? 0)
        setWssThreshold(s.wssThreshold || 60)
        setEnabled(s.enabled ?? true)
        setEnablePIIDetection(s.enablePIIDetection ?? true)
        setWeeklyDigest(s.weeklyDigest ?? true)
        setEnableCloudTosdr(s.enableCloudTosdr ?? false)
        setEnableLocalSummaries(s.enableLocalSummaries ?? false)
        setLocalSummaryModel(s.localSummaryModel ?? 'qwen3.5:0.8b')
        setEnableLocalPolicyReports(s.enableLocalPolicyReports ?? false)
        setDisplayMode(s.displayMode || "sidebar")
        setAutoLockTimeout(s.autoLockTimeout === 0 ? -1 : (s.autoLockTimeout ?? -1))
        setWhitelist(s.whitelist || [])
        setBlacklist(s.blacklist || [])
        setDevModeLocal(s.devMode === true)
        setDevMode(s.devMode === true)
    }, [])

    // Sync local state with stored settings when they load
    useEffect(() => {
        if (settings) syncLocalFromSettings(settings)
    }, [settings, syncLocalFromSettings])

    if (!state || !settings) return <div className="p-4"><LoadingSpinner label={t("Loading...")} /></div>

    const handleChange = () => {
        setHasChanges(true)
    }

    // Revert unsaved edits back to the last saved settings, without touching what
    // is stored. This backs the "Discard changes" button in the save bar;
    // restoring factory defaults is a separate action in the Data tab.
    const revertChanges = () => {
        if (settings) syncLocalFromSettings(settings)
        setHasChanges(false)
    }

    const saveSettings = async () => {
        const updatedSettings = {
            ...settings,
            theme: themeLocal,
            notificationLevel,
            enabled,
            logRetentionDays,
            databaseRefreshDays: databaseRefreshDays as 0 | 1 | 3 | 7 | 14 | 30,
            wssThreshold,
            enablePIIDetection,
            weeklyDigest,
            enableCloudTosdr,
            enableLocalSummaries,
            localSummaryModel,
            enableLocalPolicyReports,
            displayMode,
            autoLockTimeout,
            whitelist,
            blacklist,
            devMode,
        }

        await chrome.storage.local.set({ settings: updatedSettings })
        // Turning the feature off should not leave analyzed policies behind.
        if (settings.enableLocalPolicyReports && !enableLocalPolicyReports) {
            void clearCachedPolicyReports()
        }
        applyTheme(themeLocal)

        chrome.runtime.sendMessage({
            type: 'SETTINGS_CHANGED',
            settings: updatedSettings
        })

        setHasChanges(false)
        toast.add({
            type: 'success',
            title: t('Settings Saved'),
            description: t('Your preferences have been updated successfully.'),
        })
    }

    const resetSettings = async () => {
        const defaultPreferences = {
            theme: "system" as const,
            notificationLevel: "balanced" as const,
            enabled: true,
            logRetentionDays: 30,
            databaseRefreshDays: 7 as const,
            wssThreshold: 60,
            enablePIIDetection: true,
            weeklyDigest: true,
            enableCloudTosdr: false,
            enableLocalSummaries: false,
            localSummaryModel: 'qwen3.5:0.8b',
            enableLocalPolicyReports: false,
            displayMode: "sidebar" as const,
            autoLockTimeout: -1,
            devMode: false,
        }

        // Apply defaults to local state
        setThemeLocal(defaultPreferences.theme)
        applyTheme(defaultPreferences.theme)
        setNotificationLevel(defaultPreferences.notificationLevel)
        setEnabled(defaultPreferences.enabled)
        setLogRetentionDays(defaultPreferences.logRetentionDays)
        setDatabaseRefreshDays(defaultPreferences.databaseRefreshDays)
        setWssThreshold(defaultPreferences.wssThreshold)
        setEnablePIIDetection(defaultPreferences.enablePIIDetection)
        setWeeklyDigest(defaultPreferences.weeklyDigest)
        setEnableCloudTosdr(defaultPreferences.enableCloudTosdr)
        setEnableLocalSummaries(defaultPreferences.enableLocalSummaries)
        setLocalSummaryModel(defaultPreferences.localSummaryModel)
        setEnableLocalPolicyReports(defaultPreferences.enableLocalPolicyReports)
        setDisplayMode(defaultPreferences.displayMode)
        setAutoLockTimeout(defaultPreferences.autoLockTimeout)
        setDevModeLocal(defaultPreferences.devMode)
        setDevMode(defaultPreferences.devMode)

        // Merge defaults with existing settings to preserve other data (whitelist, blacklist, etc.)
        const newSettings = {
            ...settings,
            ...defaultPreferences
        }

        await chrome.storage.local.set({ settings: newSettings })
        // Reset disables local policy reports, so cached analyses must not
        // outlive the opt-in here either.
        if (settings.enableLocalPolicyReports) void clearCachedPolicyReports()

        chrome.runtime.sendMessage({
            type: 'SETTINGS_CHANGED',
            settings: newSettings
        })

        setHasChanges(false)
        toast.add({
            type: 'info',
            title: t('Settings Reset'),
            description: t('Preferences restored to default values.'),
        })
    }

    const clearActivityLogs = async () => {
        // Canonical path: removes keys so encrypted fields are never replaced
        // by plaintext sentinels. The AlertDialog is the single confirmation.
        await storage.clearActivityLogs()
        toast.add({
            type: 'success',
            title: t('Activity Logs Cleared'),
            description: t('All logged events have been removed.'),
        })
    }

    const resetPrivacyScore = async () => {
        await storage.resetScore()
        toast.add({
            type: 'success',
            title: t('Privacy Score Reset'),
            description: t('Your UPS has been reset to 100.'),
        })
    }

    const clearAllData = async () => {
        await storage.clearAll()
        toast.add({
            type: 'success',
            title: t('All Data Cleared'),
            description: t('Extension data has been reset. Reloading...'),
        })
        setTimeout(() => window.location.reload(), 2000)
    }


    const exportData = () => {
        setExportOpen(true)
    }

    const storagePercentage = storageInfo.quota > 0
        ? Math.min(100, (storageInfo.bytesInUse / storageInfo.quota) * 100)
        : 0

    return (
        <>
            <Dialog
                open={isSettingsOpen}
                onOpenChange={(open) => {
                    // Never close silently while there are unsaved changes -
                    // ask first (the confirm dialog below resolves the choice).
                    if (!open && hasChanges) {
                        setDiscardOpen(true)
                        return
                    }
                    setSettingsOpen(open)
                }}
            >
            <DialogContent
                // Height is capped to the viewport so a short window (a laptop with
                // devtools open, landscape phone) never clips the dialog's top and
                // bottom. The base 520px is the preferred height; max-h wins when the
                // viewport is shorter. Width keeps a small margin on narrow screens
                // instead of spanning edge to edge.
                className="max-w-4xl w-[calc(100vw-1rem)] sm:w-full h-[520px] max-h-[calc(100dvh-2rem)] p-0 overflow-hidden gap-0 bg-background border shadow-2xl flex flex-col"
                onEscapeKeyDown={(e) => {
                    if (hasChanges) {
                        e.preventDefault()
                        setDiscardOpen(true)
                    }
                }}
                onInteractOutside={(e) => {
                    if (hasChanges) {
                        e.preventDefault()
                        setDiscardOpen(true)
                    }
                }}
            >
                <DialogTitle className="sr-only">{t("Settings")}</DialogTitle>
                <DialogDescription className="sr-only">{t("Configure TraceGuard preferences")}</DialogDescription>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-w-0 flex-1 min-h-0 w-full flex-col sm:flex-row">
                    {/* The compact section picker keeps mobile navigation legible;
                        desktop uses the same clear text labels. */}
                    <div className="flex w-full shrink-0 flex-col border-b bg-muted/10 sm:h-full sm:w-[240px] sm:border-b-0 sm:border-r">
                        <div className="p-4 py-4 sm:py-6">
                            <h2 className="text-xl font-bold tracking-tight">{t("Settings")}</h2>
                        </div>
                        <div className="px-4 pb-4 sm:hidden">
                            <Select value={activeTab} onValueChange={setActiveTab}>
                                <SelectTrigger aria-label={t("Settings section")} className="w-full bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="appearance">{t("Appearance")}</SelectItem>
                                    <SelectItem value="privacy">{t("Privacy")}</SelectItem>
                                    <SelectItem value="notifications">{t("Notifications")}</SelectItem>
                                    <SelectItem value="domain-lists">{t("Allowed and flagged")}</SelectItem>
                                    <SelectItem value="data">{t("Data")}</SelectItem>
                                    <SelectItem value="about">{t("About")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="hidden sm:block">
                            <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-0 bg-transparent p-3 pt-0 sm:space-y-1">
                                <TabsTrigger value="appearance" aria-label={t("Appearance")} className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                    <Palette aria-hidden="true" className="h-4 w-4" />
                                    <span>{t("Appearance")}</span>
                                </TabsTrigger>
                                <TabsTrigger value="privacy" aria-label={t("Privacy")} className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                    <ShieldUser aria-hidden="true" className="h-4 w-4" />
                                    <span>{t("Privacy")}</span>
                                </TabsTrigger>
                                <TabsTrigger value="notifications" aria-label={t("Notifications")} className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                    <Bell aria-hidden="true" className="h-4 w-4" />
                                    <span>{t("Notifications")}</span>
                                </TabsTrigger>
                                <TabsTrigger value="domain-lists" aria-label={t("Allowed and flagged")} className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                    <OctagonAlert aria-hidden="true" className="h-4 w-4" />
                                    <span>{t("Allowed and flagged")}</span>
                                </TabsTrigger>
                                <TabsTrigger value="data" aria-label={t("Data")} className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                    <Database aria-hidden="true" className="h-4 w-4" />
                                    <span>{t("Data")}</span>
                                </TabsTrigger>
                                <TabsTrigger value="about" aria-label={t("About")} className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                    <Info aria-hidden="true" className="h-4 w-4" />
                                    <span>{t("About")}</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex min-w-0 flex-1 flex-col relative min-h-0 overflow-hidden">
                        {/* Save Changes Bar - At Top */}
                        {hasChanges && (
                            <div className="border-b border-primary/50 bg-background/95 backdrop-blur pl-4 pr-12 py-3 z-10 shrink-0 sm:pl-6 sm:pr-14">
                                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                        <span className="text-muted-foreground">{t("You have unsaved changes")}</span>
                                    </div>
                                    <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                                        <Button variant="ghost" size="sm" onClick={revertChanges}>
                                            {t("Discard changes")}
                                        </Button>
                                        <Button size="sm" onClick={saveSettings}>
                                            {t("Save Changes")}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 scroll-smooth space-y-6 sm:p-6">

                {/* Appearance Tab */}
                <TabsContent value="appearance" className="min-w-0 w-full space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">
                            {t("Appearance")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("Customize how TraceGuard looks and opens")}
                        </p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <SettingItem
                            label={t("Theme")}
                            description={t("Choose between light, dark, or system theme")}
                        >
                            <Select
                                value={themeLocal}
                                onValueChange={(value) => {
                                    setThemeLocal(value as 'light' | 'dark' | 'system')
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">{t("System")}</SelectItem>
                                    <SelectItem value="light">{t("Light")}</SelectItem>
                                    <SelectItem value="dark">{t("Dark")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                        <SettingItem
                            label={t("Display Mode")}
                            description={t("How TraceGuard opens when you click the extension icon")}
                        >
                            <Select
                                value={displayMode}
                                onValueChange={(value) => {
                                    setDisplayMode(value as 'popup' | 'sidebar')
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="popup">{t("Popup")}</SelectItem>
                                    <SelectItem value="sidebar">{t("Side Panel")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>
                    </div>
                </TabsContent>

                {/* Privacy Tab */}
                <TabsContent value="privacy" className="min-w-0 w-full space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">
                            {t("Privacy")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("Configure analysis, local AI, and rating lookups")}
                        </p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <SettingItem
                            label={t("Extension Enabled")}
                            description={t("Pause TraceGuard's site analysis, personal-info checks, and activity recording")}
                            controlId="enabled-toggle"
                            controlOnMobileTop
                        >
                            <Switch
                                id="enabled-toggle"
                                checked={enabled}
                                onCheckedChange={(checked) => {
                                    setEnabled(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>

                        <SettingItem
                            label={t("Personal Information Detection")}
                            description={t("Detect when you enter personal information on websites")}
                            controlId="pii-detection-toggle"
                            controlOnMobileTop
                        >
                            <Switch
                                id="pii-detection-toggle"
                                checked={enablePIIDetection}
                                onCheckedChange={(checked) => {
                                    setEnablePIIDetection(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>

                        <SettingItem
                            label={t("Live Rating Lookup")}
                            description={t("When a local rating is missing or over a week old, check ToS;DR for an update. Sends the site's domain.")}
                            controlId="cloud-tosdr-toggle"
                            controlOnMobileTop
                        >
                            <Switch
                                id="cloud-tosdr-toggle"
                                checked={enableCloudTosdr}
                                onCheckedChange={(checked) => {
                                    setEnableCloudTosdr(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>

                        <SettingItem
                            label={t("Local AI Summaries")}
                            description={t("Optional summaries run through Ollama on this device. Requests send site domains and analysis scores and counts. Overview summaries also send up to five visited domains. They do not send page text or personal-info field names.")}
                            controlId="local-summary-toggle"
                            controlOnMobileTop
                        >
                            <Switch
                                id="local-summary-toggle"
                                checked={enableLocalSummaries}
                                onCheckedChange={async (checked) => {
                                    setEnableLocalSummaries(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>
                        <SettingItem
                            label={t("Local Policy Reports")}
                            description={t("When enabled and no saved report exists, TraceGuard automatically checks unrated sites shown in the popup or side panel if a policy-capable Ollama model is loaded. It fetches up to four policy pages without cookies or site credentials; those hosts receive ordinary requests and can observe network metadata. If browser rendering is needed, one inactive tab may open as a fallback using your normal session, may send applicable cookies, and may appear in history. Up to 30,000 characters and the page address go only to Ollama on this device. Reports are provisional and do not change the site's score.")}
                            controlId="local-policy-report-toggle"
                            controlOnMobileTop
                        >
                            <Switch
                                id="local-policy-report-toggle"
                                checked={enableLocalPolicyReports}
                                onCheckedChange={(checked) => {
                                    setEnableLocalPolicyReports(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>
                        {(enableLocalSummaries || enableLocalPolicyReports) && (
                            <ModelRecommendation installedModels={ollamaModels} />
                        )}
                        {(enableLocalSummaries || enableLocalPolicyReports) && (
                            <SettingItem
                                label={t("Ollama Model")}
                                description={t("Choose an installed model. The list refreshes when Settings opens. Your saved choice remains visible if the model is unavailable.")}
                                controlId="local-summary-model"
                                stacked
                                note={ollamaModelsError
                                    ? t("Could not load Ollama models. Check that Ollama is running and allows this extension origin.")
                                    : !ollamaModelsLoading && ollamaModels.length === 0
                                        ? t("No installed Ollama models found.")
                                        : undefined}
                            >
                                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
                                    <Select
                                        value={localSummaryModel}
                                        onValueChange={(value) => {
                                            setLocalSummaryModel(value)
                                            handleChange()
                                        }}
                                        disabled={ollamaModelsLoading || ollamaModels.length === 0}
                                    >
                                        <SelectTrigger id="local-summary-model" className="w-full min-w-0 sm:flex-1 sm:w-auto">
                                            <SelectValue placeholder={ollamaModelsLoading ? t("Loading Ollama models…") : t("No installed Ollama models found.")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {localSummaryModel && !ollamaModelsError && !ollamaModels.includes(localSummaryModel) && (
                                                <SelectItem value={localSummaryModel}>{localSummaryModel} ({t("not installed")})</SelectItem>
                                            )}
                                            {ollamaModels.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full shrink-0 sm:w-auto"
                                        onClick={() => void refreshOllamaModels()}
                                        disabled={ollamaModelsLoading}
                                    >
                                        {ollamaModelsLoading ? t("Refreshing…") : t("Refresh")}
                                    </Button>
                                </div>
                            </SettingItem>
                        )}

                        <SettingItem
                            label={t("Vault Auto-Lock")}
                            description={t("Lock the vault after the selected period without activity")}
                        >
                            <Select
                                value={autoLockTimeout.toString()}
                                onValueChange={(value) => {
                                    setAutoLockTimeout(Number(value))
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="-1">{t("On Browser Close")}</SelectItem>
                                    <SelectItem value="1">{t("After 1 Minute")}</SelectItem>
                                    <SelectItem value="5">{t("After 5 Minutes")}</SelectItem>
                                    <SelectItem value="15">{t("After 15 Minutes")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                    </div>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="min-w-0 w-full space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">
                            {t("Notifications")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("Choose which alerts TraceGuard sends and how often")}
                        </p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <SettingItem
                            label={t("Alert Level")}
                            description={
                                notificationLevel === "silent"
                                    ? t("No system alerts. Items remain in the alert history.")
                                    : notificationLevel === "balanced"
                                        ? t("Critical and warning alerts. Up to five system alerts per browser session.")
                                        : t("All alert levels. Up to five system alerts per browser session.")
                            }
                        >
                            <Select
                                value={notificationLevel}
                                onValueChange={(value) => {
                                    setNotificationLevel(value as 'silent' | 'balanced' | 'aggressive')
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="silent">{t("Silent")}</SelectItem>
                                    <SelectItem value="balanced">{t("Balanced")}</SelectItem>
                                    <SelectItem value="aggressive">{t("Aggressive")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                        <SettingItem
                            label={t("Safety Threshold")}
                            description={t("Show a warning below this safety score. Sites at 20 or lower are always classed as critical.")}
                        >
                            <Select
                                value={String(wssThreshold)}
                                onValueChange={(value) => {
                                    setWssThreshold(Number(value))
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {!THRESHOLD_OPTIONS.includes(wssThreshold) && (
                                        <SelectItem value={String(wssThreshold)}>{t("Custom")} ({wssThreshold})</SelectItem>
                                    )}
                                    <SelectItem value="20">{t("No threshold-based warnings (critical at 20 or lower)")}</SelectItem>
                                    <SelectItem value="40">{t("Poor or worse (below 40)")}</SelectItem>
                                    <SelectItem value="60">{t("Fair or worse (below 60)")}</SelectItem>
                                    <SelectItem value="80">{t("Good or worse (below 80)")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                        <SettingItem
                            label={t("Weekly digest")}
                            description={t("Show a once-a-week summary of personal-info entries, low-scoring sites, and tracker companies. Computed on this device.")}
                            controlId="weekly-digest"
                        >
                            <Switch
                                id="weekly-digest"
                                checked={weeklyDigest}
                                onCheckedChange={(checked) => {
                                    setWeeklyDigest(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>
                    </div>
                </TabsContent>

                {/* Domain Lists Tab */}
                <TabsContent value="domain-lists" className="min-w-0 w-full space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">{t("Allowed and flagged sites")}</h3>
                        <p className="text-sm text-muted-foreground">{t("Set reputation overrides for specific domains. Allowed domains also exempt personal-info entries from risk penalties.")}</p>
                    </div>
                    <Separator />
                    
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium">{t("Allowed sites")}</h4>
                            <p className="text-sm text-muted-foreground">{t("Reputation is set to clean. Personal-info entries are recorded without risk penalties or alerts.")}</p>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                <Input 
                                    id="add-whitelist" 
                                    placeholder={t("e.g. example.com")} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim().toLowerCase();
                                            if (val && !isValidDomain(val)) {
                                                toast.add({ type: "error", title: t("Invalid domain"), description: t("Please enter a valid domain (e.g., example.com)"), priority: "high" });
                                            } else if (val && !whitelist.includes(val)) {
                                                setWhitelist([...whitelist, val]);
                                                handleChange();
                                            }
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <Button variant="outline" size="sm" onClick={() => {
                                    const input = document.getElementById('add-whitelist') as HTMLInputElement;
                                    const val = input.value.trim().toLowerCase();
                                    if (val && !isValidDomain(val)) {
                                        toast.add({ type: "error", title: t("Invalid domain"), description: t("Please enter a valid domain (e.g., example.com)"), priority: "high" });
                                    } else if (val && !whitelist.includes(val)) {
                                        setWhitelist([...whitelist, val]);
                                        handleChange();
                                    }
                                    input.value = '';
                                }}>{t("Add")}</Button>
                            </div>
                            <div className="rounded-md border max-h-40 overflow-y-auto">
                                {whitelist.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">{t("No allowed sites")}</div>
                                ) : (
                                    <ul className="divide-y">
                                        {whitelist.map(domain => (
                                            <li key={domain} className="flex items-center justify-between p-2 px-3 text-sm">
                                                <span>{domain}</span>
                                                <Button variant="ghost" size="icon" aria-label={`${t("Delete")}: ${domain}`} title={`${t("Delete")}: ${domain}`} className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => {
                                                    setWhitelist(whitelist.filter(d => d !== domain));
                                                    handleChange();
                                                }}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h4 className="text-sm font-medium">{t("Flagged sites")}</h4>
                            <p className="text-sm text-muted-foreground">{t("These domains receive a critical reputation score and are treated as high risk.")}</p>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                <Input 
                                    id="add-blacklist" 
                                    placeholder={t("e.g. badsite.com")} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim().toLowerCase();
                                            if (val && !isValidDomain(val)) {
                                                toast.add({ type: "error", title: t("Invalid domain"), description: t("Please enter a valid domain (e.g., example.com)"), priority: "high" });
                                            } else if (val && !blacklist.includes(val)) {
                                                setBlacklist([...blacklist, val]);
                                                handleChange();
                                            }
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <Button variant="outline" size="sm" onClick={() => {
                                    const input = document.getElementById('add-blacklist') as HTMLInputElement;
                                    const val = input.value.trim().toLowerCase();
                                    if (val && !isValidDomain(val)) {
                                        toast.add({ type: "error", title: t("Invalid domain"), description: t("Please enter a valid domain (e.g., example.com)"), priority: "high" });
                                    } else if (val && !blacklist.includes(val)) {
                                        setBlacklist([...blacklist, val]);
                                        handleChange();
                                    }
                                    input.value = '';
                                }}>{t("Add")}</Button>
                            </div>
                            <div className="rounded-md border max-h-40 overflow-y-auto">
                                {blacklist.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">{t("No flagged sites")}</div>
                                ) : (
                                    <ul className="divide-y">
                                        {blacklist.map(domain => (
                                            <li key={domain} className="flex items-center justify-between p-2 px-3 text-sm">
                                                <span>{domain}</span>
                                                <Button variant="ghost" size="icon" aria-label={`${t("Delete")}: ${domain}`} title={`${t("Delete")}: ${domain}`} className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => {
                                                    setBlacklist(blacklist.filter(d => d !== domain));
                                                    handleChange();
                                                }}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Data Tab */}
                <TabsContent value="data" className="min-w-0 w-full space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">{t("Data")}</h3>
                        <p className="text-sm text-muted-foreground">{t("Manage your data storage, exports, and deletions")}</p>
                    </div>
                    <Separator />
                    
                    <div className="space-y-4">
                        <SettingItem
                            label={t("Data Retention")}
                            description={t("Old activity logs will be automatically deleted after this period")}
                        >
                            <Select
                                value={String(logRetentionDays)}
                                onValueChange={(value) => {
                                    setLogRetentionDays(Number(value))
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {!RETENTION_OPTIONS.includes(logRetentionDays) && (
                                        <SelectItem value={String(logRetentionDays)}>{t("Custom")} ({logRetentionDays})</SelectItem>
                                    )}
                                    <SelectItem value="7">{t("7 days")}</SelectItem>
                                    <SelectItem value="14">{t("14 days")}</SelectItem>
                                    <SelectItem value="30">{t("30 days")}</SelectItem>
                                    <SelectItem value="60">{t("60 days")}</SelectItem>
                                    <SelectItem value="90">{t("90 days")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                        <SettingItem
                            label={t("Ratings Refresh")}
                            description={t("Refresh the privacy-ratings catalog on this schedule without revealing the sites you visit")}
                            note={databaseRefreshDays === 0 ? t("With this off, ratings only refresh when the extension updates") : undefined}
                        >
                            <Select value={String(databaseRefreshDays)} onValueChange={(value) => {
                                setDatabaseRefreshDays(Number(value) as 0 | 1 | 3 | 7 | 14 | 30)
                                handleChange()
                            }}>
                                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">{t("Off")}</SelectItem>
                                    <SelectItem value="1">{t("1 day")}</SelectItem>
                                    <SelectItem value="3">{t("3 days")}</SelectItem>
                                    <SelectItem value="7">{t("7 days")}</SelectItem>
                                    <SelectItem value="14">{t("14 days")}</SelectItem>
                                    <SelectItem value="30">{t("30 days")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                        <p className="text-sm text-muted-foreground break-words">
                            {t("The threat list updates automatically. This schedule only applies to the privacy-ratings catalog.")}
                        </p>

                        {/* Storage Usage */}
                        <div className="rounded-lg border p-4">
                            <div className={`flex flex-wrap items-center justify-between gap-y-2${storageInfo.quota > 0 ? " mb-4" : ""}`}>
                                <div className="space-y-0.5 min-w-0">
                                    <Label className="text-base font-medium">{t("Storage Used")}</Label>
                                </div>
                                <span className="text-sm text-muted-foreground shrink-0">
                                    {(storageInfo.bytesInUse / 1024 / 1024).toFixed(2)} {t("MB")}{storageInfo.quota > 0 ? ` ${t("of")} ${(storageInfo.quota / 1024 / 1024).toFixed(0)} ${t("MB")}` : ""}
                                </span>
                            </div>
                            {storageInfo.quota > 0 && <Progress value={storagePercentage} className="h-2" />}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border p-4">
                            <div className="min-w-0 flex-1 basis-[240px] space-y-0.5">
                                <Label className="text-base font-medium">{t("Export Data")}</Label>
                                <p className="text-sm text-muted-foreground break-words">{t("Save a JSON backup, with optional password encryption")}</p>
                             </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => setImportOpen(true)}>
                                     {t("Import")}
                                 </Button>
                                <Button variant="outline" onClick={exportData}>
                                    {t("Export to JSON")}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border p-4">
                            <div className="min-w-0 flex-1 basis-[240px] space-y-0.5">
                                <Label className="text-base font-medium">{t("Clear Data")}</Label>
                                <p className="text-sm text-muted-foreground break-words">{t("Clear activity logs or reset your privacy score and its history")}</p>
                             </div>
                            <div className="flex flex-wrap gap-2">
                                <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                        <Button variant="outline">
                                            {t("Clear Activity Logs")}
                                        </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                         <AlertDialogHeader>
                                             <AlertDialogTitle>{t("Clear Activity Logs?")}</AlertDialogTitle>
                                             <AlertDialogDescription>
                                                 {t("This will delete all of your recorded browsing activity logs. Your overall privacy score will remain intact.")}
                                             </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                             <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                                             <AlertDialogAction onClick={clearActivityLogs}>{t("Continue")}</AlertDialogAction>
                                         </AlertDialogFooter>
                                     </AlertDialogContent>
                                 </AlertDialog>
                                 <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                        <Button variant="outline">
                                            {t("Reset Privacy Score")}
                                        </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                         <AlertDialogHeader>
                                             <AlertDialogTitle>{t("Reset Privacy Score?")}</AlertDialogTitle>
                                             <AlertDialogDescription>
                                                 {t("This will reset your privacy score back to 100 and clear your historical score data. Activity logs will not be deleted.")}
                                             </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                             <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                                             <AlertDialogAction onClick={resetPrivacyScore}>{t("Continue")}</AlertDialogAction>
                                         </AlertDialogFooter>
                                     </AlertDialogContent>
                                 </AlertDialog>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border p-4">
                            <div className="min-w-0 flex-1 basis-[240px] space-y-0.5">
                                <Label className="text-base font-medium">{t("Reset to Defaults")}</Label>
                                <p className="text-sm text-muted-foreground break-words">{t("Restore default settings. Activity logs and site lists stay unchanged.")}</p>
                            </div>
                            <div className="flex justify-end">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline">
                                            {t("Reset to Defaults")}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("Reset settings to defaults?")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("This will restore all settings to their factory values. Your activity logs and site lists will not be deleted.")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                                            <AlertDialogAction onClick={resetSettings}>{t("Continue")}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-destructive/50 p-4">
                            <div className="min-w-0 flex-1 basis-[240px] space-y-0.5">
                                 <Label className="text-base font-medium text-destructive">{t("Danger Zone")}</Label>
                                 <p className="text-sm text-muted-foreground break-words">{t("Permanently remove all TraceGuard data from this browser")}</p>
                             </div>
                            <div className="flex justify-end">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">
                                            {t("Delete All Data")}
                                        </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                         <AlertDialogHeader>
                                             <AlertDialogTitle>{t("Are you absolutely sure?")}</AlertDialogTitle>
                                             <AlertDialogDescription>
                                                 {t("This removes all TraceGuard data stored in this browser, including activity, settings, and local vault data. It cannot be undone.")}
                                             </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                             <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                                             <AlertDialogAction onClick={clearAllData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("Delete Data")}</AlertDialogAction>
                                         </AlertDialogFooter>
                                     </AlertDialogContent>
                                 </AlertDialog>
                             </div>
                        </div>
                    </div>
                </TabsContent>

                {/* About Tab */}
                <TabsContent value="about" className="min-w-0 w-full space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">{t("About TraceGuard")}</h3>
                        <p className="text-sm text-muted-foreground">
                            {t("Version details and local diagnostics")}
                        </p>
                    </div>
                    <Separator />
                    <div className="rounded-lg border p-4 space-y-4">
                        <div className="grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                            <div>
                                <p className="text-muted-foreground text-xs">{t("Version")}</p>
                                <p className="font-mono font-medium">{manifestVersion}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">{t("Schema")}</p>
                                <p className="font-mono font-medium">v{schemaVersion}</p>
                            </div>
                        </div>
                        <Separator />
                        <p className="text-sm text-muted-foreground">
                            {t("TraceGuard stores site-analysis results, personal-info entry events, and privacy scores on this device. Local AI summaries send selected site and score details to Ollama on this device. When Local Policy Reports is enabled, viewing an unrated site in the popup or side panel starts a report automatically if no saved report exists and a capable Ollama model is loaded. TraceGuard first fetches up to four policy pages without cookies or site credentials; those hosts receive ordinary requests and can observe network metadata. If their static HTML cannot be read, it may briefly open one inactive tab as a fallback, using the browser's normal session and possibly sending applicable cookies or appearing in history. Policy text and its page address are sent only to Ollama on this device. Separately, the scheduled ToS;DR catalog refresh and signed threat-feed refresh download public data and do not include sites you visit. If Live Rating Lookup is on, TraceGuard sends a site's domain to ToS;DR when its local rating is missing or over a week old.")}
                        </p>
                    </div>

                    <section aria-labelledby="diagnostics-heading" className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
                        <div className="flex min-w-0 items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-1">
                                <h4 id="diagnostics-heading" className="text-base font-medium">
                                    {t("Diagnostics")}
                                </h4>
                                <p className="break-words text-sm text-muted-foreground">
                                    {t("Record local errors while you troubleshoot. The list clears when the browser restarts and is never sent anywhere.")}
                                </p>
                            </div>
                            <Switch
                                id="dev-mode"
                                aria-label={t("Diagnostics")}
                                className="mt-0.5"
                                checked={devMode}
                                onCheckedChange={(checked) => {
                                    // Apply immediately so the list starts filling
                                    // right away; persisted with the other settings.
                                    setDevModeLocal(checked)
                                    setDevMode(checked)
                                    handleChange()
                                    if (!checked) {
                                        // Turning diagnostics off discards the
                                        // errors rather than leaving a hidden log.
                                        void clearErrorLog().then(() => setErrorLog([]))
                                    }
                                }}
                            />
                        </div>
                        {devMode && (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium">{t("Recorded errors")}</p>
                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        {errorLog.length === 1 ? t("1 error") : t("{{count}} errors", { count: errorLog.length })}
                                    </span>
                                </div>
                                {errorLog.length === 0 ? (
                                    <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{t("No errors recorded.")}</p>
                                ) : (
                                    <div role="region" aria-label={t("Recorded errors")} className="max-h-64 divide-y overflow-y-auto rounded-md border">
                                        {[...errorLog].reverse().map((entry, i) => (
                                            <div key={i} className="space-y-1 p-3 text-xs">
                                                <time dateTime={new Date(entry.timestamp).toISOString()} className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</time>
                                                <p className="break-all font-medium">{entry.message}</p>
                                                {entry.context && <p className="break-all text-muted-foreground">{entry.context}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
            </Dialog>

            <ExportDataDialog open={exportOpen} onOpenChange={setExportOpen} />
            <ImportDataDialog open={importOpen} onOpenChange={setImportOpen} />

            {/* Discard-unsaved-changes confirmation */}
            <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Discard unsaved changes?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("Your unsaved settings changes will be lost if you close.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Keep editing")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                // Restore the stored values as well as closing:
                                // the component stays mounted, so leaving the
                                // draft in place would show discarded edits the
                                // next time the modal opens.
                                setDiscardOpen(false)
                                revertChanges()
                                setSettingsOpen(false)
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t("Discard changes")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
