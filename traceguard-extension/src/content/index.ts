import { analyzePage } from './analyzer';
import { piiDetector } from './pii-detector';

console.log('TraceGuard Content Script Loaded');

// Run analysis asynchronously
(async () => {
    try {
        const result = await analyzePage();

        // Start PII monitoring on detected sensitive fields
        piiDetector.startMonitoring(result.sensitiveFields);

        // Send results to background
        await chrome.runtime.sendMessage({
            type: 'PAGE_ANALYSIS_RESULT',
            url: window.location.href,
            scores: result.scores,
            detectionDetails: result.detectionDetails
        }).catch(() => {
            // Ignore errors if background is not listening yet
        });
    } catch (error) {
        console.error('TraceGuard analysis failed:', error);
    }
})();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    piiDetector.stopMonitoring();
});

// Listen for toast notifications from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SHOW_TOAST') {
        const { title, message: toastMessage, variant } = message.data;

        // Note: Sonner toasts require React context which isn't available in content scripts
        // For now, we'll log to console. In a full implementation, we'd inject a toast overlay
        console.log(`[TraceGuard ${variant?.toUpperCase() || 'INFO'}] ${title}: ${toastMessage}`);

        // TODO: Inject a lightweight toast overlay into the page DOM
        // This would require creating a shadow DOM element with the toast UI

        sendResponse({ success: true });
    }
    return true;
});

