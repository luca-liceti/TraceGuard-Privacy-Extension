import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from '../sidepanel/App'
import '@/styles/globals.css'

console.log('Mounting Popup...');

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
        console.log('Popup mounted');
    }
} catch (error) {
    console.error('Error mounting popup:', error);
}
