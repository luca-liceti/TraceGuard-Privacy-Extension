/**
 * =============================================================================
 * BUILD PHISHLIST, Generate phishing-domain blocklist from public feeds
 * =============================================================================
 *
 * Fetches full phishing-domain lists from public, no-auth sources and emits
 * src/assets/phishlist.json for local (privacy-preserving) matching. No API key
 * or account is required.
 *
 * Sources:
 *   - OpenPhish: https://openphish.com/feed.txt          (one URL per line)
 *   - phishunt:   https://phishunt.io/api/v1/domains      ({ results: [{ domain }] })
 *
 * Run: node scripts/build-phishlist.js
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../src/assets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'phishlist.json');

const SOURCES = {
    openphish: 'https://openphish.com/feed.txt',
    phishunt: 'https://phishunt.io/api/v1/domains',
};

function fetchText(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'TraceGuard-build/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(fetchText(res.headers.location, timeoutMs));
            }
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                }
                resolve(data);
            });
        });
        req.on('error', reject);
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Timeout after ${timeoutMs}ms for ${url}`));
        });
    });
}

function extractDomain(raw) {
    try {
        const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
        const host = new URL(withProto).hostname.toLowerCase();
        const cleaned = host.replace(/^www\./, '');
        return cleaned || null;
    } catch {
        return null;
    }
}

async function build() {
    const domains = new Set();
    const failures = [];

    // OpenPhish: newline-separated phishing URLs
    try {
        const text = await fetchText(SOURCES.openphish);
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
            const d = extractDomain(line);
            if (d) domains.add(d);
        }
        console.log(`[phishlist] OpenPhish: ${lines.length} entries`);
    } catch (e) {
        failures.push(`openphish: ${e.message}`);
    }

    // phishunt: JSON { results: [{ domain }] } (best-effort)
    try {
        const json = await fetchText(SOURCES.phishunt);
        const parsed = JSON.parse(json);
        const items = parsed.results || parsed.domains || parsed.data || [];
        if (Array.isArray(items)) {
            for (const item of items) {
                const d = extractDomain(typeof item === 'string' ? item : (item.domain || item.url || ''));
                if (d) domains.add(d);
            }
        }
        console.log(`[phishlist] phishunt: ${items.length} entries`);
    } catch (e) {
        failures.push(`phishunt: ${e.message}`);
    }

    if (domains.size === 0) {
        // Keep the last known-good snapshot so builds stay hermetic when the
        // upstream feeds are down. Only hard-fail when there is no snapshot.
        if (fs.existsSync(OUTPUT_FILE)) {
            console.warn('[phishlist] No domains fetched; keeping existing snapshot.');
            console.warn('[phishlist] Failures:', failures.join('; '));
            return;
        }
        console.error('[phishlist] No domains fetched and no snapshot present. Aborting.');
        console.error('[phishlist] Failures:', failures.join('; '));
        process.exit(1);
    }

    const out = {
        version: '1.0.0',
        updated: new Date().toISOString(),
        sources: Object.keys(SOURCES),
        domains: Array.from(domains).sort(),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out, null, 2));
    console.log(`[phishlist] Wrote ${out.domains.length} domains to ${OUTPUT_FILE}`);
    if (failures.length) {
        console.warn('[phishlist] Some sources failed (continuing):', failures.join('; '));
    }
}

build().catch((e) => {
    console.error(e);
    process.exit(1);
});
