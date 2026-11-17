import { describe, expect, it } from 'vitest';
import { extractPolicyDocument, findReadablePolicyText, MAX_POLICY_TEXT_CHARS, preparePrivacyPolicyText } from './policy-text';

const policyText = `${'This Privacy Policy describes the personal data we collect and how we use it. '.repeat(20)}`;

describe('findReadablePolicyText', () => {
    it('falls back to visible body text when semantic content containers are empty', () => {
        expect(findReadablePolicyText(['Navigation links only'], policyText)).toBe(policyText.trim());
    });

    it('prefers policy text in a semantic container over unrelated body text', () => {
        const article = `${'This Privacy Policy describes personal data and how we use it. '.repeat(12)}`;
        expect(findReadablePolicyText([article], `${article} ${'unrelated footer '.repeat(100)}`)).toBe(article.trim());
    });

    it('rejects generic body content without policy text', () => {
        expect(findReadablePolicyText([], 'Sign in to continue. '.repeat(50))).toBeNull();
    });
});

describe('extractPolicyDocument', () => {
    it('parses static policy HTML, decodes entities, and skips scripts and page chrome', () => {
        const policy = 'This Privacy Policy describes the personal data we collect and how we use it. '.repeat(12);
        const html = `<html><head><title>Privacy &amp; Data</title></head><body><nav>Privacy menu</nav><main><h1>Privacy Policy</h1><article><p>${policy.replace(/&/g, '&amp;')}</p></article><script>document.body.innerText = 'fake privacy policy';</script><footer>Footer</footer></main></body></html>`;

        expect(extractPolicyDocument(html)).toEqual({
            title: 'Privacy & Data',
            text: `Privacy Policy ${policy.trim()}`,
        });
    });

    it('rejects pages without a title or enough policy text', () => {
        expect(extractPolicyDocument('<html><body><main>Privacy policy</main></body></html>')).toBeNull();
    });
});

describe('preparePrivacyPolicyText', () => {
    it('accepts bounded visible text only from an HTTP privacy-policy page', () => {
        expect(preparePrivacyPolicyText({
            url: 'https://example.com/privacy-policy',
            title: 'Privacy Policy',
            text: `  ${policyText}  `,
        })).toEqual({ ok: true, text: policyText.trim(), truncated: false });
    });

    it('accepts a terms page that reads like a policy', () => {
        expect(preparePrivacyPolicyText({
            url: 'https://example.com/terms',
            title: 'Terms of Service',
            text: policyText,
        }).ok).toBe(true);
    });

    it('rejects pages that are not clearly policy pages', () => {
        expect(preparePrivacyPolicyText({
            url: 'https://example.com/account',
            title: 'Your account',
            text: policyText,
        })).toEqual({ ok: false, reason: 'not-policy-page' });
    });

    it('rejects short or unrelated page text', () => {
        expect(preparePrivacyPolicyText({
            url: 'https://example.com/privacy',
            title: 'Privacy',
            text: 'Privacy settings are available here.',
        })).toEqual({ ok: false, reason: 'text-too-short' });
        expect(preparePrivacyPolicyText({
            url: 'https://example.com/privacy',
            title: 'Privacy',
            text: 'A '.repeat(400),
        })).toEqual({ ok: false, reason: 'not-policy-text' });
    });

    it('truncates oversized policy text to the explicit request limit', () => {
        const text = `Privacy Policy ${'personal data and information. '.repeat(2_000)}`;
        const result = preparePrivacyPolicyText({ url: 'https://example.com/privacy', title: 'Privacy', text });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.text.length).toBe(MAX_POLICY_TEXT_CHARS);
            expect(result.truncated).toBe(true);
        }
    });

    it('rejects non-web URLs', () => {
        expect(preparePrivacyPolicyText({ url: 'chrome-extension://id/privacy', title: 'Privacy', text: policyText }))
            .toEqual({ ok: false, reason: 'invalid-url' });
    });
});
