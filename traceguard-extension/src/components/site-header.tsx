import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTranslation } from "react-i18next"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationDropdown } from "@/components/traceguard/notifications"
import { SearchCommand } from "@/components/traceguard/search-command"

export function SiteHeader() {
  const { t } = useTranslation()
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 md:gap-2 md:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="hidden sm:block"><SearchCommand /></div>
        <div className="ml-auto flex items-center gap-2">
          <NotificationDropdown />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
