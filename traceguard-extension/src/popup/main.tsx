import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from '../sidepanel/App'
import { AuthProvider } from '@/components/traceguard/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { useSettings } from '@/lib/useStorage'
import { redirectToDashboardIfFirstRun } from '@/lib/first-run'
import '@/styles/globals.css'
import '@/lib/i18n'

console.log('Mounting Popup...');

function Root() {
    const settings = useSettings();
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        let cancelled = false;
        redirectToDashboardIfFirstRun()
            .then((redirected) => {
                if (cancelled) return;
                if (redirected) {
                    window.close();
                } else {
                    setShowPopup(true);
                }
            })
            .catch(() => {
                // If the check fails (e.g. storage unavailable), fall back to
                // the normal popup UI rather than leaving a blank window.
                if (!cancelled) setShowPopup(true);
            });
        return () => { cancelled = true; };
    }, []);

    if (!showPopup) {
        // Blank while we check for first run; popups are transient so the
        // flash is imperceptible.
        return null;
    }

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

try {
    const rootElement = document.getElementById('root');
    console.log('Root element:', rootElement);

    if (!rootElement) {
        console.error('Failed to find root element');
    } else {
        ReactDOM.createRoot(rootElement).render(
            <React.StrictMode>
                <ErrorBoundary>
                    <Root />
                </ErrorBoundary>
            </React.StrictMode>,
        )
        console.log('Popup mounted');
    }
} catch (error) {
    console.error('Error mounting popup:', error);
}
