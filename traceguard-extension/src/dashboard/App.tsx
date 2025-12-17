import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Toaster } from 'sonner'
import Layout from "@/components/traceguard/layout"
import { useSettings } from "@/lib/useStorage"

// Import pages
import OverviewPage from "@/components/traceguard/pages/overview"
import PrivacyScorePage from "@/components/traceguard/pages/privacy-score"
import WebsiteSafetyPage from "@/components/traceguard/pages/website-safety"
import SitesAnalyzedPage from "@/components/traceguard/pages/sites-analyzed"
import TrackersPage from "@/components/traceguard/pages/trackers"
import ActivityLogsPage from "@/components/traceguard/pages/activity-logs"
import WhitelistBlacklistPage from "@/components/traceguard/pages/whitelist-blacklist"
import IntegrationsPage from "@/components/traceguard/pages/integrations"
import SettingsPage from "@/components/traceguard/pages/settings"
import HelpPage from "@/components/traceguard/pages/help"

// Page Wrapper
function PageWrapper({ children }: { children: React.ReactNode }) {
    return (
        <Layout>
            {children}
        </Layout>
    )
}

function AppContent() {
    const { theme } = useTheme()

    return (
        <>
            <Toaster
                theme={theme as "light" | "dark" | "system"}
                position="top-right"
                expand={false}
                richColors
                closeButton
                duration={4000}
                dir="ltr"
                toastOptions={{
                    unstyled: false,
                    classNames: {
                        toast: 'group toast',
                        closeButton: '!right-3 !left-auto !top-3 !absolute',
                    },
                    style: {
                        animation: 'slideInFromRight 0.3s ease-out',
                    },
                }}
            />
            <Router>
                <Routes>
                    {/* Default route - redirect to Overview */}
                    <Route path="/" element={<Navigate to="/overview" replace />} />

                    {/* Main Overview (Landing Page) */}
                    <Route path="/overview" element={<PageWrapper><OverviewPage /></PageWrapper>} />

                    {/* Legacy dashboard route - redirect to overview */}
                    <Route path="/dashboard" element={<Navigate to="/overview" replace />} />

                    {/* Privacy & Security Pages */}
                    <Route path="/privacy-score" element={<PageWrapper><PrivacyScorePage /></PageWrapper>} />
                    <Route path="/website-safety" element={<PageWrapper><WebsiteSafetyPage /></PageWrapper>} />
                    <Route path="/sites" element={<PageWrapper><SitesAnalyzedPage /></PageWrapper>} />
                    <Route path="/trackers" element={<PageWrapper><TrackersPage /></PageWrapper>} />
                    <Route path="/activity-logs" element={<PageWrapper><ActivityLogsPage /></PageWrapper>} />

                    {/* Management Pages */}
                    <Route path="/whitelist-blacklist" element={<PageWrapper><WhitelistBlacklistPage /></PageWrapper>} />
                    <Route path="/integrations" element={<PageWrapper><IntegrationsPage /></PageWrapper>} />
                    <Route path="/settings" element={<PageWrapper><SettingsPage /></PageWrapper>} />
                    <Route path="/help" element={<PageWrapper><HelpPage /></PageWrapper>} />
                </Routes>
            </Router>
        </>
    )
}

function App() {
    const settings = useSettings();

    return (
        <ThemeProvider
            key={settings?.theme || "system"}
            attribute="class"
            defaultTheme={settings?.theme || "system"}
            enableSystem={true}
            disableTransitionOnChange
        >
            <AppContent />
        </ThemeProvider>
    )
}

export default App

