/**
 * =============================================================================
 * PII DETECTOR - Watching for Personal Information Entry
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file monitors sensitive input fields on webpages to detect when you
 * enter personal information (PII = Personally Identifiable Information).
 * 
 * IMPORTANT PRIVACY PROMISE:
 * We NEVER read or store what you actually type! We only detect THAT you typed
 * something in a sensitive field, not WHAT you typed. For example:
 * - ✅ We know: "User typed something in a password field on amazon.com"
 * - ❌ We DON'T know: "User typed 'MySecretPassword123'"
 * 
 * HOW IT WORKS:
 * 1. The analyzer finds sensitive input fields (password, email, credit card)
 * 2. This module attaches "input" listeners to those fields
 * 3. When you type in a field, we notify the background script
 * 4. The background script updates your privacy score accordingly
 * 5. When you leave the page, we clean up all the listeners
 * 
 * WHY THIS MATTERS:
 * Entering personal info on risky websites is a privacy concern. By tracking
 * this (without seeing your actual data), we can:
 * - Warn you when you're about to enter data on an unsafe site
 * - Track which sites have received your information
 * - Adjust your privacy score based on your data exposure
 * =============================================================================
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents a sensitive input field on the page that we should monitor.
 */
interface SensitiveField {
    element: HTMLInputElement | HTMLTextAreaElement;  // The HTML input element
    type: string;                                      // What kind of field
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';           // How sensitive is this?
}

/**
 * Data sent to the background script when PII entry is detected.
 * IMPORTANT: We send the field TYPE, not the field VALUE!
 */
interface PIIEvent {
    timestamp: number;                     // When the event happened
    site: string;                          // The website domain
    fieldType: string;                     // Type of field (password, text, etc.)
    fieldName: string;                     // Name attribute of the field
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW'; // How sensitive is this data?
    siteWRS: number;                       // Website Safety Score at the time
}

class PIIDetector {
    private monitoredFields: Map<string, {
        element: HTMLElement;
        sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
        handler: EventListener;
        triggered: boolean;
    }>;
    private detectionEvents: PIIEvent[];

    constructor() {
        this.monitoredFields = new Map();
        this.detectionEvents = [];
    }

    // Start monitoring sensitive fields
    startMonitoring(sensitiveFields: { high: SensitiveField[]; medium: SensitiveField[]; low: SensitiveField[] }) {
        // Monitor HIGH sensitivity fields
        sensitiveFields.high.forEach(field => {
            this.attachListener(field.element, 'HIGH');
        });

        // Monitor MEDIUM sensitivity fields
        sensitiveFields.medium.forEach(field => {
            this.attachListener(field.element, 'MEDIUM');
        });

        // Monitor LOW sensitivity fields
        sensitiveFields.low.forEach(field => {
            this.attachListener(field.element, 'LOW');
        });
    }

    private attachListener(element: HTMLInputElement | HTMLTextAreaElement, sensitivity: 'HIGH' | 'MEDIUM' | 'LOW') {
        // Don't read actual input values - just detect interaction
        const fieldId = this.generateFieldId(element);

        // Skip if already monitoring
        if (this.monitoredFields.has(fieldId)) return;

        const handler = (event: Event) => {
            const target = event.target as HTMLInputElement | HTMLTextAreaElement;
            // Only trigger on actual input (not just focus)
            const fieldData = this.monitoredFields.get(fieldId);
            if (target.value.length > 0 && fieldData && !fieldData.triggered) {
                this.onPIIDetected(element, sensitivity);
                fieldData.triggered = true;
            }
        };

        element.addEventListener('input', handler);

        this.monitoredFields.set(fieldId, {
            element: element,
            sensitivity: sensitivity,
            handler: handler,
            triggered: false
        });
    }

    private generateFieldId(element: HTMLInputElement | HTMLTextAreaElement): string {
        return `${element.tagName}_${element.name || element.id || 'unnamed'}_${element.type}`;
    }

    private async onPIIDetected(element: HTMLInputElement | HTMLTextAreaElement, sensitivity: 'HIGH' | 'MEDIUM' | 'LOW') {
        const domain = window.location.hostname;
        const fieldType = element.type || element.tagName.toLowerCase();
        const fieldName = element.name || element.id || 'unknown';

        console.warn(`[TraceGuard] PII detected: ${sensitivity} sensitivity field on ${domain}`);

        // Get current site WSS from storage
        const storage = await chrome.storage.local.get('siteCache');
        const siteData = (storage.siteCache as Record<string, any>)?.[domain];
        const siteWSS = siteData?.wss || 50; // Default if not yet analyzed

        // Create detection event
        const event: PIIEvent = {
            timestamp: Date.now(),
            site: domain,
            fieldType: fieldType,
            fieldName: fieldName,
            sensitivity: sensitivity,
            siteWRS: siteWSS
        };

        this.detectionEvents.push(event);

        // Send to background for UPS calculation
        chrome.runtime.sendMessage({
            type: 'PII_DETECTED',
            data: event
        });
    }

    // Stop monitoring all fields (e.g., when leaving page)
    stopMonitoring() {
        this.monitoredFields.forEach((data) => {
            data.element.removeEventListener('input', data.handler);
        });
        this.monitoredFields.clear();
    }
}

// Export singleton instance
export const piiDetector = new PIIDetector();
