"use client"

import { Menu, Search, Bell, ChevronDown, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "../theme-toggle"
import { Link } from "react-router-dom"
import { useState } from "react"

export default function TopNav() {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [privacyMode, setPrivacyMode] = useState<'standard' | 'strict' | 'custom'>('standard')

  const handleMenuToggle = () => {
    if (typeof window !== "undefined" && (window as any).toggleMenuState) {
      ; (window as any).toggleMenuState()
    }
  }

  const handleMobileMenuToggle = () => {
    if (typeof window !== "undefined" && (window as any).setIsMobileMenuOpen) {
      const currentState = (window as any).isMobileMenuOpen || false
        ; (window as any).setIsMobileMenuOpen(!currentState)
    }
  }

  // Privacy mode configuration
  const privacyModeConfig = {
    standard: {
      label: 'Standard Mode',
      description: 'Balanced privacy protection for everyday browsing',
      dotColor: 'bg-green-500'
    },
    strict: {
      label: 'Strict Mode',
      description: 'Maximum privacy protection for sensitive activities',
      dotColor: 'bg-red-500'
    },
    custom: {
      label: 'Custom Mode',
      description: 'User-defined privacy settings',
      dotColor: 'bg-orange-500'
    }
  }

  const currentMode = privacyModeConfig[privacyMode]

  return (
    <>
      <div className="flex items-center justify-between h-full px-4 lg:px-6 relative">
        {/* Left side - Menu toggle and Breadcrumbs */}
        <div className="flex items-center space-x-4">
          {/* Desktop Menu Toggle */}
          <Button variant="ghost" size="sm" onClick={handleMenuToggle} className="hidden lg:flex p-2" title="Toggle Menu">
            <Menu className="h-4 w-4" />
          </Button>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMobileMenuToggle}
            className="lg:hidden p-2"
            title="Toggle Mobile Menu"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            <Link to="/dashboard" className="flex items-center hover:text-gray-900 dark:hover:text-white">
              <Home className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{"Overview"}</span>
          </nav>
        </div>

        {/* Center - Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-10 bg-gray-50 dark:bg-black border-border dark:border-gray-700"
            />
          </div>
        </div>

        {/* Right side - Privacy Mode, Notifications, Theme */}
        <div className="flex items-center space-x-2">

          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden p-2"
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            title="Toggle Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Privacy Mode Toggle - PLACEHOLDER (to be implemented in Week 3 - Session 14) */}
          {/* TODO: Replace with actual Privacy Mode Dropdown component */}
          {/* See GAP_ANALYSIS_AND_MVP_PRIORITY.md - Privacy Mode Toggle section */}

          {/* Desktop: Full dropdown with dot + text */}
          <TooltipProvider>
            <Tooltip>
              <DropdownMenu>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden lg:flex items-center space-x-2 px-3 py-2 h-9 hover:bg-accent dark:hover:bg-accent"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${currentMode.dotColor}`} />
                      <span className="text-sm">{currentMode.label}</span>
                      <ChevronDown className="h-3 w-3 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm text-muted-foreground">{currentMode.description}</p>
                </TooltipContent>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setPrivacyMode('standard')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">Standard Mode</span>
                      <span className="text-xs text-muted-foreground">Balanced protection</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setPrivacyMode('strict')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">Strict Mode</span>
                      <span className="text-xs text-muted-foreground">Maximum protection</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setPrivacyMode('custom')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">Custom Mode</span>
                      <span className="text-xs text-muted-foreground">User-defined settings</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Tooltip>
          </TooltipProvider>

          {/* Mobile: Just the dot */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-2 h-9 w-9 hover:bg-accent dark:hover:bg-accent"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${currentMode.dotColor}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm text-muted-foreground">Privacy: {currentMode.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative p-2">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white">
              3
            </Badge>
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Search Input - positioned outside main flex container */}
      {isMobileSearchOpen && (
        <div className="absolute top-full left-0 right-0 z-50 p-4  border-b  md:hidden shadow-lg">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-10 bg-gray-50 dark:bg-black border-border dark:border-gray-700"
              autoFocus
            />
          </div>
        </div>
      )}
    </>
  )
}

