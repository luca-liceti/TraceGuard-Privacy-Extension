/**
 * =============================================================================
 * TAILWIND CSS CONFIGURATION - Design System Setup
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * Tailwind CSS is a utility-first CSS framework. This config customizes
 * Tailwind for TraceGuard's design system - colors, spacing, etc.
 * 
 * KEY SETTINGS:
 * - darkMode: Uses CSS class to toggle dark mode (not system preference)
 * - content: Tells Tailwind which files to scan for class names
 * - theme.extend: Adds custom design tokens (colors, border radius, etc.)
 * 
 * CSS VARIABLES:
 * Most colors reference CSS variables (like var(--primary)) defined in
 * globals.css. This allows the theme to change dynamically for dark mode.
 * 
 * DESIGN TOKENS:
 * - primary: Main brand color (used for buttons, links)
 * - secondary: Supporting color
 * - muted: Subdued elements (disabled states, backgrounds)
 * - destructive: Danger/warning color (delete buttons)
 * - sidebar: Special colors for the navigation sidebar
 * - chart: Colors for data visualization charts
 * 
 * PLUGINS:
 * - tailwindcss-animate: Adds animation utilities for smooth transitions
 * =============================================================================
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: [
		'./src/**/*.{ts,tsx,js,jsx}',
	],
	theme: {
		extend: {
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			colors: {
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)'
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)'
				},
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)'
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)'
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)'
				},
				border: 'var(--border)',
				input: 'var(--input)',
				ring: 'var(--ring)',
				chart: {
					'1': 'var(--chart-1)',
					'2': 'var(--chart-2)',
					'3': 'var(--chart-3)',
					'4': 'var(--chart-4)',
					'5': 'var(--chart-5)'
				},
				sidebar: {
					DEFAULT: 'var(--sidebar-background)',
					foreground: 'var(--sidebar-foreground)',
					primary: 'var(--sidebar-primary)',
					'primary-foreground': 'var(--sidebar-primary-foreground)',
					accent: 'var(--sidebar-accent)',
					'accent-foreground': 'var(--sidebar-accent-foreground)',
					border: 'var(--sidebar-border)',
					ring: 'var(--sidebar-ring)'
				}
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}
