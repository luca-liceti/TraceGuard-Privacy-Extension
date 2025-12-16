import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Toaster } from 'sonner'
import Layout from "@/components/traceguard/layout"
import Content from "@/components/traceguard/content"
import { useSettings } from "@/lib/useStorage"

// Import detail pages
import PrivacyScorePage from "@/components/traceguard/pages/privacy-score"
import WebsiteSafetyPage from "@/components/traceguard/pages/website-safety"
import SitesAnalyzedPage from "@/components/traceguard/pages/sites-analyzed"
import TrackersPage from "@/components/traceguard/pages/trackers"
import ActivityLogsPage from "@/components/traceguard/pages/activity-logs"
import WhitelistBlacklistPage from "@/components/traceguard/pages/whitelist-blacklist"
import SettingsPage from "@/components/traceguard/pages/settings"

// Dashboard Page Wrapper
function Dashboard() {
    return (
        <Layout>
            <Content />
        </Layout>
    )
}

// Detail Page Wrapper
function DetailPage({ children }: { children: React.ReactNode }) {
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
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Privacy & Security Pages */}
                    <Route path="/privacy-score" element={<DetailPage><PrivacyScorePage /></DetailPage>} />
                    <Route path="/website-safety" element={<DetailPage><WebsiteSafetyPage /></DetailPage>} />
                    <Route path="/sites" element={<DetailPage><SitesAnalyzedPage /></DetailPage>} />
                    <Route path="/trackers" element={<DetailPage><TrackersPage /></DetailPage>} />
                    <Route path="/activity-logs" element={<DetailPage><ActivityLogsPage /></DetailPage>} />

                    {/* Management Pages */}
                    <Route path="/whitelist-blacklist" element={<DetailPage><WhitelistBlacklistPage /></DetailPage>} />
                    <Route path="/settings" element={<DetailPage><SettingsPage /></DetailPage>} />
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
