import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from './App'
import { AuthProvider } from '@/components/traceguard/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { useSettings } from '@/lib/useStorage'
import { redirectToDashboardIfFirstRun } from '@/lib/first-run'
import '@/styles/globals.css'
import '@/lib/i18n'
import { captureError, installGlobalErrorHandlers, logEvent, setDiagnosticContext, syncDevModeFromSettings } from '@/lib/diagnostics'

// Capture uncaught errors thrown anywhere in the side panel context.
installGlobalErrorHandlers()
setDiagnosticContext('sidepanel')
void syncDevModeFromSettings()

/**
 * First-run UX: like the popup, a fresh install opens the full dashboard tab
 * (account creation) instead of the side panel. The panel renders immediately
 * while setup continues in that tab.
 */
function Root() {
    const settings = useSettings();
    useEffect(() => {
        const check = async () => {
            try {
                await redirectToDashboardIfFirstRun();
            } catch (error) {
                // If the check fails (e.g. storage unavailable), keep the
                // app visible and report the expected storage failure.
                logEvent('sidepanel', 'warn', 'first_run_check_failed', 'Could not check first-run state', { error: String(error) });
            }
        };
        check();
    }, []);

    return (
        <ThemeProvider
            key={settings?.theme || "system"}
            attribute="class"
            defaultTheme={settings?.theme || "system"}
            enableSystem={true}
            disableTransitionOnChange
        >
            <AuthProvider>
                <App />
            </AuthProvider>
        </ThemeProvider>
    );
}

/** The mounted root, exported so the entry test can unmount it and stop
 *  pending React work from firing after the test environment is torn down. */
export let root: Root | null = null

try {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
        logEvent('sidepanel', 'error', 'sidepanel_root_missing', 'Could not find the side panel root element');
    } else {
        const mounted = ReactDOM.createRoot(rootElement)
        root = mounted
        mounted.render(
            <React.StrictMode>
                <ErrorBoundary>
                    <Root />
                </ErrorBoundary>
            </React.StrictMode>,
        )
    }
} catch (error) {
    captureError('sidepanel', error, 'sidepanel_mount_failed');
}
