"use client"

import React from "react"
import {
    Link as LinkIcon,
    Key,
    Shield,
    Mail,
    Lock,
    ExternalLink,
    Sparkles
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface IntegrationItem {
    name: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    examples: string[]
    status: 'coming-soon' | 'planned' | 'available'
}

const integrations: IntegrationItem[] = [
    {
        name: "Privacy Tools",
        description: "Integrate with other browser privacy extensions",
        icon: Lock,
        examples: ["uBlock Origin", "Privacy Badger", "HTTPS Everywhere"],
        status: "coming-soon"
    },
    {
        name: "Password Managers",
        description: "Sync with your password manager to identify weak or reused passwords",
        icon: Key,
        examples: ["1Password", "Bitwarden", "LastPass", "Dashlane"],
        status: "planned"
    },
    {
        name: "VPN Services",
        description: "Connect with VPN providers for enhanced privacy protection",
        icon: Shield,
        examples: ["NordVPN", "ExpressVPN", "ProtonVPN", "Mullvad"],
        status: "planned"
    },
    {
        name: "Email Aliases",
        description: "Generate anonymous email aliases to protect your identity",
        icon: Mail,
        examples: ["SimpleLogin", "Firefox Relay", "DuckDuckGo Email"],
        status: "planned"
    }
]

function StatusBadge({ status }: { status: IntegrationItem['status'] }) {
    switch (status) {
        case 'available':
            return (
                <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-0">
                    Available
                </Badge>
            )
        case 'coming-soon':
            return (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-0">
                    Coming Soon
                </Badge>
            )
        case 'planned':
            return (
                <Badge className="bg-muted text-muted-foreground border-0">
                    Planned
                </Badge>
            )
    }
}

export default function IntegrationsPage() {
    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
                <p className="text-muted-foreground mt-2">
                    Connect TraceGuard with your favorite privacy tools
                </p>
            </div>

            {/* Coming Soon Hero */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="pt-8 pb-8">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Integrations Coming Soon
                        </h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            We're working on exciting integrations to enhance your privacy protection.
                            Check back soon for updates!
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Planned Integrations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <LinkIcon className="h-5 w-5" />
                        Planned Integrations
                    </CardTitle>
                    <CardDescription>
                        Here's what we're working on for future releases
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        {integrations.map((integration) => (
                            <Card key={integration.name} className="border">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                <integration.icon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">
                                                    {integration.name}
                                                </CardTitle>
                                            </div>
                                        </div>
                                        <StatusBadge status={integration.status} />
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <p className="text-sm text-muted-foreground mb-3">
                                        {integration.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {integration.examples.map((example) => (
                                            <Badge
                                                key={example}
                                                variant="outline"
                                                className="text-xs font-normal"
                                            >
                                                {example}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Feature Request */}
            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ExternalLink className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">
                                Have an integration idea?
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                We'd love to hear your suggestions for new integrations.
                                Let us know which privacy tools you'd like to see connected to TraceGuard.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
