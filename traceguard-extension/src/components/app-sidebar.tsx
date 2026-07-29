import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  LayoutDashboard,
  BarChart,
  ShieldAlert,
  SlidersHorizontal,
  Shield,
} from "lucide-react"

import { useSettingsModal } from "@/components/traceguard/settings-context"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
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
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
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
    {
      title: "Settings",
      url: "#",
      icon: SlidersHorizontal,
      isActive: true,
      items: [
        { title: "Appearance", url: "#appearance" },
        { title: "Privacy", url: "#privacy" },
        { title: "Notifications", url: "#notifications" },
        { title: "Allow/Block Sites", url: "#domain-lists" },
        { title: "Data", url: "#data" },
        { title: "About", url: "#about" },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const { setSettingsOpen, setActiveTab } = useSettingsModal()

  const navMain = data.navMain.map(item => {
    if (item.title === "Settings") {
      return { 
        ...item, 
        onClick: () => setSettingsOpen(true),
        items: item.items?.map(subItem => ({
          ...subItem,
          onClick: () => {
            setActiveTab(subItem.url.replace("#", ""))
            setSettingsOpen(true)
          }
        }))
      }
    }
    return item
  })

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center">
                <Shield className="size-6 text-foreground" />
              </div>
              <div className="flex flex-1 items-center text-left text-sm leading-tight ml-1">
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
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
