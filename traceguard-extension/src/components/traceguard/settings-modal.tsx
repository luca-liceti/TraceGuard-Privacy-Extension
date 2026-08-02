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
 *    - PII Detection: Toggle personal info monitoring
 *    - Tracker Blocking: Future feature (coming soon)
 *    - Safety Threshold: Alert level for risky sites (0-100)
 * 
 * 3. NOTIFICATIONS TAB
 *    - Alert Level: Silent/Balanced/Aggressive notification modes
 * 
 * 4. DATA TAB
 *    - Data Retention: How long to keep logs (7-90 days)
 *    - Storage Usage: Visual display of storage used
 *    - Clear Actions: Delete activity logs, reset score
 *    - Danger Zone: Factory reset option
 * 
 * 5. ABOUT TAB
 *    - Version info and extension description
 * 
 * FEATURES:
 *    - Changes are tracked and require manual save
 *    - Reset to defaults option
 *    - Storage usage monitoring
 *    - Danger zone with confirmation dialogs
 * =============================================================================
 */

"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAppState, useSettings } from "@/lib/useStorage"
import { toast } from 'sonner'
import {
    Bell,
    Database,
    Save,
    RotateCcw,
    Trash2,
    AlertTriangle,
    Palette,
    HardDrive,
    Info,
    Download,
    List,
    Shield,
    ShieldAlert
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/components/theme-provider"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useSettingsModal } from "./settings-context"


// Setting item component for consistent styling
function SettingItem({
    label,
    description,
    children
}: {
    label: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 flex-1 mr-4">
                <Label className="text-base font-medium">{label}</Label>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex-shrink-0">
                {children}
            </div>
        </div>
    )
}

// Slider component for consistency
function SettingSlider({
    label,
    description,
    value,
    min,
    max,
    step,
    unit,
    onChange,
}: {
    label: string
    description: string
    value: number
    min: number
    max: number
    step: number
    unit: string
    onChange: (value: number) => void
}) {
    return (
        <div className="rounded-lg border p-4">
            <div className="flex flex-row items-center justify-between mb-4">
                <div className="space-y-0.5">
                    <Label className="text-base font-medium">{label}</Label>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Badge variant="secondary" className="font-mono">
                    {value} {unit}
                </Badge>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{min} {unit}</span>
                <span>{max} {unit}</span>
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
    const [storageInfo, setStorageInfo] = useState({ bytesInUse: 0, quota: 0 })
    const [manifestVersion, setManifestVersion] = useState("1.0.0")
    const [schemaVersion, setSchemaVersion] = useState(1)

    // Local state for settings
    const [themeLocal, setThemeLocal] = useState(settings?.theme || "system")
    const [notificationLevel, setNotificationLevel] = useState(settings?.notificationLevel || "balanced")
    const [dataRetention, setDataRetention] = useState(settings?.dataRetention || 30)
    const [wssThreshold, setWssThreshold] = useState(settings?.wssThreshold || 50)
    const [enablePIIDetection, setEnablePIIDetection] = useState(settings?.enablePIIDetection ?? true)
    const [displayMode, setDisplayMode] = useState(settings?.displayMode || "popup")
    const [autoLockTimeout, setAutoLockTimeout] = useState(settings?.autoLockTimeout ?? -1)
    const [whitelist, setWhitelist] = useState<string[]>(settings?.whitelist || [])
    const [blacklist, setBlacklist] = useState<string[]>(settings?.blacklist || [])

    // Fetch manifest version
    useEffect(() => {
        const manifest = chrome.runtime.getManifest()
        setManifestVersion(manifest.version)
    }, [])

    // Fetch schema version from storage
    useEffect(() => {
        chrome.storage.local.get('schemaVersion').then((result) => {
            setSchemaVersion(result.schemaVersion || 1)
        })
    }, [])

    // Fetch storage usage
    useEffect(() => {
        const updateStorageInfo = async () => {
            const bytesInUse = await chrome.storage.local.getBytesInUse()
            const quota = chrome.storage.local.QUOTA_BYTES || 5242880
            setStorageInfo({ bytesInUse, quota })
        }

        updateStorageInfo()
        const interval = setInterval(updateStorageInfo, 5000)
        return () => clearInterval(interval)
    }, [])

    // Sync local state with stored settings when they load
    useEffect(() => {
        if (settings) {
            setThemeLocal(settings.theme || "system")
            setNotificationLevel(settings.notificationLevel || "balanced")
            setDataRetention(settings.dataRetention || 30)
            setWssThreshold(settings.wssThreshold || 50)
            setEnablePIIDetection(settings.enablePIIDetection ?? true)
            setDisplayMode(settings.displayMode || "popup")
            setAutoLockTimeout(settings.autoLockTimeout ?? -1)
            setWhitelist(settings.whitelist || [])
            setBlacklist(settings.blacklist || [])
        }
    }, [settings])

    if (!state || !settings) return <div className="p-4">{t("Loading...")}</div>

    const handleChange = () => {
        setHasChanges(true)
    }

    const saveSettings = async () => {
        const updatedSettings = {
            ...settings,
            theme: themeLocal,
            notificationLevel,
            dataRetention,
            wssThreshold,
            enablePIIDetection,
            displayMode,
            autoLockTimeout,
            whitelist,
            blacklist,
        }

        await chrome.storage.local.set({ settings: updatedSettings })
        applyTheme(themeLocal)

        chrome.runtime.sendMessage({
            type: 'SETTINGS_CHANGED',
            settings: updatedSettings
        })

        setHasChanges(false)
        toast.success(t('Settings Saved'), {
            description: t('Your preferences have been updated successfully.'),
            duration: 3000
        })
    }

    const resetSettings = async () => {
        const defaultPreferences = {
            theme: "system" as const,
            notificationLevel: "balanced" as const,
            dataRetention: 30,
            wssThreshold: 50,
            enablePIIDetection: true,
            displayMode: "popup" as const,
            autoLockTimeout: -1,
        }

        // Apply defaults to local state
        setThemeLocal(defaultPreferences.theme)
        applyTheme(defaultPreferences.theme)
        setNotificationLevel(defaultPreferences.notificationLevel)
        setDataRetention(defaultPreferences.dataRetention)
        setWssThreshold(defaultPreferences.wssThreshold)
        setEnablePIIDetection(defaultPreferences.enablePIIDetection)
        setDisplayMode(defaultPreferences.displayMode)
        setAutoLockTimeout(defaultPreferences.autoLockTimeout)

        // Merge defaults with existing settings to preserve other data (whitelist, blacklist, etc.)
        const newSettings = {
            ...settings,
            ...defaultPreferences
        }

        await chrome.storage.local.set({ settings: newSettings })

        chrome.runtime.sendMessage({
            type: 'SETTINGS_CHANGED',
            settings: newSettings
        })

        setHasChanges(false)
        toast.info(t('Settings Reset'), {
            description: t('Preferences restored to default values.'),
            duration: 3000
        })
    }

    const clearActivityLogs = async () => {
        if (!confirm(t("Clear all activity logs? This cannot be undone."))) return

        await chrome.storage.local.set({
            logs: [],
            piiDetections: [],
            detectorLogs: []
        })
        toast.success(t('Activity Logs Cleared'), {
            description: t('All logged events have been removed.'),
            duration: 3000
        })
    }

    const resetPrivacyScore = async () => {
        if (!confirm(t("Reset your Privacy Score to 100? This will clear your browsing history data."))) return

        await chrome.storage.local.set({
            state: {
                ...state,
                ups: 100,
                sitesAnalyzed: 0,
                trackersBlocked: 0,
                piiEventsCount: 0
            },
            scoreHistory: [],
            siteCache: {}
        })
        toast.success(t('Privacy Score Reset'), {
            description: t('Your UPS has been reset to 100.'),
            duration: 3000
        })
    }

    const clearAllData = async () => {
        if (!confirm(t("⚠️ WARNING: This will delete ALL extension data including settings, logs, and scores. This cannot be undone. Are you sure?"))) return
        if (!confirm(t("Are you absolutely sure? This will reset TraceGuard to factory defaults."))) return

        await chrome.storage.local.clear()
        toast.success(t('All Data Cleared'), {
            description: t('Extension data has been reset. Reloading...'),
            duration: 2000
        })
        setTimeout(() => window.location.reload(), 2000)
    }


    const exportData = async () => {
        try {
            const allData = await chrome.storage.local.get(null);
            const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `traceguard-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(t('Data Exported'), {
                description: t('Your activity logs and settings have been exported.'),
                duration: 3000
            });
        } catch (error) {
            toast.error(t('Export Failed'), {
                description: t('Could not export data. Please try again.')
            });
        }
    }

    const storagePercentage = (storageInfo.bytesInUse / storageInfo.quota) * 100

    return (
        <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0 bg-background border shadow-2xl sm:rounded-xl h-[600px] flex flex-col">
                <DialogTitle className="sr-only">{t("Settings")}</DialogTitle>
                <DialogDescription className="sr-only">{t("Configure TraceGuard preferences")}</DialogDescription>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 h-[600px] w-full">
                    {/* Sidebar Navigation */}
                    <div className="w-[240px] flex flex-col border-r bg-muted/10 h-full">
                        <div className="p-4 py-6">
                            <h2 className="text-xl font-bold tracking-tight">{t("Settings")}</h2>
                        </div>
                        <TabsList className="flex flex-col h-full w-full justify-start items-stretch space-y-1 bg-transparent p-3 pt-0">
                            <TabsTrigger value="appearance" className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                <Palette className="h-4 w-4" />
                                {t("Appearance")}
                            </TabsTrigger>
                            <TabsTrigger value="privacy" className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                <Shield className="h-4 w-4" />
                                {t("Privacy")}
                            </TabsTrigger>
                            <TabsTrigger value="notifications" className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                <Bell className="h-4 w-4" />
                                {t("Notifications")}
                            </TabsTrigger>
                            <TabsTrigger value="domain-lists" className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                <ShieldAlert className="h-4 w-4" />
                                {t("Allow/Block")}
                            </TabsTrigger>
                            <TabsTrigger value="data" className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                <Database className="h-4 w-4" />
                                {t("Data")}
                            </TabsTrigger>
                            <TabsTrigger value="about" className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted">
                                <Info className="h-4 w-4" />
                                {t("About")}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col relative h-full">
                        <div className="flex-1 overflow-y-auto p-6 scroll-smooth space-y-6">
                            {/* Save Changes Bar - At Top */}
                            {hasChanges && (
                                <div className="border-b border-primary/50 bg-background/95 backdrop-blur sticky top-0 z-10">
                                    <div className="py-3 px-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm">
                                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                <span className="text-muted-foreground">{t("You have unsaved changes")}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" onClick={resetSettings}>
                                                    <RotateCcw className="mr-2 h-4 w-4" />
                                                    {t("Reset")}
                                                </Button>
                                                <Button size="sm" onClick={saveSettings}>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    {t("Save Changes")}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                {/* Appearance Tab */}
                <TabsContent value="appearance" className="space-y-6 mt-0">
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
                                <SelectTrigger className="w-[150px]">
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
                                <SelectTrigger className="w-[150px]">
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
                <TabsContent value="privacy" className="space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">
                            {t("Privacy")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("Configure privacy detection features and alerts")}
                        </p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <SettingItem
                            label={t("PII Detection")}
                            description={t("Monitor when you enter personal information on websites")}
                        >
                            <Switch
                                checked={enablePIIDetection}
                                onCheckedChange={(checked) => {
                                    setEnablePIIDetection(checked)
                                    handleChange()
                                }}
                            />
                        </SettingItem>

                        <SettingItem
                            label={t("Vault Auto-Lock")}
                            description={t("When should your privacy vault automatically lock?")}
                        >
                            <Select
                                value={autoLockTimeout.toString()}
                                onValueChange={(value) => {
                                    setAutoLockTimeout(Number(value))
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="-1">{t("On Browser Close")}</SelectItem>
                                    <SelectItem value="1">{t("After 1 Minute")}</SelectItem>
                                    <SelectItem value="5">{t("After 5 Minutes")}</SelectItem>
                                    <SelectItem value="15">{t("After 15 Minutes")}</SelectItem>
                                    <SelectItem value="0">{t("Never")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>

                        <SettingSlider
                            label={t("Safety Threshold")}
                            description={t("Get alerts when a site's safety score is below this value")}
                            value={wssThreshold}
                            min={0}
                            max={100}
                            step={5}
                            unit=""
                            onChange={(value) => {
                                setWssThreshold(value)
                                handleChange()
                            }}
                        />
                    </div>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">
                            {t("Notifications")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("Control when and how you receive security alerts")}
                        </p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <SettingItem
                            label={t("Alert Level")}
                            description={
                                notificationLevel === "silent"
                                    ? t("You won't receive any notifications")
                                    : notificationLevel === "balanced"
                                        ? t("Notified for high-risk sites and critical PII events")
                                        : t("Notified for all site changes and tracker detections")
                            }
                        >
                            <Select
                                value={notificationLevel}
                                onValueChange={(value) => {
                                    setNotificationLevel(value as 'silent' | 'balanced' | 'aggressive')
                                    handleChange()
                                }}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="silent">{t("Silent")}</SelectItem>
                                    <SelectItem value="balanced">{t("Balanced")}</SelectItem>
                                    <SelectItem value="aggressive">{t("Aggressive")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingItem>
                    </div>
                </TabsContent>

                {/* Domain Lists Tab */}
                <TabsContent value="domain-lists" className="space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">{t("Allow/Block Sites")}</h3>
                        <p className="text-sm text-muted-foreground">{t("Manage explicit exceptions for website tracking and safety")}</p>
                    </div>
                    <Separator />
                    
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium">{t("Allowed Sites (Whitelist)")}</h4>
                            <p className="text-sm text-muted-foreground">{t("These sites will never trigger privacy alerts or be blocked.")}</p>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                <Input 
                                    id="add-whitelist" 
                                    placeholder="e.g. example.com" 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim();
                                            if (val && !whitelist.includes(val)) {
                                                setWhitelist([...whitelist, val]);
                                                handleChange();
                                            }
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <Button size="sm" onClick={() => {
                                    const input = document.getElementById('add-whitelist') as HTMLInputElement;
                                    const val = input.value.trim();
                                    if (val && !whitelist.includes(val)) {
                                        setWhitelist([...whitelist, val]);
                                        handleChange();
                                    }
                                    input.value = '';
                                }}>{t("Add")}</Button>
                            </div>
                            <div className="rounded-md border max-h-[150px] overflow-y-auto">
                                {whitelist.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">{t("No allowed sites")}</div>
                                ) : (
                                    <ul className="divide-y">
                                        {whitelist.map(domain => (
                                            <li key={domain} className="flex items-center justify-between p-2 px-3 text-sm">
                                                <span>{domain}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => {
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
                            <h4 className="text-sm font-medium">{t("Blocked Sites (Blacklist)")}</h4>
                            <p className="text-sm text-muted-foreground">{t("These sites will always trigger high-risk alerts.")}</p>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                <Input 
                                    id="add-blacklist" 
                                    placeholder="e.g. badsite.com" 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim();
                                            if (val && !blacklist.includes(val)) {
                                                setBlacklist([...blacklist, val]);
                                                handleChange();
                                            }
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <Button size="sm" onClick={() => {
                                    const input = document.getElementById('add-blacklist') as HTMLInputElement;
                                    const val = input.value.trim();
                                    if (val && !blacklist.includes(val)) {
                                        setBlacklist([...blacklist, val]);
                                        handleChange();
                                    }
                                    input.value = '';
                                }}>{t("Add")}</Button>
                            </div>
                            <div className="rounded-md border max-h-[150px] overflow-y-auto">
                                {blacklist.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">{t("No blocked sites")}</div>
                                ) : (
                                    <ul className="divide-y">
                                        {blacklist.map(domain => (
                                            <li key={domain} className="flex items-center justify-between p-2 px-3 text-sm">
                                                <span>{domain}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => {
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
                <TabsContent value="data" className="space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">{t("Data")}</h3>
                        <p className="text-sm text-muted-foreground">{t("Manage your data storage, exports, and deletions")}</p>
                    </div>
                    <Separator />
                    
                    <div className="space-y-4">
                        <SettingSlider
                            label={t("Data Retention")}
                            description={t("Old activity logs will be automatically deleted after this period")}
                            value={dataRetention}
                            min={7}
                            max={90}
                            step={1}
                            unit={t("days")}
                            onChange={(value) => {
                                setDataRetention(value)
                                handleChange()
                            }}
                        />

                        {/* Storage Usage */}
                        <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-medium flex items-center gap-2">
                                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                                        {t("Storage Used")}
                                    </Label>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {(storageInfo.bytesInUse / 1024).toFixed(1)} KB of {(storageInfo.quota / 1024 / 1024).toFixed(0)} MB
                                </span>
                            </div>
                            <Progress value={storagePercentage} className="h-2" />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                             <div className="space-y-0.5 flex-1 mr-4">
                                 <Label className="text-base font-medium">{t("Export Data")}</Label>
                                 <p className="text-sm text-muted-foreground">{t("Download a copy of your activity logs and settings")}</p>
                             </div>
                             <div className="flex-shrink-0">
                                 <Button variant="outline" onClick={exportData}>
                                     <Download className="mr-2 h-4 w-4" />
                                     {t("Export to JSON")}
                                 </Button>
                             </div>
                        </div>

                        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                             <div className="space-y-0.5 flex-1 mr-4">
                                 <Label className="text-base font-medium">{t("Clear Data")}</Label>
                                 <p className="text-sm text-muted-foreground">{t("Remove specific data from the extension")}</p>
                             </div>
                             <div className="flex-shrink-0 flex gap-2">
                                 <Button variant="outline" onClick={clearActivityLogs}>
                                     <Trash2 className="mr-2 h-4 w-4" />
                                     {t("Clear Activity Logs")}
                                 </Button>
                                 <Button variant="outline" onClick={resetPrivacyScore}>
                                     <RotateCcw className="mr-2 h-4 w-4" />
                                     {t("Reset Privacy Score")}
                                 </Button>
                             </div>
                        </div>

                        <div className="flex flex-row items-center justify-between rounded-lg border border-destructive/50 p-4">
                             <div className="space-y-0.5 flex-1 mr-4">
                                 <Label className="text-base font-medium text-destructive flex items-center gap-2">
                                     <AlertTriangle className="h-4 w-4" />
                                     {t("Danger Zone")}
                                 </Label>
                                 <p className="text-sm text-muted-foreground">{t("Irreversible actions that will delete your data")}</p>
                             </div>
                             <div className="flex-shrink-0">
                                 <Button variant="destructive" onClick={clearAllData}>
                                     <Trash2 className="mr-2 h-4 w-4" />
                                     {t("Delete All Data")}
                                 </Button>
                             </div>
                        </div>
                    </div>
                </TabsContent>

                {/* About Tab */}
                <TabsContent value="about" className="space-y-6 mt-0">
                    <div>
                        <h3 className="text-lg font-medium">{t("About TraceGuard")}</h3>
                        <p className="text-sm text-muted-foreground">{t("Information about TraceGuard Privacy Extension")}</p>
                    </div>
                    <Separator />
                    <div className="rounded-lg border p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
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
                            {t("TraceGuard is a privacy-first extension designed to protect your data while you browse. It runs entirely on your device and does not send data to external servers.")}
                        </p>
                    </div>
                </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
