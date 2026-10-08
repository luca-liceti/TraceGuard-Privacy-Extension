import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  LayoutGrid,
  BarChart2,
  Footprints,
  ShieldUser,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavFooter } from "@/components/nav-footer"
import { useLocation } from "react-router-dom"
import { useUserName, useAppState } from "@/lib/useStorage"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

// This is the dashboard data
const data = {
  navMain: [
    {
      title: "Overview",
      url: "#/overview",
      icon: LayoutGrid,
      isActive: false,
    },
    {
      title: "Your Footprint",
      url: "#/exposure",
      icon: Footprints,
      isActive: false,
    },
    {
      title: "Rankings & Stats",
      url: "#/rankings",
      icon: BarChart2,
      isActive: false,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const userName = useUserName()
  // A plain fact, not a welcome-back nudge: the project's rules say return
  // frequency is not a goal, so the sidebar shows what was analyzed instead of
  // inviting the user to come back.
  const appState = useAppState()
  const sitesAnalyzed = appState?.sitesAnalyzed ?? 0

  const location = useLocation()

  const navItems = React.useMemo(() => {
    return data.navMain.map(item => ({
      ...item,
      isActive: location.pathname.includes(item.url.replace("#", ""))
    }))
  }, [location.pathname])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center group-data-[state=expanded]:-ml-2 group-data-[state=expanded]:-mr-2">
                <ShieldUser className="size-6 text-foreground" />
              </div>
              <div className="flex flex-1 items-center text-left text-sm leading-tight">
                <span className="truncate font-semibold text-lg text-foreground">
                  {t("TraceGuard")}
                </span>
                <span className="truncate font-semibold text-lg text-muted-foreground ml-1">
                  {t("Dashboard")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {sitesAnalyzed > 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground font-medium group-data-[state=collapsed]:hidden">
            {t("{{count}} sites analyzed", { count: sitesAnalyzed })}
          </div>
        )}
        <NavFooter user={{ name: userName || t("User"), email: "TraceGuard Vault" }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
