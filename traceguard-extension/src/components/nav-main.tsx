"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"


import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    onClick?: () => void
    items?: {
      title: string
      url: string
      onClick?: () => void
    }[]
  }[]
}) {
  const { t } = useTranslation()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("Platform")}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          if (item.items && item.items.length > 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={t(item.title)} onClick={item.onClick} asChild={!item.onClick}>
                  {item.onClick ? (
                    <>
                      {item.icon && <item.icon />}
                      <span>{t(item.title)}</span>
                    </>
                  ) : (
                    <a href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{t(item.title)}</span>
                    </a>
                  )}
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild onClick={subItem.onClick}>
                        <a href={subItem.url} onClick={(e) => {
                          if (subItem.onClick) {
                            e.preventDefault()
                            subItem.onClick()
                          }
                        }}>
                          <span>{t(subItem.title)}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            )
          }

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={t(item.title)} onClick={item.onClick} asChild={!item.onClick}>
                {item.onClick ? (
                  <>
                    {item.icon && <item.icon />}
                    <span>{t(item.title)}</span>
                  </>
                ) : (
                  <a href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{t(item.title)}</span>
                  </a>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
