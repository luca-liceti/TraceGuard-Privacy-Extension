import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import Layout from "@/components/traceguard/layout"
import { useSettings } from "@/lib/useStorage"
import { AuthProvider } from "@/components/traceguard/auth-provider"

// Import pages
import OverviewPage from "@/components/traceguard/pages/overview"
import PrivacyScorePage from "@/components/traceguard/pages/privacy-score"

import HelpPage from "@/components/traceguard/pages/help"
import RankingsPage from "@/components/traceguard/pages/rankings"
import PrivacyPolicyPage from "@/components/traceguard/pages/privacy-policy"
import { SettingsProvider } from "@/components/traceguard/settings-context"
import { SettingsModal } from "@/components/traceguard/settings-modal"

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
            <Toaster />
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


                    {/* Management Pages */}
                    <Route path="/rankings" element={<PageWrapper><RankingsPage /></PageWrapper>} />
                    <Route path="/help" element={<PageWrapper><HelpPage /></PageWrapper>} />
                    <Route path="/privacy-policy" element={<PageWrapper><PrivacyPolicyPage /></PageWrapper>} />
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
            <AuthProvider>
                <SettingsProvider>
                    <AppContent />
                    <SettingsModal />
                </SettingsProvider>
            </AuthProvider>
        </ThemeProvider>
    )
}

export default App

