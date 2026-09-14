import { describe, it, expect, beforeEach, vi } from 'vitest';
import { piiDetector } from './pii-detector';

/**
 * These tests pin the contract of the only path by which a handover reaches the
 * dashboard's footprint ledger: the first non-empty input into a field the
 * analyzer classified as sensitive. If this trigger stops firing, or fires
 * twice, every "What you have handed over" figure is wrong - so the behaviour is
 * asserted here rather than assumed.
 */

interface PiiDetectionMessage {
    type: string;
    data: {
        timestamp: number;
        site: string;
        fieldType: string;
        sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
        pageContext: { isLoginPage: boolean; isCheckoutPage: boolean };
    };
}

const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;

function addField(type = 'password', name = 'password') {
    const el = document.createElement('input');
    el.type = type;
    el.name = name;
    document.body.appendChild(el);
    return el;
}

/** Simulates the user entering text: a real value plus the `input` event. */
function enterText(el: HTMLInputElement, value = 'x') {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

function detectionMessages(): PiiDetectionMessage[] {
    return (sendMessage.mock.calls as [PiiDetectionMessage][]) 
        .map(([message]) => message)
        .filter((message) => message?.type === 'PII_DETECTED');
}

function monitorOne(el: HTMLInputElement, sensitivity: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH', type = 'password') {
    piiDetector.startMonitoring(
        {
            high: sensitivity === 'HIGH' ? [{ element: el, type, sensitivity }] : [],
            medium: sensitivity === 'MEDIUM' ? [{ element: el, type, sensitivity }] : [],
            low: sensitivity === 'LOW' ? [{ element: el, type, sensitivity }] : [],
        },
        { isLoginPage: true, isCheckoutPage: false },
    );
}

describe('piiDetector', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        piiDetector.stopMonitoring();
    });

    it('reports a handover the first time a monitored field receives input', () => {
        const field = addField();
        monitorOne(field);

        enterText(field, 'hunter2');

        const [message] = detectionMessages();
        expect(message).toBeDefined();
        expect(message.data).toMatchObject({
            site: window.location.hostname,
            fieldType: 'password',
            sensitivity: 'HIGH',
            pageContext: { isLoginPage: true, isCheckoutPage: false },
        });
        expect(typeof message.data.timestamp).toBe('number');
    });

    it('never sends the value the user typed', () => {
        const field = addField();
        monitorOne(field);

        enterText(field, 'super-secret-value');

        const serialized = JSON.stringify(detectionMessages());
        expect(serialized).not.toContain('super-secret-value');
    });

    it('ignores focus and empty input', () => {
        const field = addField();
        monitorOne(field);

        field.dispatchEvent(new Event('focus'));
        field.dispatchEvent(new Event('input', { bubbles: true }));

        expect(detectionMessages()).toHaveLength(0);
    });

    it('reports each field once, not once per keystroke', () => {
        const field = addField();
        monitorOne(field);

        enterText(field, 'a');
        enterText(field, 'ab');
        enterText(field, 'abc');

        expect(detectionMessages()).toHaveLength(1);
    });

    it('stops reporting after stopMonitoring', () => {
        const field = addField();
        monitorOne(field);

        piiDetector.stopMonitoring();
        enterText(field, 'a');

        expect(detectionMessages()).toHaveLength(0);
    });

    it('does not double-report when the analyzer re-runs over the same field', () => {
        const field = addField();
        monitorOne(field);
        // A DOM mutation re-scan hands the same element to startMonitoring again.
        monitorOne(field);

        enterText(field, 'a');

        expect(detectionMessages()).toHaveLength(1);
    });

    it('reports separate fields independently', () => {
        const password = addField('password', 'password');
        const email = addField('email', 'email');
        piiDetector.startMonitoring(
            {
                high: [{ element: password, type: 'password', sensitivity: 'HIGH' }],
                medium: [{ element: email, type: 'email', sensitivity: 'MEDIUM' }],
                low: [],
            },
            { isLoginPage: true, isCheckoutPage: false },
        );

        enterText(password, 'a');
        enterText(email, 'a@b.com');

        const messages = detectionMessages();
        expect(messages).toHaveLength(2);
        expect(messages.map((message: PiiDetectionMessage) => message.data.fieldType)).toEqual(['password', 'email']);
        expect(messages.map((message: PiiDetectionMessage) => message.data.sensitivity)).toEqual(['HIGH', 'MEDIUM']);
    });

    it('surfaces a failed delivery instead of losing the handover silently', async () => {
        sendMessage.mockRejectedValueOnce(new Error('worker restarting'));
        const field = addField();
        monitorOne(field);

        enterText(field, 'a');

        // The rejection is handled, so it must not escape as an unhandled one.
        await Promise.resolve();
        expect(detectionMessages()).toHaveLength(1);
    });
});
