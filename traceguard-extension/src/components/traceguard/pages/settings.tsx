"use client"

import React, { useState, useEffect } from "react"
import { useAppState, useSettings } from "@/lib/useStorage"
import { toast } from 'sonner'
import { Bell, Database, Shield, Save, RotateCcw, Trash2, AlertTriangle, Monitor, Rocket, Palette, Menu, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

type SettingsSection =
    | 'display'
    | 'appearance'
    | 'notifications'
    | 'privacy'
    | 'data-retention'
    | 'clear-data'
    | 'about'

const menuItems: { id: SettingsSection; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'display', label: 'Display Mode', icon: Monitor, description: 'Popup or sidebar' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme settings' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences' },
    { id: 'privacy', label: 'Privacy Protection', icon: Shield, description: 'Detection & blocking' },
    { id: 'data-retention', label: 'Data Retention', icon: Database, description: 'Storage settings' },
    { id: 'clear-data', label: 'Clear Data', icon: Trash2, description: 'Manage data' },
    { id: 'about', label: 'About', icon: Rocket, description: 'Extension info' },
]

export default function SettingsPage() {
    const state = useAppState()
    const settings = useSettings()
    const { setTheme: applyTheme } = useTheme()
    const [hasChanges, setHasChanges] = useState(false)
    const [storageInfo, setStorageInfo] = useState({ bytesInUse: 0, quota: 0 })
    const [manifestVersion, setManifestVersion] = useState("1.0.0")
    const [schemaVersion, setSchemaVersion] = useState(1)
    const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
        // Persist active section across re-renders
        const saved = sessionStorage.getItem('traceguard-settings-active-section')
        return (saved as SettingsSection) || 'display'
    })
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Persist active section to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('traceguard-settings-active-section', activeSection)
    }, [activeSection])

    // Local state for settings
    const [themeLocal, setThemeLocal] = useState(settings?.theme || "system")
    const [notificationLevel, setNotificationLevel] = useState(settings?.notificationLevel || "balanced")
    const [dataRetention, setDataRetention] = useState(settings?.dataRetention || 30)
    const [wrsThreshold, setWrsThreshold] = useState(settings?.wrsThreshold || 50)
    const [enablePIIDetection, setEnablePIIDetection] = useState(settings?.enablePIIDetection ?? true)
    const [enableTrackerBlocking, setEnableTrackerBlocking] = useState(settings?.enableTrackerBlocking ?? false)
    const [displayMode, setDisplayMode] = useState(settings?.displayMode || "sidebar")

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
            setWrsThreshold(settings.wrsThreshold || 50)
            setEnablePIIDetection(settings.enablePIIDetection ?? true)
            setEnableTrackerBlocking(settings.enableTrackerBlocking ?? false)
            setDisplayMode(settings.displayMode || "sidebar")
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
            wrsThreshold,
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
        const defaultSettings = {
            theme: "system" as const,
            notificationLevel: "balanced" as const,
            dataRetention: 30,
            wrsThreshold: 50,
            enablePIIDetection: true,
            enableTrackerBlocking: false,
            displayMode: "sidebar" as const,
        }

        setThemeLocal(defaultSettings.theme)
        applyTheme(defaultSettings.theme)
        setNotificationLevel(defaultSettings.notificationLevel)
        setDataRetention(defaultSettings.dataRetention)
        setWrsThreshold(defaultSettings.wrsThreshold)
        setEnablePIIDetection(defaultSettings.enablePIIDetection)
        setEnableTrackerBlocking(defaultSettings.enableTrackerBlocking)
        setDisplayMode(defaultSettings.displayMode)

        await chrome.storage.local.set({ settings: defaultSettings })

        chrome.runtime.sendMessage({
            type: 'SETTINGS_CHANGED',
            settings: defaultSettings
        })

        setHasChanges(false)
        toast.info('Settings Reset', {
            description: 'All settings have been restored to default values.',
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

    const handleMenuItemClick = (sectionId: SettingsSection) => {
        setActiveSection(sectionId)
        setIsMobileMenuOpen(false)
    }

    const renderContent = () => {
        switch (activeSection) {
            case 'display':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Monitor className="h-5 w-5" />
                                Display Mode
                            </CardTitle>
                            <CardDescription>
                                Choose how TraceGuard opens when you click the extension icon
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="display-mode">Extension Display</Label>
                                <Select
                                    value={displayMode}
                                    onValueChange={(value) => {
                                        setDisplayMode(value as 'popup' | 'sidebar')
                                        handleChange()
                                        toast.info('Display Mode Changed', {
                                            description: `Extension will now open in ${value === 'popup' ? 'popup window' : 'sidebar'} mode.`,
                                            duration: 2500
                                        })
                                    }}
                                >
                                    <SelectTrigger id="display-mode">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="popup">Popup - Opens in a small window</SelectItem>
                                        <SelectItem value="sidebar">Sidebar - Opens in the browser sidebar</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    {displayMode === "popup" && "The extension will open as a popup window when you click the icon"}
                                    {displayMode === "sidebar" && "The extension will open in the browser's sidebar for a persistent view"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'appearance':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Palette className="h-5 w-5" />
                                Appearance
                            </CardTitle>
                            <CardDescription>
                                Choose your preferred color theme
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="theme">Theme</Label>
                                <Select
                                    value={themeLocal}
                                    onValueChange={(value) => {
                                        setThemeLocal(value as 'light' | 'dark' | 'system')
                                        handleChange()
                                        const themeLabels = { system: 'Device', light: 'Light', dark: 'Dark' }
                                        toast.info('Theme Changed', {
                                            description: `Theme set to ${themeLabels[value as keyof typeof themeLabels]} mode.`,
                                            duration: 2500
                                        })
                                    }}
                                >
                                    <SelectTrigger id="theme">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="system">Device - Follow system theme</SelectItem>
                                        <SelectItem value="light">Light - Always use light mode</SelectItem>
                                        <SelectItem value="dark">Dark - Always use dark mode</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    {themeLocal === "system" && "The extension will automatically match your device's theme"}
                                    {themeLocal === "light" && "The extension will always use light mode"}
                                    {themeLocal === "dark" && "The extension will always use dark mode"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'notifications':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Bell className="h-5 w-5" />
                                Notifications
                            </CardTitle>
                            <CardDescription>
                                Control when and how you receive alerts
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="notification-level">Notification Level</Label>
                                <Select
                                    value={notificationLevel}
                                    onValueChange={(value) => {
                                        setNotificationLevel(value as 'silent' | 'balanced' | 'aggressive')
                                        handleChange()
                                        const levelLabels = { silent: 'Silent', balanced: 'Balanced', aggressive: 'Aggressive' }
                                        toast.info('Notification Level Changed', {
                                            description: `Notifications set to ${levelLabels[value as keyof typeof levelLabels]} mode.`,
                                            duration: 2500
                                        })
                                    }}
                                >
                                    <SelectTrigger id="notification-level">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="silent">Silent - No notifications</SelectItem>
                                        <SelectItem value="balanced">Balanced - Important alerts only</SelectItem>
                                        <SelectItem value="aggressive">Aggressive - All security events</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    {notificationLevel === "silent" && "You won't receive any notifications"}
                                    {notificationLevel === "balanced" && "You'll be notified of high-risk sites and critical PII events"}
                                    {notificationLevel === "aggressive" && "You'll be notified of all privacy and security events"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'privacy':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Shield className="h-5 w-5" />
                                Privacy Protection
                            </CardTitle>
                            <CardDescription>
                                Configure privacy detection and protection features
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="pii-detection">PII Detection</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Monitor when you enter personal information on websites
                                    </p>
                                </div>
                                <Switch
                                    id="pii-detection"
                                    checked={enablePIIDetection}
                                    onCheckedChange={(checked) => {
                                        setEnablePIIDetection(checked)
                                        handleChange()
                                        toast.info('PII Detection ' + (checked ? 'Enabled' : 'Disabled'), {
                                            description: checked ? 'Personal information monitoring is now active.' : 'Personal information monitoring is now disabled.',
                                            duration: 2500
                                        })
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between opacity-50">
                                <div className="space-y-0.5">
                                    <Label htmlFor="tracker-blocking">Tracker Blocking (Coming Soon)</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically block known tracking scripts
                                    </p>
                                </div>
                                <Switch
                                    id="tracker-blocking"
                                    checked={enableTrackerBlocking}
                                    disabled={true}
                                    onCheckedChange={(checked) => {
                                        setEnableTrackerBlocking(checked)
                                        handleChange()
                                        toast.info('Tracker Blocking ' + (checked ? 'Enabled' : 'Disabled'), {
                                            description: checked ? 'Tracker blocking is now active.' : 'Tracker blocking is now disabled.',
                                            duration: 2500
                                        })
                                    }}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="wrs-threshold">
                                    WRS Alert Threshold: {wrsThreshold}
                                </Label>
                                <input
                                    type="range"
                                    id="wrs-threshold"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={wrsThreshold}
                                    onChange={(e) => {
                                        const newValue = Number(e.target.value)
                                        setWrsThreshold(newValue)
                                        handleChange()
                                        toast.info('WRS Threshold Updated', {
                                            description: `Alert threshold set to ${newValue}. You'll be warned about sites above this score.`,
                                            duration: 2500
                                        })
                                    }}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <p className="text-sm text-muted-foreground">
                                    You'll be warned when visiting sites with WRS above {wrsThreshold}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'data-retention':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Database className="h-5 w-5" />
                                Data Retention
                            </CardTitle>
                            <CardDescription>
                                Control how long data is stored
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="data-retention">
                                    Data Retention: {dataRetention} days
                                </Label>
                                <input
                                    type="range"
                                    id="data-retention"
                                    min={7}
                                    max={90}
                                    step={1}
                                    value={dataRetention}
                                    onChange={(e) => {
                                        const newValue = Number(e.target.value)
                                        setDataRetention(newValue)
                                        handleChange()
                                        toast.info('Data Retention Updated', {
                                            description: `Data will be kept for ${newValue} days before automatic deletion.`,
                                            duration: 2500
                                        })
                                    }}
                                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Activity logs and score history older than {dataRetention} days will be automatically deleted
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'clear-data':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Trash2 className="h-5 w-5" />
                                Clear Data
                            </CardTitle>
                            <CardDescription>
                                Manage and clear extension data for testing or privacy
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Quick Actions</Label>
                                <div className="grid gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={clearActivityLogs}
                                        className="w-full justify-start text-left h-auto py-3 px-4"
                                    >
                                        <div className="flex items-start gap-3 w-full">
                                            <Trash2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="font-medium">Clear Activity Logs</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    Remove all logged events and PII detections
                                                </div>
                                            </div>
                                        </div>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={resetPrivacyScore}
                                        className="w-full justify-start text-left h-auto py-3 px-4"
                                    >
                                        <div className="flex items-start gap-3 w-full">
                                            <RotateCcw className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="font-medium">Reset Privacy Score</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    Reset UPS to 100 and clear browsing history
                                                </div>
                                            </div>
                                        </div>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t">
                                <Label className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Danger Zone
                                </Label>
                                <Button
                                    variant="outline"
                                    onClick={clearAllData}
                                    className="w-full justify-start text-left h-auto py-3 px-4 border-red-500 text-red-500 hover:bg-red-500/10"
                                >
                                    <div className="flex items-start gap-3 w-full">
                                        <Trash2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="font-medium">Clear All Data</div>
                                            <div className="text-xs opacity-90 mt-0.5">
                                                Delete everything including settings (cannot be undone)
                                            </div>
                                        </div>
                                    </div>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'about':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Rocket className="h-5 w-5" />
                                Extension Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Version:</span>
                                <span className="font-medium">{manifestVersion}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Schema Version:</span>
                                <span className="font-medium">{schemaVersion}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Storage Used:</span>
                                <span className="font-medium">
                                    {(storageInfo.bytesInUse / 1024).toFixed(2)} KB / {(storageInfo.quota / 1024 / 1024).toFixed(1)} MB
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Storage Usage:</span>
                                <span className="font-medium">
                                    {((storageInfo.bytesInUse / storageInfo.quota) * 100).toFixed(1)}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )

            default:
                return null
        }
    }

    return (
        <div className="flex h-full w-full">
            {/* Mobile Menu Button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="flex items-center gap-2"
                >
                    <Menu className="h-4 w-4" />
                    Settings Menu
                </Button>
            </div>

            {/* Sidebar */}
            <div className={cn(
                "fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-sidebar border-r transition-transform duration-300 lg:translate-x-0",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-semibold">Settings</h2>
                        <p className="text-sm text-muted-foreground">Configure preferences</p>
                    </div>

                    {/* Menu Items */}
                    <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => {
                            const Icon = item.icon
                            const isActive = activeSection === item.id
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleMenuItemClick(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                        isActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">{item.label}</div>
                                        <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                    </div>
                                    {isActive && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 lg:ml-0">
                {/* Sticky Save/Reset Bar */}
                <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg hidden sm:block">
                            {menuItems.find(item => item.id === activeSection)?.label}
                        </h3>
                        {hasChanges && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
                                Unsaved changes
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetSettings}
                            className="flex items-center gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            <span className="hidden sm:inline">Reset</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={saveSettings}
                            disabled={!hasChanges}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            <span className="hidden sm:inline">Save Changes</span>
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 lg:pt-6 pt-16">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
}
