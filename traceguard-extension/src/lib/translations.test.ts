import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resources } from './translations';
import { getSafetyLabel, getSafetyLevel } from './risk-utils';

// Values the UI looks up through t(variable) rather than a literal. They cannot
// be found by scanning t("...") calls, so list the sources that feed them.
const DYNAMIC_VALUES = [
    // getSafetyLabel, the label shown in safety badges.
    ...[0, 10, 30, 50, 70, 90].map((wss) => getSafetyLabel(getSafetyLevel(wss))),
    // Detector names (rankings).
    'Tracking', 'Cookies', 'Input Fields', 'Reputation', 'Privacy Policy',
    // Risk levels (rankings).
    'Low', 'Medium', 'High', 'Critical',
    // Tracker categories (footprint / exposure), from CATEGORY_LABELS.
    'Advertising', 'Analytics', 'Social', 'Content', 'CDN', 'Fingerprinting',
    'Consent managers', 'Cryptomining', 'Email', 'Anti-fraud', 'Functional',
    'Single sign-on', 'Unknown',
    // PII field types, from the input detector.
    'password', 'credit card', 'ssn', 'security code', 'email', 'phone', 'address', 'name', 'username',
];

// Every user-facing string is looked up by its English text through `t(...)`.
// A string with no entry in a language falls back to English, which is easy to
// miss in review, so this test fails when a new string ships untranslated. Keys
// are read from source rather than a list, so there is nothing to keep in sync.

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) out.push(p);
    }
    return out;
}

// Source literals are written with escapes (\u2019, \n); the runtime value is
// decode-and-look-up, so decode here to compare against the loaded resources.
function decode(s: string): string {
    return s
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\`/g, '`')
        .replace(/\\\\/g, '\\');
}

function collectKeys(): { keys: Set<string>; dynamic: Set<string> } {
    const keys = new Set<string>();
    const dynamic = new Set<string>();
    for (const file of walk(join(process.cwd(), 'src'))) {
        const src = readFileSync(file, 'utf8');
        const re = /\bt\(\s*(["'`])((?:[^"'`\\]|\\.)*?)\1/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
            if (m[2].includes('${')) dynamic.add(m[2]);
            else if (m[2]) keys.add(decode(m[2]));
        }
    }
    // The PII decision messages are looked up as i18n.t(decision.message), so no
    // literal t(...) call names them. Collect them straight from the function that
    // returns them, or they would ship untranslated without failing this test.
    const pii = readFileSync(join(process.cwd(), 'src/lib/pii.ts'), 'utf8');
    const piiDecision = pii.slice(pii.indexOf('export function evaluatePIIEntry'));
    // Matches `message: 'X'` and the ternary form `message: expr ? 'X' : 'Y'`.
    const msgRe = /message:\s*(?:[^\n]*\n\s*\?\s*)?'((?:[^'\\]|\\.)*)'(?:\s*:\s*'((?:[^'\\]|\\.)*)')?/g;
    let mm: RegExpExecArray | null;
    while ((mm = msgRe.exec(piiDecision))) {
        if (mm[1]) keys.add(decode(mm[1]));
        if (mm[2]) keys.add(decode(mm[2]));
    }
    return { keys, dynamic };
}

const LANGS = Object.keys(resources);
const { keys, dynamic } = collectKeys();

describe('translation coverage', () => {
    it('reads the strings the UI actually uses', () => {
        // Guard against the extractor silently matching nothing.
        expect(keys.size).toBeGreaterThan(400);
        // And against the PII-message extraction quietly finding none.
        expect([...keys].some((k) => k.includes('no business asking'))).toBe(true);
        // A template literal key cannot be checked here and would ship English;
        // there are none today, so treat one appearing as a failure to review.
        expect([...dynamic]).toEqual([]);
    });

    it('covers the values looked up dynamically', () => {
        // Guard the curated list above against drift as much as the languages.
        expect(DYNAMIC_VALUES.length).toBeGreaterThan(25);
    });

    for (const lang of LANGS) {
        it(`translates every dynamic value into ${lang}`, () => {
            const map = (resources[lang as keyof typeof resources] as { translation: Record<string, string> }).translation;
            const missing = DYNAMIC_VALUES.filter((value) => !(value in map));
            expect(missing, `Missing ${lang} dynamic translations:\n  ${missing.join('\n  ')}`).toEqual([]);
        });
    }

    for (const lang of LANGS) {
        it(`translates every used string into ${lang}`, () => {
            const map = (resources[lang as keyof typeof resources] as { translation: Record<string, string> }).translation;
            const missing = [...keys].filter((key) => !(key in map)).sort();
            expect(missing, `Missing ${lang} translations:\n  ${missing.join('\n  ')}`).toEqual([]);
        });
    }
});
