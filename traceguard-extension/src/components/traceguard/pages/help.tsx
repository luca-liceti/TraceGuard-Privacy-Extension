/**
 * =============================================================================
 * HELP PAGE - User Guide and FAQ
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the help center for TraceGuard. It explains how to use the extension
 * and answers common questions. Think of it as the instruction manual!
 * 
 * SECTIONS ON THIS PAGE:
 * 
 * 1. QUICK START GUIDE
 *    - Step-by-step instructions for new users
 *    - How to get started with TraceGuard
 * 
 * 2. KEY FEATURES
 *    - Privacy Score Tracking: Monitor your privacy over time
 *    - Website Risk Analysis: See how safe each site is
 *    - Tracker Detection: Find tracking scripts on websites
 *    - Activity Logging: Review your browsing history with risk info
 * 
 * 3. FREQUENTLY ASKED QUESTIONS (FAQ)
 *    - What is UPS? (User Privacy Score)
 *    - What is WRS? (Website Risk Score)
 *    - How does TraceGuard protect you?
 *    - What data does it collect?
 *    - What are whitelists and blacklists?
 *    - How to improve your score?
 * 
 * 4. UNDERSTANDING SCORES
 *    - Color-coded guide to UPS levels (90-100, 70-89, etc.)
 *    - Color-coded guide to WRS levels (0-39, 40-59, etc.)
 * 
 * 5. VERSION INFO
 *    - Current extension version
 *    - Privacy commitment (all data stays on your device)
 * =============================================================================
 */

"use client"

import React from "react"
import {
    HelpCircle,
    Shield,
    Eye,
    Globe,
    FileText,
    Info,
    Lightbulb,
    BookOpen,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface FAQItem {
    question: string
    answer: string
}

const faqs: FAQItem[] = [
    {
        question: "What is the User Privacy Score (UPS)?",
        answer: "The UPS is a score from 0-100 that reflects your overall privacy health while browsing. It starts at 100 and decreases when you enter personal information on websites, especially on risky sites."
    },
    {
        question: "What is the Website Risk Score (WRS)?",
        answer: "The WRS measures how risky a particular website is. It's calculated based on protocol security, domain reputation, tracking scripts, cookies, input requirements, and privacy policies. Higher scores mean higher risk."
    },
    {
        question: "How does TraceGuard protect my privacy?",
        answer: "TraceGuard monitors the websites you visit and detects trackers, analyzes privacy policies, and alerts you when you're about to enter sensitive information on risky websites. All data stays on your device."
    },
    {
        question: "What data does TraceGuard collect?",
        answer: "TraceGuard only stores data locally on your device. It does not send any data to external servers. You can clear all data at any time from the Settings page."
    },
    {
        question: "What are whitelists and blacklists?",
        answer: "Whitelisted domains are trusted sites that always receive a WRS of 0 (safe). Blacklisted domains are blocked sites that always receive a WRS of 100 (critical risk)."
    },
    {
        question: "How do I improve my Privacy Score?",
        answer: "Your score naturally recovers over time when you practice safe browsing. Avoid entering sensitive information on risky websites, and consider whitelisting sites you trust."
    },
]

interface FeatureItem {
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
}

const features: FeatureItem[] = [
    {
        title: "Privacy Score Tracking",
        description: "Monitor your browsing privacy over time with a comprehensive score.",
        icon: Shield,
    },
    {
        title: "Website Risk Analysis",
        description: "Each website is analyzed for trackers, cookies, and security issues.",
        icon: Globe,
    },
    {
        title: "Tracker Detection",
        description: "Identify tracking scripts and third-party resources on websites.",
        icon: Eye,
    },
    {
        title: "Activity Logging",
        description: "Review your browsing history with detailed risk breakdowns.",
        icon: FileText,
    },
]

export default function HelpPage() {
    return (
        <div className="space-y-6 w-full max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Help Center</h1>
                <p className="text-muted-foreground mt-2">
                    Learn how to use TraceGuard and protect your privacy
                </p>
            </div>

            {/* Quick Start */}
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        Quick Start
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                    <p>
                        <strong className="text-foreground">Welcome to TraceGuard!</strong> This extension helps you browse the web more safely by analyzing websites for privacy risks.
                    </p>
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Browse the web normally - TraceGuard works automatically</li>
                        <li>Check the <strong>Overview</strong> page to see your privacy score</li>
                        <li>Review the <strong>Activity Logs</strong> to see detailed analysis</li>
                        <li>Use the <strong>Domain Lists</strong> to trust or block specific sites</li>
                    </ol>
                </CardContent>
            </Card>

            {/* Key Features */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Key Features
                    </CardTitle>
                    <CardDescription>
                        What TraceGuard does to protect you
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="flex gap-3 p-3 rounded-lg border bg-muted/30"
                            >
                                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                                    <feature.icon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-sm">{feature.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* FAQ */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <HelpCircle className="h-4 w-4 text-primary" />
                        Frequently Asked Questions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div key={index}>
                            <h3 className="font-medium text-sm text-foreground mb-1">
                                {faq.question}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {faq.answer}
                            </p>
                            {index < faqs.length - 1 && <Separator className="mt-4" />}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Understanding Scores */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Info className="h-4 w-4 text-primary" />
                        Understanding Scores
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h3 className="font-medium text-sm mb-2">Privacy Score (UPS)</h3>
                        <div className="grid grid-cols-5 gap-2 text-center text-xs">
                            <div className="p-2 rounded bg-green-500/10">
                                <span className="font-bold text-green-500">90-100</span>
                                <p className="text-muted-foreground">Excellent</p>
                            </div>
                            <div className="p-2 rounded bg-blue-500/10">
                                <span className="font-bold text-blue-500">70-89</span>
                                <p className="text-muted-foreground">Good</p>
                            </div>
                            <div className="p-2 rounded bg-yellow-500/10">
                                <span className="font-bold text-yellow-500">50-69</span>
                                <p className="text-muted-foreground">Fair</p>
                            </div>
                            <div className="p-2 rounded bg-orange-500/10">
                                <span className="font-bold text-orange-500">30-49</span>
                                <p className="text-muted-foreground">Poor</p>
                            </div>
                            <div className="p-2 rounded bg-red-500/10">
                                <span className="font-bold text-red-500">0-29</span>
                                <p className="text-muted-foreground">Critical</p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="font-medium text-sm mb-2">Website Risk Score (WRS)</h3>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="p-2 rounded bg-green-500/10">
                                <span className="font-bold text-green-500">0-39</span>
                                <p className="text-muted-foreground">Low Risk</p>
                            </div>
                            <div className="p-2 rounded bg-yellow-500/10">
                                <span className="font-bold text-yellow-500">40-59</span>
                                <p className="text-muted-foreground">Medium</p>
                            </div>
                            <div className="p-2 rounded bg-orange-500/10">
                                <span className="font-bold text-orange-500">60-79</span>
                                <p className="text-muted-foreground">High</p>
                            </div>
                            <div className="p-2 rounded bg-red-500/10">
                                <span className="font-bold text-red-500">80-100</span>
                                <p className="text-muted-foreground">Critical</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Version Info */}
            <Card className="bg-muted/50">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium text-sm">TraceGuard Privacy Extension</p>
                                <p className="text-xs text-muted-foreground">
                                    All data stays on your device. Your privacy is our priority.
                                </p>
                            </div>
                        </div>
                        <Badge variant="secondary">Local Only</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
