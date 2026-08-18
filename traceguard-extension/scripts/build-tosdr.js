const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../src/assets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tosdr-data.json');

// Ensure assets directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Check if we should skip rebuilding to avoid API strain
if (fs.existsSync(OUTPUT_FILE) && !process.env.FORCE_TOSDR_BUILD) {
    const stats = fs.statSync(OUTPUT_FILE);
    const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    // Only rebuild if older than 7 days, unless forced
    if (ageDays < 7) {
        console.log(`Local ToS;DR database is fresh (${Math.round(ageDays * 10) / 10} days old).`);
        console.log('Skipping fetch to prevent API strain.');
        console.log('To force rebuild, run: FORCE_TOSDR_BUILD=1 npm run build:tosdr (or delete src/assets/tosdr-data.json)');
        process.exit(0);
    }
}

// Politeness settings: ToS;DR is a free, volunteer-run API. Space out requests,
// honor Retry-After, and give up gracefully rather than hammering it.
const LIST_ENDPOINT = 'https://api.tosdr.org/service/v2/';
const DETAIL_ENDPOINT = 'https://api.tosdr.org/service/v2/';
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;
const USER_AGENT = 'TraceGuard-build/1.0 (+https://github.com)';

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Convert ToS;DR grade to risk score (standard: 0 = dangerous, 100 = safe).
 * Mirrors gradeToScore in src/background/tosdr-api.ts so the two never drift.
 */
function gradeToScore(grade) {
    if (!grade) return 0;
    const gradeMap = { A: 100, B: 80, C: 60, D: 40, E: 20 };
    return gradeMap[grade.toUpperCase()] || 0;
}

/**
 * Normalize a service URL to the registrable domain key used at runtime by
 * src/background/tosdr-api.ts#extractMainDomain. Keeping these in lockstep is
 * what makes lookups actually hit: runtime extracts "youtube.com" from any
 * YouTube URL, so the bundled map must be keyed "youtube.com".
 */
function normalizeDomain(raw) {
    try {
        let host = String(raw || '').toLowerCase().trim();
        if (!host) return null;
        host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''); // strip protocol
        host = host.split('/')[0]; // strip path/query
        host = host.split(':')[0]; // strip port
        host = host.replace(/^www\./, '');
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
            return null;
        }
        const parts = host.split('.');

        // Brand TLDs (single-owner): antigravity.google -> "google"
        const brandTLDs = ['google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta'];
        if (parts.length === 2 && brandTLDs.includes(parts[1])) return parts[1];

        // Multi-part TLDs: example.co.uk -> "example.co.uk"
        const multiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'org.uk'];
        for (const tld of multiPartTLDs) {
            if (host.endsWith('.' + tld)) return parts.slice(-3).join('.');
        }

        if (parts.length >= 2) return parts.slice(-2).join('.');
        return host;
    } catch {
        return null;
    }
}

/**
 * GET a URL with a timeout and limited retries. On 429/5xx it backs off and
 * honors Retry-After when present. Returns null on persistent failure so the
 * caller can keep the previous good entry (merge-on-failure).
 */
function fetchJson(url, { retries = MAX_RETRIES, timeoutMs = 20000 } = {}) {
    return new Promise((resolve) => {
        (async function attempt(remaining) {
            const result = await new Promise((res) => {
                const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (r) => {
                    let data = '';
                    r.on('data', (c) => (data += c));
                    r.on('end', () => res({ status: r.statusCode, body: data, retryAfter: r.headers['retry-after'] }));
                });
                req.on('error', () => res({ status: 0, body: '' }));
                req.setTimeout(timeoutMs, () => {
                    req.destroy(new Error(`Timeout after ${timeoutMs}ms for ${url}`));
                });
            });

            if (result.status === 200) {
                try {
                    resolve(JSON.parse(result.body));
                } catch {
                    resolve(null);
                }
                return;
            }

            const retriable = result.status === 0 || result.status === 429 || result.status >= 500;
            if (remaining > 0 && retriable) {
                let waitMs = REQUEST_DELAY_MS * Math.pow(2, MAX_RETRIES - remaining + 1);
                if (result.retryAfter) {
                    const s = parseInt(result.retryAfter, 10);
                    if (!isNaN(s)) waitMs = Math.max(waitMs, s * 1000);
                }
                await sleep(waitMs);
                return attempt(remaining - 1);
            }
            resolve(null);
        })(retries);
    });
}

/**
 * Validate the freshly built map so a broken fetch can never ship a degraded
 * or malformed database. Throws (fails the build) instead of degrading.
 */
function validate(db) {
    if (!db || typeof db !== 'object' || Array.isArray(db)) {
        throw new Error('ToS;DR output is not an object');
    }
    const entries = Object.entries(db);
    if (entries.length === 0) {
        throw new Error('ToS;DR output is empty (no rated services fetched)');
    }
    for (const [domain, rec] of entries) {
        if (!domain || !rec || typeof rec !== 'object') {
            throw new Error(`Malformed ToS;DR entry for domain: ${domain}`);
        }
        if (typeof rec.score !== 'number' || rec.score < 0 || rec.score > 100) {
            throw new Error(`Invalid score for ${domain}: ${rec.score}`);
        }
        if (!Array.isArray(rec.points) || !Array.isArray(rec.documents)) {
            throw new Error(`Missing points/documents arrays for ${domain}`);
        }
    }
}

async function buildDatabase() {
    console.log('Building local ToS;DR database from the rated catalog...');

    // Merge on top of any existing DB so a flaky API or rate limit never
    // shrinks coverage: failed fetches keep their old entry. Carry forward only
    // well-formed records so a legacy placeholder/partial entry can't trip
    // validation.
    let db = {};
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            const valid = Object.entries(raw).filter(
                ([domain, rec]) =>
                    domain &&
                    rec &&
                    typeof rec === 'object' &&
                    ['A', 'B', 'C', 'D', 'E'].includes(String(rec.grade).toUpperCase()) &&
                    typeof rec.score === 'number' &&
                    Array.isArray(rec.points) &&
                    Array.isArray(rec.documents)
            );
            db = Object.fromEntries(valid);
            console.log(`Merging into existing DB (${Object.keys(db).length} valid domains)`);
        } catch (e) {
            console.warn('Could not read existing DB, starting fresh:', e.message);
        }
    }

    // 1. List all services.
    const list = await fetchJson(LIST_ENDPOINT);
    const services = list?.parameters?.services || [];
    if (!services.length) {
        throw new Error(`ToS;DR list endpoint returned no services. Keeping existing DB.`);
    }

    // 2. Keep only services with an A–E grade. "N/A" stubs (with or without a
    //    handful of stray points) carry no score signal and are skipped.
    const candidates = services.filter((s) =>
        s.rating && ['A', 'B', 'C', 'D', 'E'].includes(String(s.rating).toUpperCase())
    );
    console.log(`Found ${services.length} services; ${candidates.length} have an A–E grade.`);

    let fetched = 0;
    let failed = 0;
    let skipped = 0;

    for (const service of candidates) {
        const domains = (service.urls || []).map(normalizeDomain).filter(Boolean);
        if (!domains.length) {
            skipped++;
            continue;
        }
        // Be gentle with the volunteer-run API.
        await sleep(REQUEST_DELAY_MS);

        const detail = await fetchJson(`${DETAIL_ENDPOINT}?id=${service.id}`);
        if (!detail?.parameters) {
            console.warn(`  Failed to fetch detail for ${service.name} (id ${service.id}); keeping old entry if present.`);
            failed++;
            continue;
        }

        const d = detail.parameters;
        const grade = ['A', 'B', 'C', 'D', 'E'].includes(String(d.rating || '').toUpperCase())
            ? String(d.rating).toUpperCase()
            : undefined;
        if (!grade) {
            // Unrated (or drifted to N/A) = no score signal; skip it.
            skipped++;
            continue;
        }

        const points = (d.points || []).map((p) => ({
            title: p.title,
            classification: (p.case && p.case.classification) || 'neutral',
        }));
        const documents = (d.documents || []).map((doc) => ({ name: doc.name, url: doc.url }));

        const record = {
            found: true,
            grade,
            score: gradeToScore(grade),
            source: 'tosdr-local',
            serviceName: d.name,
            serviceId: d.id,
            points,
            documents,
            lastUpdated: Date.now(),
        };

        for (const domain of domains) {
            db[domain] = record;
        }
        fetched++;
    }

    console.log(`Fetched ${fetched} services, failed ${failed}, skipped ${skipped}.`);
    console.log(`Total domain keys in DB: ${Object.keys(db).length}`);

    validate(db);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(db, null, 2));
    console.log(`Successfully wrote ${Object.keys(db).length} records to ${OUTPUT_FILE}`);
}

buildDatabase().catch((e) => {
    console.error(e);
    process.exit(1);
});
