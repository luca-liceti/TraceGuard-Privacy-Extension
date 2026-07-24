"use client"

import { useTranslation } from "react-i18next"
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import {
  Check,
  ChevronsUpDown,
  ExternalLink,
  Globe,
  HelpCircle,
  Info,
  LogOut,
  Settings,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { t, i18n } = useTranslation()
  const { toast } = useToast()

  const languages = [
    { code: "en", name: "English (United States)" },
    { code: "fr", name: "Français (France)" },
    { code: "de", name: "Deutsch (Deutschland)" },
    { code: "es", name: "Español (España)" },
  ]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "top"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Settings />
                {t("Settings")}
                <DropdownMenuShortcut>Ctrl ⇧ ,</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Globe />
                  <span>{t("Language")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => {
                          const oldLanguage = i18n.language;
                          i18n.changeLanguage(lang.code);
                          toast({
                            description: t("Language changed successfully."),
                            action: (
                              <ToastAction altText={t("Undo")} onClick={() => i18n.changeLanguage(oldLanguage)}>
                                {t("Undo")}
                              </ToastAction>
                            ),
                          });
                        }}
                      >
                        <span>{lang.name}</span>
                        {i18n.language === lang.code && (
                          <Check className="ml-auto text-blue-500" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem>
                <HelpCircle />
                {t("Get help")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Info />
                  <span>{t("Learn more")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <span>{t("About Anthropic")}</span>
                      <ExternalLink className="ml-auto opacity-50" />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <span>{t("Tutorials")}</span>
                      <ExternalLink className="ml-auto opacity-50" />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <span>{t("Courses")}</span>
                      <ExternalLink className="ml-auto opacity-50" />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <span>{t("Usage policy")}</span>
                      <ExternalLink className="ml-auto opacity-50" />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <span>{t("Privacy policy")}</span>
                      <ExternalLink className="ml-auto opacity-50" />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <span>{t("Your privacy choices")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <span>{t("Keyboard shortcuts")}</span>
                      <DropdownMenuShortcut>Ctrl /</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              {t("Log out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
