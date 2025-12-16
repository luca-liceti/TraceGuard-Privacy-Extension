"use client"

import React, { useState } from "react"
import { useAppState } from "@/lib/useStorage"
import { Shield, Ban, Plus, Trash2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function WhitelistBlacklistPage() {
    const state = useAppState()
    const [whitelistInput, setWhitelistInput] = useState("")
    const [blacklistInput, setBlacklistInput] = useState("")

    if (!state) return <div className="p-4">Loading...</div>

    const whitelist = state.whitelist || []
    const blacklist = state.blacklist || []

    const addToWhitelist = async () => {
        if (!whitelistInput.trim()) return

        const domain = whitelistInput.trim().toLowerCase()
        if (whitelist.includes(domain)) {
            alert("Domain already in whitelist")
            return
        }

        const updatedWhitelist = [...whitelist, domain]
        await chrome.storage.local.set({ whitelist: updatedWhitelist })
        setWhitelistInput("")
    }

    const removeFromWhitelist = async (domain: string) => {
        const updatedWhitelist = whitelist.filter(d => d !== domain)
        await chrome.storage.local.set({ whitelist: updatedWhitelist })
    }

    const addToBlacklist = async () => {
        if (!blacklistInput.trim()) return

        const domain = blacklistInput.trim().toLowerCase()
        if (blacklist.includes(domain)) {
            alert("Domain already in blacklist")
            return
        }

        const updatedBlacklist = [...blacklist, domain]
        await chrome.storage.local.set({ blacklist: updatedBlacklist })
        setBlacklistInput("")
    }

    const removeFromBlacklist = async (domain: string) => {
        const updatedBlacklist = blacklist.filter(d => d !== domain)
        await chrome.storage.local.set({ blacklist: updatedBlacklist })
    }

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Whitelist & Blacklist
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage trusted and blocked domains
                </p>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-500/10 border-blue-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-blue-600 dark:text-blue-400">
                        <AlertCircle className="h-5 w-5" />
                        How Whitelist & Blacklist Work
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                    <p>
                        <strong>Whitelist:</strong> Domains you trust completely. These sites will always receive a WRS of 0 (no risk),
                        regardless of other factors. Use this for your bank, work sites, or other trusted domains.
                    </p>
                    <p>
                        <strong>Blacklist:</strong> Domains you want to avoid. These sites will always receive a WRS of 100 (critical risk),
                        and you'll be warned when visiting them.
                    </p>
                </CardContent>
            </Card>

            {/* Statistics */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Whitelisted Domains
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">{whitelist.length}</div>
                    </CardContent>
                </Card>

                <Card className=" ">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Blacklisted Domains
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-500">{blacklist.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Whitelist Management */}
            <Card className=" ">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <Shield className="h-5 w-5 text-green-500" />
                        Whitelist (Trusted Domains)
                    </CardTitle>
                    <CardDescription>
                        Add domains you trust completely
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
                        />
                        <Button
                            onClick={addToWhitelist}
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
                                    className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/10"
                                >
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-green-500" />
                                        <span className="font-medium text-foreground">
                                            {domain}
                                        </span>
                                        <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-0">
                                            Trusted
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFromWhitelist(domain)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No whitelisted domains yet
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Blacklist Management */}
            <Card className=" ">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <Ban className="h-5 w-5 text-red-500" />
                        Blacklist (Blocked Domains)
                    </CardTitle>
                    <CardDescription>
                        Add domains you want to avoid
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
                        />
                        <Button
                            onClick={addToBlacklist}
                            variant="destructive"
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
                                    className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/10"
                                >
                                    <div className="flex items-center gap-2">
                                        <Ban className="h-4 w-4 text-red-500" />
                                        <span className="font-medium text-foreground">
                                            {domain}
                                        </span>
                                        <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-0">
                                            Blocked
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFromBlacklist(domain)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No blacklisted domains yet
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
