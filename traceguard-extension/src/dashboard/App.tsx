import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import Layout from "@/components/traceguard/layout"
import { useSettings } from "@/lib/useStorage"
import { AuthProvider } from "@/components/traceguard/auth-provider"

// Import pages
import OverviewPage from "@/components/traceguard/pages/overview"

import HelpPage from "@/components/traceguard/pages/help"
import RankingsPage from "@/components/traceguard/pages/rankings"
import PrivacyPolicyPage from "@/components/traceguard/pages/privacy-policy"
import { SettingsProvider, useSettingsModal } from "@/components/traceguard/settings-context"
import { SettingsModal } from "@/components/traceguard/settings-modal"

import { ErrorBoundary } from '@/components/ErrorBoundary'

// Page Wrapper
function PageWrapper({ children }: { children: React.ReactNode }) {
    return (
        <Layout>
            <ErrorBoundary>
                {children}
            </ErrorBoundary>
        </Layout>
    )
}

import { useEffect } from 'react'
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

// Deep-link: open the settings modal (e.g. from a notification) via ?openSettings=privacy.
// Must live inside <Router> because it uses useLocation().
function DeepLinkHandler() {
    const location = useLocation()
    const { setSettingsOpen, setActiveTab } = useSettingsModal()

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get('openSettings')) {
            setSettingsOpen(true)
            setActiveTab(params.get('openSettings') || 'privacy')
        }
    }, [location.search])

    return null
}

function AppContent() {
    const { theme } = useTheme()
    const { t } = useTranslation()

    useEffect(() => {
        const handleQuotaExceeded = () => {
            toast.error(t("Storage Full"), {
                description: t("You have reached the 5MB local storage limit. Please clear some logs or settings to save new data.")
            })
        }
        window.addEventListener('QUOTA_EXCEEDED', handleQuotaExceeded)
        
        const messageListener = (msg: any) => {
            if (msg?.type === 'QUOTA_EXCEEDED') handleQuotaExceeded();
        };
        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            window.removeEventListener('QUOTA_EXCEEDED', handleQuotaExceeded)
            chrome.runtime.onMessage.removeListener(messageListener);
        }
    }, [])

    return (
        <>
            <Toaster />
            <Router>
                <DeepLinkHandler />
                <Routes>
                    {/* Default route - redirect to Overview */}
                    <Route path="/" element={<Navigate to="/overview" replace />} />

                    {/* Main Overview (Landing Page) */}
                    <Route path="/overview" element={<PageWrapper><OverviewPage /></PageWrapper>} />

                    {/* Legacy dashboard route - redirect to overview */}
                    <Route path="/dashboard" element={<Navigate to="/overview" replace />} />

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

