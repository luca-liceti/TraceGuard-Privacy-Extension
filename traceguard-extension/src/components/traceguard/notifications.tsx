/**
 * =============================================================================
 * NOTIFICATIONS DROPDOWN - Alert Center
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This component shows the notification bell icon in the header. When clicked,
 * it shows a dropdown with all your recent privacy alerts and warnings.
 * 
 * NOTIFICATION TYPES (shown with different icons):
 * - Critical (Red triangle): Severe security issues
 * - Warning (Orange circle): Moderate concerns
 * - Info (Blue circle): General updates
 * 
 * FEATURES:
 * - Badge showing unread count (up to 99+)
 * - Click notification to navigate to relevant page
 * - "Mark all read" button to clear unread status
 * - Remove individual notifications with X button
 * - Scrollable list showing up to 10 recent notifications
 * - Empty state with helpful message
 * 
 * DATA SOURCE:
 * Uses useNotifications() hook which reads from chrome.storage.local
 * and provides methods to mark as read or remove notifications.
 * 
 * TIME FORMAT:
 * Shows relative time: "Just now", "5m ago", "2h ago", "3d ago"
 * =============================================================================
 */
"use client"

import { useNavigate } from "react-router-dom"
import { Bell, Check, AlertTriangle, AlertCircle, Info, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/lib/useStorage"
import { NotificationEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatTimeAgo(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
}

function getSeverityIcon(severity: NotificationEvent['severity']) {
    switch (severity) {
        case 'critical':
            return <AlertTriangle className="h-4 w-4 text-red-500" />
        case 'warning':
            return <AlertCircle className="h-4 w-4 text-yellow-500" />
        case 'info':
        default:
            return <Info className="h-4 w-4 text-blue-500" />
    }
}

function getSeverityDot(severity: NotificationEvent['severity']) {
    switch (severity) {
        case 'critical':
            return 'bg-red-500'
        case 'warning':
            return 'bg-yellow-500'
        case 'info':
        default:
            return 'bg-blue-500'
    }
}

export function NotificationDropdown() {
    const navigate = useNavigate()
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification
    } = useNotifications()

    const handleNotificationClick = async (notification: NotificationEvent) => {
        // Mark as read
        await markAsRead(notification.id)

        // Navigate if there's an action URL
        if (notification.actionUrl) {
            navigate(notification.actionUrl)
        }
    }

    const recentNotifications = notifications.slice(0, 10)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative p-2">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white border-0"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between py-2">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2 text-xs"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                markAllAsRead()
                            }}
                        >
                            <Check className="h-3 w-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {recentNotifications.length > 0 ? (
                    <ScrollArea className="h-[300px]">
                        {recentNotifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className={cn(
                                    "flex items-start gap-2 p-3 cursor-pointer relative group",
                                    !notification.read && "bg-accent/50"
                                )}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    {getSeverityIcon(notification.severity)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={cn(
                                            "text-sm truncate",
                                            !notification.read && "font-medium"
                                        )}>
                                            {notification.title}
                                        </p>
                                        {!notification.read && (
                                            <span className={cn(
                                                "h-2 w-2 rounded-full flex-shrink-0",
                                                getSeverityDot(notification.severity)
                                            )} />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                        {notification.message}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1.5">
                                        {formatTimeAgo(notification.timestamp)}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        removeNotification(notification.id)
                                    }}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuItem>
                        ))}
                    </ScrollArea>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notifications yet</p>
                        <p className="text-xs mt-1">
                            You'll see alerts for risky sites and PII detection here
                        </p>
                    </div>
                )}

                {recentNotifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="justify-center text-primary cursor-pointer"
                            onClick={() => navigate('/activity-logs')}
                        >
                            View all activity
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default NotificationDropdown
