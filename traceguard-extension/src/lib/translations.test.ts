import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resources } from './translations';

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
    return { keys, dynamic };
}

const LANGS = Object.keys(resources);
const { keys, dynamic } = collectKeys();

describe('translation coverage', () => {
    it('reads the strings the UI actually uses', () => {
        // Guard against the extractor silently matching nothing.
        expect(keys.size).toBeGreaterThan(400);
        // A template literal key cannot be checked here and would ship English;
        // there are none today, so treat one appearing as a failure to review.
        expect([...dynamic]).toEqual([]);
    });

    for (const lang of LANGS) {
        it(`translates every used string into ${lang}`, () => {
            const map = (resources[lang as keyof typeof resources] as { translation: Record<string, string> }).translation;
            const missing = [...keys].filter((key) => !(key in map)).sort();
            expect(missing, `Missing ${lang} translations:\n  ${missing.join('\n  ')}`).toEqual([]);
        });
    }
});
