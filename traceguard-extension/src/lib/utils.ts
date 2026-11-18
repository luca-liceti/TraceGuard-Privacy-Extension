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

/**
 * Check if a hostname is a local address (e.g., localhost, 127.0.0.1, 192.168.x.x)
 * 
 * @param hostname - The hostname to check
 * @returns true if the hostname is a local address, false otherwise
 */
export function isLocalAddress(hostname: string): boolean {
    if (!hostname) return false;
    
    return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.test') ||
        hostname.endsWith('.example') ||
        hostname.endsWith('.invalid') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    );
}

/**
 * Check if a full URL should be considered local/internal and excluded from scanning.
 * 
 * @param urlString - The full URL to check
 * @returns true if the URL is local or internal, false otherwise
 */
export function isLocalUrl(urlString: string): boolean {
    if (!urlString) return false;
    
    try {
        const url = new URL(urlString);
        
        // Check protocols that are internal/local
        if (
            url.protocol === 'chrome:' || 
            url.protocol === 'chrome-extension:' || 
            url.protocol === 'about:' || 
            url.protocol === 'file:' ||
            url.protocol === 'moz-extension:' ||
            url.protocol === 'edge:'
        ) {
            return true;
        }
        
        // Check hostname for local network/development addresses
        return isLocalAddress(url.hostname);
    } catch {
        // If it's an invalid URL, we can't reliably scan it anyway
        return true; 
    }
}

/**
 * fetch() with a timeout. MV3 service workers have no default network timeout;
 * a hung connection can stall page analysis or block the event loop. Uses
 * AbortController to abort after `timeoutMs` (default 8s).
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}
