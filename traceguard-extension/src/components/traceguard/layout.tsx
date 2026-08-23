/**
 * =============================================================================
 * LAYOUT COMPONENT - Main Dashboard Container
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the main layout wrapper for the TraceGuard dashboard. It provides
 * the consistent structure that appears on every page - the sidebar and header.
 * 
 * STRUCTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │ ┌─────────┐ ┌─────────────────────────────────────────┐ │
 * │ │         │ │ TopNav (header with breadcrumbs)        │ │
 * │ │ Sidebar │ ├─────────────────────────────────────────┤ │
 * │ │         │ │                                         │ │
 * │ │  App    │ │       { children } - Page Content       │ │
 * │ │ Sidebar │ │                                         │ │
 * │ │         │ │                                         │ │
 * │ └─────────┘ └─────────────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────┘
 * 
 * KEY FEATURES:
 * - Uses SidebarProvider for collapsible sidebar state
 * - Applies dark mode class based on theme
 * - Waits for client mount to avoid hydration mismatch
 * =============================================================================
 */
"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useAutoCollapseSidebar } from "@/hooks/use-auto-collapse-sidebar"

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Auto-collapse the sidebar when the window gets too small, expand when it
  // returns to a normal size (see useAutoCollapseSidebar).
  const [sidebarOpen, setSidebarOpen] = useAutoCollapseSidebar()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className={`flex min-h-screen w-full ${theme === "dark" ? "dark" : ""}`}>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col bg-background">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
