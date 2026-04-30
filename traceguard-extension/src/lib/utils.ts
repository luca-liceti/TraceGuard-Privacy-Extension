/**
 * =============================================================================
 * UTILITY FUNCTIONS - Small Helpers Used Everywhere
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file contains small utility functions that are used in many places
 * throughout the application. Think of them as handy tools in a toolbox.
 * 
 * THE cn() FUNCTION:
 * "cn" stands for "classNames" - it helps combine CSS class names together.
 * This is particularly useful when using TailwindCSS where you might have:
 * - Base classes that always apply
 * - Conditional classes that only apply sometimes
 * 
 * EXAMPLE:
 * cn("button", isPrimary && "bg-blue-500", isDisabled && "opacity-50")
 * → "button bg-blue-500" (if isPrimary is true, isDisabled is false)
 * 
 * It also handles conflicting Tailwind classes (e.g., "p-2 p-4" → "p-4")
 * =============================================================================
 */

import { type ClassValue, clsx } from "clsx"       // Combines class names
import { twMerge } from "tailwind-merge"           // Handles Tailwind conflicts

/**
 * Combines multiple class names into a single string.
 * Also intelligently merges Tailwind CSS classes to avoid conflicts.
 * 
 * @param inputs - Any number of class values (strings, arrays, objects, etc.)
 * @returns A single string with all the combined classes
 * 
 * EXAMPLES:
 * cn("foo", "bar")           → "foo bar"
 * cn("foo", false && "bar")  → "foo"
 * cn("p-2", "p-4")           → "p-4" (Tailwind merge removes conflict)
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// =============================================================================
// TIME FORMATTING
// =============================================================================

/**
 * Convert a timestamp to a human-readable "time ago" format.
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Human-readable string like "Just now", "5m ago", "2h ago", "3d ago"
 * 
 * EXAMPLES:
 * - 30 seconds ago → "Just now"
 * - 5 minutes ago → "5m ago"
 * - 2 hours ago → "2h ago"
 * - 3 days ago → "3d ago"
 * - 2 weeks ago → "Dec 5, 2024" (actual date)
 */
export function formatTimeAgo(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    // For older dates, show the actual date
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: new Date(timestamp).getFullYear() !== new Date().getFullYear()
            ? 'numeric'
            : undefined
    })
}

/**
 * Format a date for display in logs and lists.
 * 
 * @param timestamp - Unix timestamp or Date object
 * @returns Formatted date string
 */
export function formatDate(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })
}

/**
 * Format a date with time for detailed displays.
 * 
 * @param timestamp - Unix timestamp or Date object
 * @returns Formatted datetime string
 */
export function formatDateTime(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })
}
