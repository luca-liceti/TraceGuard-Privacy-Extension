import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import type { Root as ReactRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from '../sidepanel/App'
import { AuthProvider } from '@/components/traceguard/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { useSettings } from '@/lib/useStorage'
import { redirectToDashboardIfFirstRun } from '@/lib/first-run'
import '@/styles/globals.css'
import '@/lib/i18n'
import { captureError, installGlobalErrorHandlers, logEvent, setDiagnosticContext, syncDevModeFromSettings } from '@/lib/diagnostics'

// Capture uncaught errors thrown anywhere in the popup context.
installGlobalErrorHandlers()
setDiagnosticContext('popup')
// The popup renders no settings UI of its own, so it has to read the developer
// mode flag itself or every verbose event it records is dropped.
void syncDevModeFromSettings()

function Root() {
    const settings = useSettings();
    useEffect(() => {
        let cancelled = false;
        redirectToDashboardIfFirstRun()
            .then((redirected) => {
                if (cancelled) return;
                if (redirected) {
                    window.close();
                }
            })
            .catch((error) => {
                // If the check fails (e.g. storage unavailable), fall back to
                // the normal popup UI rather than leaving a blank window.
                logEvent('popup', 'warn', 'first_run_check_failed', 'Could not check first-run state', { error: String(error) });
            });
        return () => { cancelled = true; };
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
                <App variant="popup" />
            </AuthProvider>
        </ThemeProvider>
    );
}

/** The mounted root, exported so the entry test can unmount it and stop
 *  pending React work from firing after the test environment is torn down. */
export let root: ReactRoot | null = null

try {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
        logEvent('popup', 'error', 'popup_root_missing', 'Could not find the popup root element');
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
    captureError('popup', error, 'popup_mount_failed');
}
