"use client"

import React, { useState } from "react"
import { useSettings } from "@/lib/useStorage"
import { Shield, Ban, Plus, Trash2, Info, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Stat card component
function StatCard({
    title,
    value,
    icon: Icon,
    iconColor,
}: {
    title: string
    value: string | number
    icon: React.ComponentType<{ className?: string }>
    iconColor?: string
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {title}
                        </p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                    </div>
                    <div className={cn("p-2 rounded-lg bg-muted", iconColor)}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function WhitelistBlacklistPage() {
    const settings = useSettings()
    const [whitelistInput, setWhitelistInput] = useState("")
    const [blacklistInput, setBlacklistInput] = useState("")

    if (!settings) return <div className="p-4">Loading...</div>

    const whitelist = settings.whitelist || []
    const blacklist = settings.blacklist || []

    const addToWhitelist = async () => {
        if (!whitelistInput.trim()) return

        const domain = whitelistInput.trim().toLowerCase()
        if (whitelist.includes(domain)) {
            toast.error("Already whitelisted", {
                description: `${domain} is already in your whitelist.`
            })
            return
        }

        // Remove from blacklist if present
        const updatedBlacklist = blacklist.filter(d => d !== domain)
        const updatedWhitelist = [...whitelist, domain]

        const updatedSettings = {
            ...settings,
            whitelist: updatedWhitelist,
            blacklist: updatedBlacklist
        }

        await chrome.storage.local.set({ settings: updatedSettings })
        setWhitelistInput("")
        toast.success("Added to whitelist", {
            description: `${domain} is now trusted.`
        })
    }

    const removeFromWhitelist = async (domain: string) => {
        const updatedWhitelist = whitelist.filter(d => d !== domain)
        const updatedSettings = {
            ...settings,
            whitelist: updatedWhitelist
        }
        await chrome.storage.local.set({ settings: updatedSettings })
        toast.info("Removed from whitelist", {
            description: `${domain} is no longer trusted.`
        })
    }

    const addToBlacklist = async () => {
        if (!blacklistInput.trim()) return

        const domain = blacklistInput.trim().toLowerCase()
        if (blacklist.includes(domain)) {
            toast.error("Already blacklisted", {
                description: `${domain} is already in your blacklist.`
            })
            return
        }

        // Remove from whitelist if present
        const updatedWhitelist = whitelist.filter(d => d !== domain)
        const updatedBlacklist = [...blacklist, domain]

        const updatedSettings = {
            ...settings,
            whitelist: updatedWhitelist,
            blacklist: updatedBlacklist
        }

        await chrome.storage.local.set({ settings: updatedSettings })
        setBlacklistInput("")
        toast.success("Added to blacklist", {
            description: `${domain} is now blocked.`
        })
    }

    const removeFromBlacklist = async (domain: string) => {
        const updatedBlacklist = blacklist.filter(d => d !== domain)
        const updatedSettings = {
            ...settings,
            blacklist: updatedBlacklist
        }
        await chrome.storage.local.set({ settings: updatedSettings })
        toast.info("Removed from blacklist", {
            description: `${domain} is no longer blocked.`
        })
    }

    return (
        <div className="space-y-6 w-full max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Domain Lists
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage trusted and blocked domains
                </p>
            </div>

            {/* Statistics */}
            <div className="grid gap-4 grid-cols-2">
                <StatCard
                    title="Trusted"
                    value={whitelist.length}
                    icon={Shield}
                    iconColor="text-green-500"
                />
                <StatCard
                    title="Blocked"
                    value={blacklist.length}
                    icon={Ban}
                    iconColor="text-red-500"
                />
            </div>

            {/* Info Card */}
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                                <strong className="text-foreground">Whitelist:</strong> Trusted domains always receive a WRS of 0 (no risk).
                            </p>
                            <p>
                                <strong className="text-foreground">Blacklist:</strong> Blocked domains always receive a WRS of 100 (critical risk).
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Whitelist Management */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Shield className="h-4 w-4 text-green-500" />
                        Whitelist
                    </CardTitle>
                    <CardDescription>
                        Domains you trust completely
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add Input */}
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="example.com"
                            value={whitelistInput}
                            onChange={(e) => setWhitelistInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addToWhitelist()}
                            className="flex-1"
                        />
                        <Button
                            onClick={addToWhitelist}
                            disabled={!whitelistInput.trim()}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add
                        </Button>
                    </div>

                    {/* List */}
                    {whitelist.length > 0 ? (
                        <div className="space-y-2">
                            {whitelist.map((domain) => (
                                <div
                                    key={domain}
                                    className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span className="font-medium text-sm">
                                            {domain}
                                        </span>
                                        <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-0 text-xs">
                                            Trusted
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFromWhitelist(domain)}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No trusted domains yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Blacklist Management */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Ban className="h-4 w-4 text-red-500" />
                        Blacklist
                    </CardTitle>
                    <CardDescription>
                        Domains you want to avoid
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add Input */}
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="suspicious-site.com"
                            value={blacklistInput}
                            onChange={(e) => setBlacklistInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                            className="flex-1"
                        />
                        <Button
                            onClick={addToBlacklist}
                            variant="destructive"
                            disabled={!blacklistInput.trim()}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add
                        </Button>
                    </div>

                    {/* List */}
                    {blacklist.length > 0 ? (
                        <div className="space-y-2">
                            {blacklist.map((domain) => (
                                <div
                                    key={domain}
                                    className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                                >
                                    <div className="flex items-center gap-2">
                                        <Ban className="h-4 w-4 text-red-500" />
                                        <span className="font-medium text-sm">
                                            {domain}
                                        </span>
                                        <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-0 text-xs">
                                            Blocked
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFromBlacklist(domain)}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            <Ban className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No blocked domains yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
