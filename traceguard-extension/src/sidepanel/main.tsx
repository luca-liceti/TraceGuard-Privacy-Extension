import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from './App'
import { AuthProvider } from '@/components/traceguard/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { useSettings } from '@/lib/useStorage'
import { redirectToDashboardIfFirstRun } from '@/lib/first-run'
import { Button } from '@/components/ui/button'
import { ShieldUser } from 'lucide-react'
import '@/styles/globals.css'
import '@/lib/i18n'

console.log('Mounting Sidepanel...');

/**
 * First-run UX: like the popup, a fresh install opens the full dashboard tab
 * (account creation) instead of the side panel. The panel shows a minimal
 * placeholder until the vault is created in that tab - the storage listener
 * below then swaps in the normal app without needing a reopen.
 */
function Root() {
    const settings = useSettings();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            try {
                const redirected = await redirectToDashboardIfFirstRun();
                if (!cancelled) setReady(!redirected);
            } catch {
                // If the check fails (e.g. storage unavailable), fall back to
                // the normal panel UI rather than leaving a placeholder.
                if (!cancelled) setReady(true);
            }
        };
        check();

        // The vault is created in the dashboard tab (cryptoSalt/validator are
        // written to local storage); react so the panel switches to the app.
        const listener = (changes: any, namespace: string) => {
            if (namespace === 'local' && (changes.cryptoSalt || changes.validator)) {
                check();
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    if (!ready) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center text-sm text-muted-foreground">
                <ShieldUser className="h-8 w-8 text-foreground" />
                <p>Create your TraceGuard vault to get started.</p>
                <Button
                    size="sm"
                    onClick={() => {
                        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
                    }}
                >
                    Open dashboard
                </Button>
            </div>
        );
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
        console.log('Sidepanel mounted');
    }
} catch (error) {
    console.error('Error mounting sidepanel:', error);
}
