import { describe, it, expect, beforeEach } from 'vitest';
import { detectSensitiveInputs } from './input';

function addInput(attrs: Record<string, string>) {
    const el = document.createElement('input');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.appendChild(el);
    return el;
}

describe('detectSensitiveInputs', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('returns 100 with no sensitive fields', () => {
        addInput({ type: 'text' });
        const result = detectSensitiveInputs();
        expect(result.score).toBe(100);
        expect(result.fields.high).toHaveLength(0);
        expect(result.fields.medium).toHaveLength(0);
    });

    it('classifies password fields as HIGH', () => {
        addInput({ type: 'password' });
        const result = detectSensitiveInputs();
        expect(result.fields.high).toHaveLength(1);
        expect(result.fields.high[0].type).toBe('password');
        expect(result.score).toBeLessThan(100);
    });

    it('classifies email fields as MEDIUM', () => {
        addInput({ type: 'email' });
        const result = detectSensitiveInputs();
        expect(result.fields.medium).toHaveLength(1);
        expect(result.fields.medium[0].type).toBe('email');
    });

    it('classifies autocomplete=cc-number as HIGH (credit card)', () => {
        addInput({ type: 'text', autocomplete: 'cc-number' });
        const result = detectSensitiveInputs();
        expect(result.fields.high).toHaveLength(1);
        expect(result.fields.high[0].type).toBe('credit card');
    });

    it('classifies address fields from visible placeholders', () => {
        addInput({ type: 'text', placeholder: 'Street number and name *' });
        addInput({ type: 'text', placeholder: 'Apt./Unit #' });
        addInput({ type: 'text', placeholder: 'City *' });
        addInput({ type: 'text', placeholder: 'ZIP Code *' });
        const result = detectSensitiveInputs();
        expect(result.fields.medium).toHaveLength(4);
        expect(result.fields.medium.every(field => field.type === 'address')).toBe(true);
    });

    it('classifies address fields from autocomplete tokens with scope prefixes', () => {
        addInput({ type: 'text', autocomplete: 'shipping address-line1' });
        addInput({ type: 'text', autocomplete: 'shipping postal-code' });
        const result = detectSensitiveInputs();
        expect(result.fields.medium).toHaveLength(2);
        expect(result.fields.medium.map(field => field.type)).toEqual(['address', 'address']);
    });

    it('ignores spoofable name/id attributes (no PII fabrication)', () => {
        addInput({ type: 'text', name: 'password', id: 'card-number' });
        const result = detectSensitiveInputs();
        expect(result.fields.high).toHaveLength(0);
        expect(result.fields.medium).toHaveLength(0);
        expect(result.score).toBe(100);
    });
});
