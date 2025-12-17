interface SensitiveField {
    element: HTMLInputElement | HTMLTextAreaElement;
    type: string;
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface PIIEvent {
    timestamp: number;
    site: string;
    fieldType: string;
    fieldName: string;
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
    siteWRS: number;
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
