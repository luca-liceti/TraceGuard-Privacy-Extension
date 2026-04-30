"use client"

import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Globe } from "lucide-react"
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

// Import navigation from shared source - pages automatically stay in sync!
import { getAllSearchablePages, settingsSearchItems, type SettingsSearchItem } from "@/lib/navigation"

export function SearchCommand() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [siteCache, setSiteCache] = useState<Record<string, any>>({})
    const navigate = useNavigate()

    // Get pages from shared navigation config - automatically updated!
    const pages = useMemo(() => {
        return getAllSearchablePages().map(page => ({
            ...page,
            category: 'pages' as const
        }))
    }, [])

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
    }, [query, pages])

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
        if (!query) return [] as SettingsSearchItem[]
        const lowerQuery = query.toLowerCase()
        return settingsSearchItems.filter((item: SettingsSearchItem) =>
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
