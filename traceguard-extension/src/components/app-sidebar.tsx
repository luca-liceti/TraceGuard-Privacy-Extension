import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  LayoutDashboard,
  BarChart,
  ShieldAlert,
  SlidersHorizontal,
  Shield,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavFooter } from "@/components/nav-footer"
import { useUserName } from "@/lib/useStorage"
import { TeamSwitcher } from "@/components/team-switcher"
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
      icon: LayoutDashboard,
      isActive: false,
    },
    {
      title: "Rankings & Stats",
      url: "#/rankings",
      icon: BarChart,
      isActive: false,
    },
    {
      title: "Website Safety",
      url: "#/website-safety",
      icon: ShieldAlert,
      isActive: false,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const userName = useUserName()
  const [greeting, setGreeting] = React.useState("")
  
  React.useEffect(() => {
    if (userName) {
      const g = [
        `Welcome back, ${userName} 👋`,
        `Ready to browse safely, ${userName}?`,
        `Good to see you, ${userName}`
      ]
      setGreeting(g[Math.floor(Math.random() * g.length)])
    }
  }, [userName])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center group-data-[state=expanded]:-ml-2 group-data-[state=expanded]:-mr-2">
                <Shield className="size-6 text-foreground" />
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        {greeting && (
          <div className="px-4 py-2 text-xs text-muted-foreground font-medium animate-in fade-in slide-in-from-bottom-2 duration-500">
            {greeting}
          </div>
        )}
        <NavFooter user={{ name: userName || "User", email: "TraceGuard Vault" }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
