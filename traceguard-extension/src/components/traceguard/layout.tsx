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
import { AppSidebar } from "./app-sidebar"
import TopNav from "./top-nav"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <SidebarProvider>
      <div className={`flex min-h-screen w-full ${theme === "dark" ? "dark" : ""}`}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border">
            <TopNav />
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
