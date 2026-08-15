"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import { CircleCheck, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      gap={12}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-[var(--radius)]",
          title: "group-[.toast]:text-sm group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:hover:bg-muted",
        },
        icons: {
          success: <CircleCheck className="h-4 w-4 text-success" />,
          info: <Info className="h-4 w-4 text-primary" />,
          warning: <AlertTriangle className="h-4 w-4 text-warning" />,
          error: <XCircle className="h-4 w-4 text-destructive" />,
          loading: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
