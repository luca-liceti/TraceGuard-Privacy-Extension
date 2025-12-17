"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
    Search,
    Home,
    ShieldCheck,
    Globe,
    Target,
    FileText,
    Database,
    Settings,
    TrendingUp,
    Link as LinkIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import { DialogTitle } from "@/components/ui/dialog"

interface SearchableItem {
    id: string
    label: string
    description?: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    category: 'pages' | 'sites' | 'settings'
}

// Static pages for navigation
const pages: SearchableItem[] = [
    { id: 'overview', label: 'Overview', description: 'Dashboard overview', icon: Home, href: '/overview', category: 'pages' },
    { id: 'privacy-score', label: 'Privacy Score', description: 'Your UPS score and history', icon: ShieldCheck, href: '/privacy-score', category: 'pages' },
    { id: 'website-safety', label: 'Website Safety', description: 'Site risk analysis', icon: Globe, href: '/website-safety', category: 'pages' },
    { id: 'sites', label: 'Sites Analyzed', description: 'All visited sites', icon: TrendingUp, href: '/sites', category: 'pages' },
    { id: 'trackers', label: 'Trackers', description: 'Tracker detection', icon: Target, href: '/trackers', category: 'pages' },
    { id: 'activity-logs', label: 'Activity Logs', description: 'Browsing activity', icon: FileText, href: '/activity-logs', category: 'pages' },
    { id: 'whitelist-blacklist', label: 'Whitelist & Blacklist', description: 'Trusted and blocked sites', icon: Database, href: '/whitelist-blacklist', category: 'pages' },
    { id: 'integrations', label: 'Integrations', description: 'Third-party integrations', icon: LinkIcon, href: '/integrations', category: 'pages' },
    { id: 'settings', label: 'Settings', description: 'Extension preferences', icon: Settings, href: '/settings', category: 'pages' },
]

const settingsItems: SearchableItem[] = [
    { id: 's-theme', label: 'Theme & Appearance', description: 'Change color mode (Light/Dark)', icon: Settings, href: '/settings?tab=general', category: 'settings' },
    { id: 's-display', label: 'Display Mode', description: 'Toggle between Popup and Side Panel', icon: Settings, href: '/settings?tab=general', category: 'settings' },
    { id: 's-alerts', label: 'Notification Levels', description: 'Configure alert sensitivity', icon: Settings, href: '/settings?tab=notifications', category: 'settings' },
    { id: 's-pii', label: 'PII Detection', description: 'Monitor personal information inputs', icon: ShieldCheck, href: '/settings?tab=privacy', category: 'settings' },
    { id: 's-wss', label: 'Safety Score Threshold', description: 'Set minimum safety score for alerts', icon: ShieldCheck, href: '/settings?tab=privacy', category: 'settings' },
    { id: 's-retention', label: 'Data Retention', description: 'Manage log storage duration', icon: Database, href: '/settings?tab=data', category: 'settings' },
    { id: 's-clear', label: 'Clear Data', description: 'Clear logs, reset score, or factory reset', icon: Database, href: '/settings?tab=data', category: 'settings' },
    { id: 'p-breakdown', label: 'Score Breakdown', description: 'See how your Privacy Score is calculated', icon: ShieldCheck, href: '/privacy-score', category: 'settings' },
    { id: 'p-risks', label: 'Risk Analysis', description: 'View detailed site risk factors', icon: Globe, href: '/website-safety', category: 'settings' },
]

export function SearchCommand() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [siteCache, setSiteCache] = useState<Record<string, any>>({})
    const navigate = useNavigate()

    // Keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    // Load site cache for searching sites
    useEffect(() => {
        chrome.storage.local.get('siteCache').then(res => {
            setSiteCache(res.siteCache || {})
        })

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes.siteCache) {
                setSiteCache(changes.siteCache.newValue || {})
            }
        }

        chrome.storage.onChanged.addListener(listener)
        return () => chrome.storage.onChanged.removeListener(listener)
    }, [])

    // Filter results based on query
    const filteredPages = useMemo(() => {
        if (!query) return pages
        const lowerQuery = query.toLowerCase()
        return pages.filter(page =>
            page.label.toLowerCase().includes(lowerQuery) ||
            page.description?.toLowerCase().includes(lowerQuery)
        )
    }, [query])

    const filteredSites = useMemo(() => {
        if (!query) return []
        const lowerQuery = query.toLowerCase()
        return Object.keys(siteCache)
            .filter(domain => domain.toLowerCase().includes(lowerQuery))
            .slice(0, 5)
            .map(domain => ({
                id: `site-${domain}`,
                label: domain,
                description: `WSS: ${siteCache[domain]?.wss || 'N/A'}`,
                icon: Globe,
                href: '/sites',
                category: 'sites' as const
            }))
    }, [query, siteCache])

    const filteredSettings = useMemo(() => {
        if (!query) return []
        const lowerQuery = query.toLowerCase()
        return settingsItems.filter(item =>
            item.label.toLowerCase().includes(lowerQuery) ||
            item.description?.toLowerCase().includes(lowerQuery)
        )
    }, [query])

    const handleSelect = (href: string) => {
        setOpen(false)
        setQuery("")
        navigate(href)
    }

    return (
        <>
            <Button
                variant="outline"
                className="relative w-full max-w-[300px] justify-start text-sm text-muted-foreground bg-muted/50 hover:bg-muted"
                onClick={() => setOpen(true)}
            >
                <Search className="mr-2 h-4 w-4" />
                <span className="hidden md:inline-flex">Search...</span>
                <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <DialogTitle className="sr-only">Search</DialogTitle>
                <CommandInput
                    placeholder="Search pages, sites..."
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    {filteredPages.length > 0 && (
                        <CommandGroup heading="Pages">
                            {filteredPages.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.label}
                                    onSelect={() => handleSelect(item.href)}
                                    className="cursor-pointer"
                                >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{item.label}</span>
                                        {item.description && (
                                            <span className="text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {filteredSettings.length > 0 && (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Settings & Sections">
                                {filteredSettings.map((item) => (
                                    <CommandItem
                                        key={item.id}
                                        value={item.label}
                                        onSelect={() => handleSelect(item.href)}
                                        className="cursor-pointer"
                                    >
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <div className="flex flex-col">
                                            <span>{item.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </>
                    )}

                    {filteredSites.length > 0 && (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Sites">
                                {filteredSites.map((item) => (
                                    <CommandItem
                                        key={item.id}
                                        value={item.label}
                                        onSelect={() => handleSelect(item.href)}
                                        className="cursor-pointer"
                                    >
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <div className="flex flex-col">
                                            <span>{item.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    )
}

export default SearchCommand
