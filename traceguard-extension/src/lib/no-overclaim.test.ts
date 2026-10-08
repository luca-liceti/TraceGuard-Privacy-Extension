import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// TraceGuard has no blocking permission (PRIVACY.md says so), so any user-facing
// copy that claims it blocks, or that calls its scoring "protection", breaks the
// project rule that every claim must be true. The wording crept back once after
// v1.10.4, so this test fails the build the next time it does.

const BANNED_CLAIMS = [
    /\bnever be blocked\b/i,        // "these sites will never be blocked"
    /\bblock(?:ed)? sites\b/i,      // "Blocked Sites"
    /\btracker blocking\b/i,        // "Tracker Blocking"
    /\bautomatically block\b/i,     // "Automatically block tracking scripts"
    /\bwe block\b/i,
];

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) out.push(p);
    }
    return out;
}

// Source literals are written with escapes, so decode before matching them.
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

function collectStrings(): { source: string; value: string }[] {
    const found: { source: string; value: string }[] = [];
    for (const file of walk(join(process.cwd(), 'src'))) {
        // translations.ts holds the per-language maps; its English keys are
        // checked where they are used, at the t("...") call sites.
        if (file.endsWith('translations.ts')) continue;
        const src = readFileSync(file, 'utf8');
        const re = /\bt\(\s*(["'`])((?:[^"'`\\]|\\.)*?)\1/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
            if (m[2].includes('${')) continue;
            found.push({ source: file.replace(join(process.cwd(), 'src'), 'src'), value: decode(m[2]) });
        }
    }
    return found;
}

describe('no overclaimed effects in user-facing copy', () => {
    const strings = collectStrings();

    it('scans the UI strings', () => {
        // Guard against the extractor silently matching nothing.
        expect(strings.length).toBeGreaterThan(400);
    });

    it('never claims TraceGuard blocks something', () => {
        const offenders = strings
            .filter(s => BANNED_CLAIMS.some(re => re.test(s.value)))
            .map(s => `"${s.value}" (${s.source})`);
        expect(offenders, `Copy that claims a block TraceGuard cannot perform:\n  ${offenders.join('\n  ')}`).toEqual([]);
    });

    it('keeps the store descriptions free of protection and blocking claims', () => {
        const manifest = JSON.parse(readFileSync(join(process.cwd(), 'manifest.json'), 'utf8')) as { description: string };
        const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { description: string };
        const pairs: [string, string][] = [
            ['manifest.json', manifest.description],
            ['package.json', pkg.description],
        ];
        for (const [label, description] of pairs) {
            expect(/\bprotect/i.test(description), `${label} description claims protection: ${description}`).toBe(false);
            expect(/\bblock/i.test(description), `${label} description claims blocking: ${description}`).toBe(false);
        }
    });
});
