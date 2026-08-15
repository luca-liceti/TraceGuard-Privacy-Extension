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

    it('ignores spoofable name/id attributes (no PII fabrication)', () => {
        addInput({ type: 'text', name: 'password', id: 'card-number' });
        const result = detectSensitiveInputs();
        expect(result.fields.high).toHaveLength(0);
        expect(result.fields.medium).toHaveLength(0);
        expect(result.score).toBe(100);
    });
});
