/**
 * =============================================================================
 * NAVIGATION CONFIGURATION - Dashboard Menu Structure
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file defines the navigation menu structure for the TraceGuard dashboard.
 * It's the "single source of truth" - all menu items are defined here, and
 * both the sidebar and search use this configuration.
 * 
 * WHY A CENTRAL CONFIG?
 * Instead of duplicating menu items in multiple places, we define them once
 * here. This makes it easy to:
 * - Add new pages (just add to this file)
 * - Rename or reorganize pages
 * - Keep the sidebar and search in sync
 * 
 * SECTIONS:
 * 1. Main - Overview and Privacy Score
 * 2. Analysis - Website Safety, Sites, Trackers, Activity
 * 3. Management - Domain Lists, Integrations
 * 4. Footer - Settings, Help
 * 
 * DATA STRUCTURES:
 * - NavSection: A labeled group of navigation items
 * - NavItem: A single menu item with id, title, icon, and optional sub-items
 * - SettingsSearchItem: Deep links into specific settings tabs
 * 
 * HELPER FUNCTIONS:
 * - getAllSearchablePages(): Flattens the navigation for search functionality
 * =============================================================================
 */

"use client"

import {
    Settings,
    HelpCircle,
    LayoutDashboard,
    FileText,
    ListChecks,
    Globe,
    BarChart3,
    Eye,
    ShieldCheck,
    Link as LinkIcon,
    Database,
    type LucideIcon,
} from "lucide-react"

// =============================================================================
// TYPE DEFINITIONS
// These define the shape of our navigation data
// =============================================================================

/**
 * Shared navigation configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all navigation items.
 * When you add a new page:
 *   1. Add it to the appropriate section in navSections or footerItems
 *   2. The sidebar and search will automatically include it
 */

// Menu data structure - represents a single navigation item
export interface NavItem {
    id: string              // Unique identifier for this item
    title: string           // Display name shown in menu
    description?: string    // Used by search to help users find pages
    url?: string            // URL path for this page (e.g., "/settings")
    icon: LucideIcon        // Icon component from lucide-react
    isNew?: boolean         // Show a "New" badge?
    badge?: string          // Optional text badge
    items?: {               // Sub-menu items (for expandable menus)
        id: string
        title: string
        description?: string
        url: string
    }[]
}

// A section groups related navigation items together
export interface NavSection {
    id: string              // Unique identifier for this section
    label: string           // Section header displayed in sidebar
    items: NavItem[]        // Navigation items in this section
}

// =============================================================================
// MAIN NAVIGATION SECTIONS
// The primary menu structure for the dashboard
// =============================================================================

export const navSections: NavSection[] = [
    {
        id: "main",
        label: "Main",
        items: [
            {
                id: "overview",
                title: "Overview",
                description: "Dashboard overview",
                url: "/overview",
                icon: LayoutDashboard,
            },
            {
                id: "privacy-score",
                title: "Privacy Score",
                description: "Your UPS score and history",
                url: "/privacy-score",
                icon: ShieldCheck,
            },
        ],
    },
    {
        id: "analysis",
        label: "Analysis",
        items: [
            {
                id: "website-safety",
                title: "Website Safety",
                description: "Site risk analysis",
                url: "/website-safety",
                icon: Globe,
            },
            {
                id: "sites",
                title: "Sites Analyzed",
                description: "All visited sites",
                url: "/sites",
                icon: BarChart3,
            },
            {
                id: "trackers",
                title: "Trackers",
                description: "Tracker detection",
                url: "/trackers",
                icon: Eye,
            },
            {
                id: "activity-logs",
                title: "Activity Logs",
                description: "Browsing activity",
                url: "/activity-logs",
                icon: FileText,
            },
        ],
    },
    {
        id: "management",
        label: "Management",
        items: [
            {
                id: "whitelist-blacklist",
                title: "Domain Lists",
                description: "Trusted and blocked sites",
                url: "/whitelist-blacklist",
                icon: ListChecks,
            },
            {
                id: "integrations",
                title: "Integrations",
                description: "Third-party integrations",
                url: "/integrations",
                icon: LinkIcon,
                isNew: true,
            },
        ],
    },
]

export const footerItems: NavItem[] = [
    {
        id: "settings",
        title: "Settings",
        description: "Extension preferences",
        url: "/settings",
        icon: Settings,
    },
    {
        id: "help",
        title: "Help",
        description: "Documentation and support",
        url: "/help",
        icon: HelpCircle,
    },
]

/**
 * Quick settings items for search
 * These are deeper links into settings pages/tabs
 */
export interface SettingsSearchItem {
    id: string
    label: string
    description: string
    icon: LucideIcon
    href: string
}

export const settingsSearchItems: SettingsSearchItem[] = [
    { id: 's-theme', label: 'Theme & Appearance', description: 'Change color mode (Light/Dark)', icon: Settings, href: '/settings?tab=general' },
    { id: 's-display', label: 'Display Mode', description: 'Toggle between Popup and Side Panel', icon: Settings, href: '/settings?tab=general' },
    { id: 's-alerts', label: 'Notification Levels', description: 'Configure alert sensitivity', icon: Settings, href: '/settings?tab=notifications' },
    { id: 's-pii', label: 'PII Detection', description: 'Monitor personal information inputs', icon: ShieldCheck, href: '/settings?tab=privacy' },
    { id: 's-wss', label: 'Safety Score Threshold', description: 'Set minimum safety score for alerts', icon: ShieldCheck, href: '/settings?tab=privacy' },
    { id: 's-retention', label: 'Data Retention', description: 'Manage log storage duration', icon: Database, href: '/settings?tab=data' },
    { id: 's-clear', label: 'Clear Data', description: 'Clear logs, reset score, or factory reset', icon: Database, href: '/settings?tab=data' },
    { id: 'p-breakdown', label: 'Score Breakdown', description: 'See how your Privacy Score is calculated', icon: ShieldCheck, href: '/privacy-score' },
    { id: 'p-risks', label: 'Risk Analysis', description: 'View detailed site risk factors', icon: Globe, href: '/website-safety' },
]

/**
 * Helper function to get all searchable pages from navigation config
 * This flattens the navigation structure for search functionality
 */
export function getAllSearchablePages() {
    const pages: { id: string; label: string; description?: string; icon: LucideIcon; href: string }[] = []

    // Add all section items
    for (const section of navSections) {
        for (const item of section.items) {
            if (item.url) {
                pages.push({
                    id: item.id,
                    label: item.title,
                    description: item.description,
                    icon: item.icon,
                    href: item.url,
                })
            }
            // Add sub-items if any
            if (item.items) {
                for (const subItem of item.items) {
                    pages.push({
                        id: subItem.id,
                        label: subItem.title,
                        description: subItem.description,
                        icon: item.icon, // Use parent icon for sub-items
                        href: subItem.url,
                    })
                }
            }
        }
    }

    // Add footer items
    for (const item of footerItems) {
        if (item.url) {
            pages.push({
                id: item.id,
                label: item.title,
                description: item.description,
                icon: item.icon,
                href: item.url,
            })
        }
    }

    return pages
}
