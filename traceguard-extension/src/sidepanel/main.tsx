import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from './App'
import '@/styles/globals.css'

console.log('Mounting Sidepanel...');

try {
    const rootElement = document.getElementById('root');
    console.log('Root element:', rootElement);

    if (!rootElement) {
        console.error('Failed to find root element');
    } else {
        ReactDOM.createRoot(rootElement).render(
            <React.StrictMode>
                <ErrorBoundary>
                    <App />
                </ErrorBoundary>
            </React.StrictMode>,
        )
        console.log('Sidepanel mounted');
    }
} catch (error) {
    console.error('Error mounting sidepanel:', error);
}
