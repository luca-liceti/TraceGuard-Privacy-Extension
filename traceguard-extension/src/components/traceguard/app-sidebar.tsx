"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
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
    ChevronRight,
    type LucideIcon,
} from "lucide-react"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "@/components/ui/sidebar"

// Menu data structure
interface NavItem {
    id: string
    title: string
    url?: string
    icon: LucideIcon
    isNew?: boolean
    badge?: string
    items?: {
        id: string
        title: string
        url: string
    }[]
}

interface NavSection {
    id: string
    label: string
    items: NavItem[]
}

const navSections: NavSection[] = [
    {
        id: "main",
        label: "Main",
        items: [
            {
                id: "overview",
                title: "Overview",
                url: "/overview",
                icon: LayoutDashboard,
            },
            {
                id: "privacy-score",
                title: "Privacy Score",
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
                url: "/website-safety",
                icon: Globe,
            },
            {
                id: "sites",
                title: "Sites Analyzed",
                url: "/sites",
                icon: BarChart3,
            },
            {
                id: "trackers",
                title: "Trackers",
                url: "/trackers",
                icon: Eye,
            },
            {
                id: "activity-logs",
                title: "Activity Logs",
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
                url: "/whitelist-blacklist",
                icon: ListChecks,
            },
            {
                id: "integrations",
                title: "Integrations",
                url: "/integrations",
                icon: LinkIcon,
                isNew: true,
            },
        ],
    },
]

const footerItems: NavItem[] = [
    {
        id: "settings",
        title: "Settings",
        url: "/settings",
        icon: Settings,
    },
    {
        id: "help",
        title: "Help",
        url: "/help",
        icon: HelpCircle,
    },
]

function NavMain({ sections }: { sections: NavSection[] }) {
    const location = useLocation()

    return (
        <>
            {sections.map((section) => (
                <SidebarGroup key={section.id}>
                    <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                    <SidebarMenu>
                        {section.items.map((item) => {
                            const isActive = location.pathname === item.url
                            const hasSubItems = item.items && item.items.length > 0

                            if (hasSubItems) {
                                return (
                                    <Collapsible
                                        key={item.id}
                                        asChild
                                        defaultOpen={item.items?.some(
                                            (subItem) => location.pathname === subItem.url
                                        )}
                                        className="group/collapsible"
                                    >
                                        <SidebarMenuItem>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuButton tooltip={item.title}>
                                                    <item.icon />
                                                    <span>{item.title}</span>
                                                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    {item.items?.map((subItem) => (
                                                        <SidebarMenuSubItem key={subItem.id}>
                                                            <SidebarMenuSubButton
                                                                asChild
                                                                isActive={location.pathname === subItem.url}
                                                            >
                                                                <Link to={subItem.url}>
                                                                    <span>{subItem.title}</span>
                                                                </Link>
                                                            </SidebarMenuSubButton>
                                                        </SidebarMenuSubItem>
                                                    ))}
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </SidebarMenuItem>
                                    </Collapsible>
                                )
                            }

                            return (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive}
                                        tooltip={item.title}
                                    >
                                        <Link to={item.url || "#"}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    {item.isNew && (
                                        <SidebarMenuBadge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                            New
                                        </SidebarMenuBadge>
                                    )}
                                    {item.badge && (
                                        <SidebarMenuBadge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                            {item.badge}
                                        </SidebarMenuBadge>
                                    )}
                                </SidebarMenuItem>
                            )
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    )
}

function NavFooter({ items }: { items: NavItem[] }) {
    const location = useLocation()

    return (
        <SidebarMenu>
            {items.map((item) => {
                const isActive = location.pathname === item.url

                return (
                    <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                            <Link to={item.url || "#"}>
                                <item.icon />
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            })}
        </SidebarMenu>
    )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg" tooltip="TraceGuard" className="[&>svg]:!size-7">
                            <Link to="/">
                                <ShieldCheck />
                                <span className="text-lg font-bold">TraceGuard</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain sections={navSections} />
            </SidebarContent>
            <SidebarFooter>
                <NavFooter items={footerItems} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
