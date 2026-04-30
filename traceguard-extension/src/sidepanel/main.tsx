import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from './App'
import { AuthProvider } from '@/components/traceguard/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { useSettings } from '@/lib/useStorage'
import '@/styles/globals.css'

console.log('Mounting Sidepanel...');

function Root() {
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
