/**
 * =============================================================================
 * TOP NAV - Header Bar Component
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the header bar at the top of every page. It shows where you are
 * in the app and provides quick access to search, notifications, and themes.
 * 
 * LAYOUT:
 * ┌─[Sidebar Toggle]─[Breadcrumbs]───────[Search]───────[Notifications]─[Theme]─┐
 * │      ≡        │ Overview > Analysis > Current Page │ 🔍 │     🔔      │ ☀️  │
 * └──────────────────────────────────────────────────────────────────────────────┘
 * 
 * COMPONENTS:
 * - Left: Sidebar toggle button + breadcrumb navigation
 * - Center: Search command palette (hidden on mobile)
 * - Right: Notification dropdown + theme toggle
 * 
 * BREADCRUMB LOGIC:
 * - Always shows Overview as home
 * - Shows section name (Main, Analysis, Management) when applicable
 * - Shows current page with icon
 * 
 * ROUTE CONFIG:
 * Maps each route path to its label, section, and icon for display.
 * =============================================================================
 */
"use client"

import {
  LayoutDashboard,
  ShieldCheck,
  Globe,
  BarChart3,
  Eye,
  FileText,
  ListChecks,
  Link as LinkIcon,
  Settings,
  HelpCircle
} from "lucide-react"
import { ThemeToggle } from "../theme-toggle"
import { Link, useLocation } from "react-router-dom"
import { NotificationDropdown } from "./notifications"
import { SearchCommand } from "./search-command"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Route configuration with icons and section info
const routeConfig: Record<string, { label: string; section?: string; icon: React.ComponentType<{ className?: string }> }> = {
  '/overview': { label: 'Overview', icon: LayoutDashboard },
  '/privacy-score': { label: 'Privacy Score', section: 'Main', icon: ShieldCheck },
  '/website-safety': { label: 'Website Safety', section: 'Analysis', icon: Globe },
  '/sites': { label: 'Sites Analyzed', section: 'Analysis', icon: BarChart3 },
  '/trackers': { label: 'Trackers', section: 'Analysis', icon: Eye },
  '/activity-logs': { label: 'Activity Logs', section: 'Analysis', icon: FileText },
  '/whitelist-blacklist': { label: 'Domain Lists', section: 'Management', icon: ListChecks },
  '/integrations': { label: 'Integrations', section: 'Management', icon: LinkIcon },
  '/settings': { label: 'Settings', icon: Settings },
  '/help': { label: 'Help', icon: HelpCircle },
}

export default function TopNav() {
  const location = useLocation()
  const currentRoute = routeConfig[location.pathname]
  const currentLabel = currentRoute?.label || 'Overview'
  const CurrentIcon = currentRoute?.icon || LayoutDashboard
  const section = currentRoute?.section

  return (
    <div className="flex items-center justify-between h-full w-full px-4 lg:px-6">
      {/* Left side - Sidebar toggle and Breadcrumbs */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />

        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            {/* Home/Overview link - hidden on mobile */}
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link to="/overview" className="flex items-center gap-1.5">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Overview
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {/* If we have a section and we're not on overview, show section */}
            {location.pathname !== '/overview' && section && (
              <>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="hidden lg:block">
                  <span className="text-muted-foreground text-sm">
                    {section}
                  </span>
                </BreadcrumbItem>
              </>
            )}

            {/* Current page */}
            {location.pathname !== '/overview' && (
              <>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-1.5">
                    <CurrentIcon className="h-3.5 w-3.5" />
                    {currentLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <SearchCommand />
      </div>

      {/* Right side - Notifications, Theme */}
      <div className="flex items-center space-x-2">
        {/* Notifications */}
        <NotificationDropdown />

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </div>
  )
}
