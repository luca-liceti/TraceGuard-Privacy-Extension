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
import { useAppState, useSettings } from "@/lib/useStorage"
import { toast } from 'sonner'
import {
    Bell,
    Database,
    Shield,
    Save,
    RotateCcw,
    Trash2,
    AlertTriangle,
    Palette,
    HardDrive,
    Info,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTheme } from "@/components/theme-provider"

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
        <div className="flex items-center justify-between py-4">
            <div className="space-y-0.5 flex-1 mr-4">
                <Label className="text-sm font-medium">{label}</Label>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
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
        <div className="py-4">
            <div className="flex items-center justify-between mb-3">
                <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
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
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{min} {unit}</span>
                <span>{max} {unit}</span>
            </div>
        </div>
    )
}

export default function SettingsPage() {
    const state = useAppState()
    const settings = useSettings()
    const { setTheme: applyTheme } = useTheme()

    const [hasChanges, setHasChanges] = useState(false)
    const [storageInfo, setStorageInfo] = useState({ bytesInUse: 0, quota: 0 })
    const [manifestVersion, setManifestVersion] = useState("1.0.0")
    const [schemaVersion, setSchemaVersion] = useState(1)
    const [activeTab, setActiveTab] = useState("appearance")

    // Local state for settings
    const [themeLocal, setThemeLocal] = useState(settings?.theme || "system")
    const [notificationLevel, setNotificationLevel] = useState(settings?.notificationLevel || "balanced")
    const [dataRetention, setDataRetention] = useState(settings?.dataRetention || 30)
    const [wssThreshold, setWssThreshold] = useState(settings?.wssThreshold || 50)
    const [enablePIIDetection, setEnablePIIDetection] = useState(settings?.enablePIIDetection ?? true)
    const [enableTrackerBlocking, setEnableTrackerBlocking] = useState(settings?.enableTrackerBlocking ?? false)
    const [displayMode, setDisplayMode] = useState(settings?.displayMode || "popup")

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
            setEnableTrackerBlocking(settings.enableTrackerBlocking ?? false)
            setDisplayMode(settings.displayMode || "popup")
        }
    }, [settings])

    if (!state || !settings) return <div className="p-4">Loading...</div>

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
            enableTrackerBlocking,
            displayMode,
        }

        await chrome.storage.local.set({ settings: updatedSettings })
        applyTheme(themeLocal)

        chrome.runtime.sendMessage({
            type: 'SETTINGS_CHANGED',
            settings: updatedSettings
        })

        setHasChanges(false)
        toast.success('Settings Saved', {
            description: 'Your preferences have been updated successfully.',
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
            enableTrackerBlocking: false,
            displayMode: "popup" as const,
        }

        // Apply defaults to local state
        setThemeLocal(defaultPreferences.theme)
        applyTheme(defaultPreferences.theme)
        setNotificationLevel(defaultPreferences.notificationLevel)
        setDataRetention(defaultPreferences.dataRetention)
        setWssThreshold(defaultPreferences.wssThreshold)
        setEnablePIIDetection(defaultPreferences.enablePIIDetection)
        setEnableTrackerBlocking(defaultPreferences.enableTrackerBlocking)
        setDisplayMode(defaultPreferences.displayMode)

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
        toast.info('Settings Reset', {
            description: 'Preferences restored to default values.',
            duration: 3000
        })
    }

    const clearActivityLogs = async () => {
        if (!confirm("Clear all activity logs? This cannot be undone.")) return

        await chrome.storage.local.set({
            logs: [],
            piiDetections: [],
            detectorLogs: []
        })
        toast.success('Activity Logs Cleared', {
            description: 'All logged events have been removed.',
            duration: 3000
        })
    }

    const resetPrivacyScore = async () => {
        if (!confirm("Reset your Privacy Score to 100? This will clear your browsing history data.")) return

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
        toast.success('Privacy Score Reset', {
            description: 'Your UPS has been reset to 100.',
            duration: 3000
        })
    }

    const clearAllData = async () => {
        if (!confirm("⚠️ WARNING: This will delete ALL extension data including settings, logs, and scores. This cannot be undone. Are you sure?")) return
        if (!confirm("Are you absolutely sure? This will reset TraceGuard to factory defaults.")) return

        await chrome.storage.local.clear()
        toast.success('All Data Cleared', {
            description: 'Extension data has been reset. Reloading...',
            duration: 2000
        })
        setTimeout(() => window.location.reload(), 2000)
    }

    const storagePercentage = (storageInfo.bytesInUse / storageInfo.quota) * 100

    return (
        <div className="space-y-6 w-full max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Configure TraceGuard preferences and manage your data
                </p>
            </div>

            {/* Save Changes Bar - At Top */}
            {hasChanges && (
                <Card className="border-primary/50 bg-background/95 backdrop-blur shadow-lg">
                    <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                                <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                                <span className="text-muted-foreground">You have unsaved changes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetSettings}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={saveSettings}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Horizontal Tab Menu */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger
                        value="appearance"
                        className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Palette className="h-4 w-4" />
                        Appearance
                    </TabsTrigger>
                    <TabsTrigger
                        value="privacy"
                        className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Shield className="h-4 w-4" />
                        Privacy
                    </TabsTrigger>
                    <TabsTrigger
                        value="notifications"
                        className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Bell className="h-4 w-4" />
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger
                        value="data"
                        className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Database className="h-4 w-4" />
                        Data
                    </TabsTrigger>
                    <TabsTrigger
                        value="about"
                        className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        <Info className="h-4 w-4" />
                        About
                    </TabsTrigger>
                </TabsList>

                {/* Appearance Tab */}
                <TabsContent value="appearance" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">
                                Appearance Settings
                            </CardTitle>
                            <CardDescription>
                                Customize how TraceGuard looks and opens
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <SettingItem
                                label="Theme"
                                description="Choose between light, dark, or system theme"
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
                                        <SelectItem value="system">System</SelectItem>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingItem>

                            <Separator />

                            <SettingItem
                                label="Display Mode"
                                description="How TraceGuard opens when you click the extension icon"
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
                                        <SelectItem value="popup">Popup</SelectItem>
                                        <SelectItem value="sidebar">Side Panel</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingItem>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Privacy Tab */}
                <TabsContent value="privacy" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">
                                Privacy Protection
                            </CardTitle>
                            <CardDescription>
                                Configure privacy detection features and alerts
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <SettingItem
                                label="PII Detection"
                                description="Monitor when you enter personal information on websites"
                            >
                                <Switch
                                    checked={enablePIIDetection}
                                    onCheckedChange={(checked) => {
                                        setEnablePIIDetection(checked)
                                        handleChange()
                                    }}
                                />
                            </SettingItem>

                            <Separator />

                            <SettingItem
                                label="Tracker Blocking"
                                description="Automatically block known tracking scripts"
                            >
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        Coming Soon
                                    </Badge>
                                    <Switch
                                        checked={enableTrackerBlocking}
                                        disabled={true}
                                    />
                                </div>
                            </SettingItem>

                            <Separator />

                            <SettingSlider
                                label="Safety Threshold"
                                description="Get alerts when a site's safety score is below this value"
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
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">
                                Notification Settings
                            </CardTitle>
                            <CardDescription>
                                Control when and how you receive security alerts
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SettingItem
                                label="Alert Level"
                                description={
                                    notificationLevel === "silent"
                                        ? "You won't receive any notifications"
                                        : notificationLevel === "balanced"
                                            ? "Notified for high-risk sites and critical PII events"
                                            : "Notified for all site changes and tracker detections"
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
                                        <SelectItem value="silent">Silent</SelectItem>
                                        <SelectItem value="balanced">Balanced</SelectItem>
                                        <SelectItem value="aggressive">Aggressive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingItem>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Data Tab */}
                <TabsContent value="data" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">
                                Data Management
                            </CardTitle>
                            <CardDescription>
                                Manage how long your data is stored
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <SettingSlider
                                label="Data Retention"
                                description="Old activity logs will be automatically deleted after this period"
                                value={dataRetention}
                                min={7}
                                max={90}
                                step={1}
                                unit="days"
                                onChange={(value) => {
                                    setDataRetention(value)
                                    handleChange()
                                }}
                            />

                            <Separator />

                            {/* Storage Usage */}
                            <div className="py-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                                        <Label className="text-sm font-medium">Storage Used</Label>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {(storageInfo.bytesInUse / 1024).toFixed(1)} KB of {(storageInfo.quota / 1024 / 1024).toFixed(0)} MB
                                    </span>
                                </div>
                                <Progress value={storagePercentage} className="h-2" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Clear Data Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">
                                Clear Data
                            </CardTitle>
                            <CardDescription>
                                Remove specific data from the extension
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    variant="outline"
                                    onClick={clearActivityLogs}
                                    className="flex-1 justify-start"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear Activity Logs
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={resetPrivacyScore}
                                    className="flex-1 justify-start"
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reset Privacy Score
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    <Card className="border-destructive/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>
                                Irreversible actions that will delete your data
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                onClick={clearAllData}
                                className="w-full sm:w-auto border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete All Data & Reset Extension
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* About Tab */}
                <TabsContent value="about" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">
                                About TraceGuard
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs">Version</p>
                                    <p className="font-mono font-medium">{manifestVersion}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Schema</p>
                                    <p className="font-mono font-medium">v{schemaVersion}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Storage</p>
                                    <p className="font-mono font-medium">{(storageInfo.bytesInUse / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <Separator className="my-4" />
                            <p className="text-sm text-muted-foreground">
                                TraceGuard is a privacy-first extension designed to protect your data while you browse.
                                It runs entirely on your device and does not send data to external servers.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
