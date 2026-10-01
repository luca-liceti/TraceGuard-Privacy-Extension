const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * =============================================================================
 * ToS;DR DATASET BUILDER
 * =============================================================================
 *
 * Builds the bundled ToS;DR ratings in two layers:
 *
 *   1. tosdr-index.json  - one small entry per domain: grade, score, service
 *                          id and name, and which detail shard holds its long
 *                          point list. Small enough to hold in memory always.
 *   2. tosdr/details/N.json - the point and document lists, split into shards.
 *                          Loaded one at a time, on demand.
 *
 * Why two layers: the point lists are about 84% of the data and would be tens
 * of megabytes. Keeping them out of the always-resident index is what stops the
 * extension from ballooning in memory.
 *
 * CATALOG SOURCE
 * The v2 list endpoint returns only the first 500 services and ignores the
 * `page` parameter, so a build that used it silently missed everything after
 * that (Instructure and Anthropic were both outside the first 500). The v3
 * endpoint honors `page` and exposes `page.end`, which is how this build walks
 * the whole catalog (about 21 pages of 500 at the time of writing).
 *
 * INCREMENTAL
 * Each service carries an `updated_at`. It is stored in the index as
 * `serviceUpdatedAt`. On the next build, a service whose `updated_at` has not
 * moved keeps its previous points and documents and skips the detail request
 * entirely. Only the first build pays the full cost.
 *
 * A page that fails to load aborts the build without writing, so a flaky API
 * can never shrink the dataset.
 *
 * Test knobs (all optional): TOSDR_OUTPUT_DIR, TOSDR_MAX_PAGES,
 * TOSDR_MAX_SERVICES, TOSDR_SHARD_COUNT, TOSDR_REQUEST_DELAY_MS.
 * =============================================================================
 */

const OUTPUT_DIR = process.env.TOSDR_OUTPUT_DIR
    ? path.resolve(process.env.TOSDR_OUTPUT_DIR)
    : path.join(__dirname, '../src/assets');
const INDEX_FILE = path.join(OUTPUT_DIR, 'tosdr-index.json');
const DETAIL_DIR = path.join(OUTPUT_DIR, 'tosdr', 'details');

const LIST_ENDPOINT = 'https://api.tosdr.org/service/v3/';
const DETAIL_ENDPOINT = 'https://api.tosdr.org/service/v3/';
const GRADES = ['A', 'B', 'C', 'D', 'E'];

// Score given to a catalogued service ToS;DR has not graded. Neutral, matching
// the local "policy link found, no rating" score in the policy detector.
const UNRATED_SCORE = 50;

// Politeness: ToS;DR is a free, volunteer-run API. Its gateway caps requests at
// roughly five per ten seconds, so space calls out and honor Retry-After. A
// first full build is slow by design; later builds only refetch what changed.
const REQUEST_DELAY_MS = Number(process.env.TOSDR_REQUEST_DELAY_MS || 250);
const MAX_RETRIES = 4;
const USER_AGENT = 'TraceGuard-build/1.0 (+https://github.com)';

// Safety caps and test knobs.
const MAX_PAGES = Number(process.env.TOSDR_MAX_PAGES || 60);
const MAX_SERVICES = Number(process.env.TOSDR_MAX_SERVICES || 0); // 0 = no limit
const SHARD_COUNT = Number(process.env.TOSDR_SHARD_COUNT || 64);
// Test-only: allow a bounded run that does not fetch the whole catalog to write
// its output. Never set this for a real build, where a partial catalog would
// silently drop every service on the pages that were not fetched.
const ALLOW_PARTIAL = process.env.TOSDR_ALLOW_PARTIAL === '1';

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/** Human-readable duration for progress lines, e.g. "1h 04m" or "2m 15s". */
function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Convert a ToS;DR grade to a score (0 = dangerous, 100 = safe).
 * Mirrors gradeToScore in src/background/tosdr-api.ts so the two never drift.
 */
function gradeToScore(grade) {
    if (!grade) return 0;
    const gradeMap = { A: 100, B: 80, C: 60, D: 40, E: 20 };
    return gradeMap[String(grade).toUpperCase()] || 0;
}

/** A rating is only usable when it is one of the A-E letters. */
function letterGrade(rating) {
    const grade = String(rating || '').toUpperCase();
    return GRADES.includes(grade) ? grade : undefined;
}

/**
 * Normalize a service URL to the registrable domain key used at runtime by
 * src/background/tosdr-api.ts#extractMainDomain. Keeping these in lockstep is
 * what makes lookups actually hit: runtime extracts "youtube.com" from any
 * YouTube URL, so the index must be keyed "youtube.com".
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
 * Which detail shard a domain belongs to. Stable hash so the same domain always
 * lands in the same file, and the shard number is recorded in the index so the
 * loader never has to reimplement this.
 */
function bucketFor(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
    }
    return hash % SHARD_COUNT;
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
 * Walk every page of the catalog. Returns { services, complete }. `complete`
 * is false when a page failed to load, so the caller can refuse to write a
 * dataset that would be missing whole pages.
 */
async function fetchAllServices() {
    const services = [];
    let complete = false;

    for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await fetchJson(`${LIST_ENDPOINT}?page=${page}`);
        if (!data) {
            console.warn(`  Page ${page} failed to load.`);
            return { services, complete: false };
        }
        const batch = data.services || [];
        if (!batch.length) {
            complete = true;
            break;
        }
        services.push(...batch);
        console.log(`  Catalog page ${page}: ${batch.length} services (${services.length} total)`);

        const meta = data.page;
        if (meta && meta.current >= meta.end) {
            complete = true;
            break;
        }
        await sleep(REQUEST_DELAY_MS);
    }

    return { services, complete };
}

/**
 * Read the previous build so unchanged services can be reused. Returns a map of
 * service id to its stored `updated_at`, and every domain's detail entry.
 */
function loadPrevious() {
    const prevServiceUpdated = new Map();
    const prevDetails = new Map();

    if (fs.existsSync(INDEX_FILE)) {
        try {
            const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
            for (const entry of Object.values(index.entries || {})) {
                if (entry && entry.serviceId != null) {
                    prevServiceUpdated.set(String(entry.serviceId), entry.serviceUpdatedAt);
                }
            }
        } catch (e) {
            console.warn('Could not read the previous index, starting fresh:', e.message);
        }
    }

    if (fs.existsSync(DETAIL_DIR)) {
        try {
            for (const file of fs.readdirSync(DETAIL_DIR)) {
                const shard = JSON.parse(fs.readFileSync(path.join(DETAIL_DIR, file), 'utf8'));
                for (const [domain, detail] of Object.entries(shard)) {
                    prevDetails.set(domain, detail);
                }
            }
        } catch (e) {
            console.warn('Could not read the previous detail shards, starting fresh:', e.message);
        }
    }

    return { prevServiceUpdated, prevDetails };
}

/**
 * Validate the freshly built output so a broken build can never ship a degraded
 * dataset. Throws (fails the build) instead of writing something malformed.
 */
function validate(index, shards) {
    const entries = Object.entries(index.entries || {});
    if (entries.length === 0) {
        throw new Error('ToS;DR output is empty (no rated services fetched)');
    }
    for (const [domain, entry] of entries) {
        if (!domain || !entry || typeof entry !== 'object') {
            throw new Error(`Malformed index entry for domain: ${domain}`);
        }
        if (entry.grade != null && !GRADES.includes(String(entry.grade))) {
            throw new Error(`Invalid grade for ${domain}: ${entry.grade}`);
        }
        if (typeof entry.score !== 'number' || entry.score < 0 || entry.score > 100) {
            throw new Error(`Invalid score for ${domain}: ${entry.score}`);
        }
        if (typeof entry.shard !== 'number' || entry.shard < 0 || entry.shard >= SHARD_COUNT) {
            throw new Error(`Invalid shard for ${domain}: ${entry.shard}`);
        }
        if (!shards[entry.shard] || !shards[entry.shard][domain]) {
            throw new Error(`Missing detail entry for ${domain} in shard ${entry.shard}`);
        }
    }
}

async function buildDatabase() {
    console.log('Building the ToS;DR dataset from the rated catalog...');
    fs.mkdirSync(DETAIL_DIR, { recursive: true });

    const { prevServiceUpdated, prevDetails } = loadPrevious();

    const { services, complete } = await fetchAllServices();
    if (!services.length) {
        throw new Error('ToS;DR catalog returned no services; keeping the existing dataset.');
    }
    if (!complete && !ALLOW_PARTIAL) {
        throw new Error('ToS;DR catalog was not fully fetched; keeping the existing dataset.');
    }

    // Every service with a domain is fetched, not only the graded ones. A
    // service can carry points and documents while its rating is N/A, and those
    // entries are worth showing as "unrated" rather than hiding entirely.
    const candidates = services.filter((s) => (s.urls || []).some((u) => normalizeDomain(u)));
    console.log(`Found ${services.length} services; ${candidates.length} have a domain.`);

    const limit = MAX_SERVICES > 0 ? Math.min(MAX_SERVICES, candidates.length) : candidates.length;
    const indexEntries = {};
    const shards = Array.from({ length: SHARD_COUNT }, () => ({}));

    let fetched = 0;
    let reused = 0;
    let failed = 0;
    let empty = 0;
    const startedAt = Date.now();

    console.log(`Fetching details for ${limit} services. The first build runs for hours at ToS;DR's rate limit; later builds reuse unchanged services.`);

    for (let i = 0; i < limit; i++) {
        if (i % 100 === 0) {
            const done = i;
            const elapsed = Date.now() - startedAt;
            const perService = done > 0 ? elapsed / done : 0;
            const eta = done > 0 ? perService * (limit - done) : 0;
            console.log(
                `  [${done}/${limit}] fetched ${fetched} reused ${reused} failed ${failed} empty ${empty}` +
                ` | elapsed ${formatDuration(elapsed)}` +
                ` | ETA ${done > 0 ? formatDuration(eta) : 'calculating'}`
            );
        }

        const service = candidates[i];
        const domains = [...new Set((service.urls || []).map(normalizeDomain).filter(Boolean))];
        if (!domains.length) continue;

        const serviceId = String(service.id);
        const updatedAt = service.updated_at;
        const unchanged =
            prevServiceUpdated.get(serviceId) === updatedAt &&
            domains.every((d) => prevDetails.has(d));

        let points;
        let documents;

        if (unchanged) {
            const prev = prevDetails.get(domains[0]);
            points = prev.points || [];
            documents = prev.documents || [];
            reused++;
        } else {
            await sleep(REQUEST_DELAY_MS);
            const detail = await fetchJson(`${DETAIL_ENDPOINT}?id=${serviceId}`);
            if (detail) {
                points = (detail.points || []).map((p) => ({
                    title: p.title,
                    classification: (p.case && p.case.classification) || 'neutral',
                }));
                documents = (detail.documents || []).map((d) => ({ name: d.name, url: d.url }));
                fetched++;
            } else if (domains.every((d) => prevDetails.has(d))) {
                // Merge on failure: keep the previous good entry rather than
                // dropping a rated service because one request timed out.
                const prev = prevDetails.get(domains[0]);
                points = prev.points || [];
                documents = prev.documents || [];
                failed++;
            } else {
                console.warn(`  Failed to fetch detail for ${service.name} (id ${serviceId}); skipping.`);
                failed++;
                continue;
            }
        }

        const grade = letterGrade(service.rating);

        // A service with no grade and nothing on record is not worth a dataset
        // entry; the panel has nothing to show. It falls through to the local
        // detection path instead.
        if (!grade && (!points || points.length === 0) && (!documents || documents.length === 0)) {
            empty++;
            continue;
        }

        // An unrated but catalogued service is neutral, not dangerous: ToS;DR has
        // it on file but offers no verdict. 50 matches the local "policy link
        // found, no rating" score.
        const score = grade ? gradeToScore(grade) : UNRATED_SCORE;
        for (const domain of domains) {
            const shard = bucketFor(domain);
            indexEntries[domain] = {
                grade,
                score,
                serviceId: service.id,
                serviceName: service.name,
                shard,
                serviceUpdatedAt: updatedAt,
            };
            shards[shard][domain] = { points, documents };
        }
    }

    const index = {
        updatedAt: Date.now(),
        shardCount: SHARD_COUNT,
        count: Object.keys(indexEntries).length,
        entries: indexEntries,
    };

    validate(index, shards);

    // Write the index and every non-empty shard, compact. Remove shard files
    // that are no longer produced so a shard-count change cannot leave strays.
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index));
    const written = new Set();
    for (let shard = 0; shard < SHARD_COUNT; shard++) {
        if (Object.keys(shards[shard]).length === 0) continue;
        const file = `${shard}.json`;
        fs.writeFileSync(path.join(DETAIL_DIR, file), JSON.stringify(shards[shard]));
        written.add(file);
    }
    for (const file of fs.readdirSync(DETAIL_DIR)) {
        if (!written.has(file)) fs.unlinkSync(path.join(DETAIL_DIR, file));
    }

    console.log(`Fetched ${fetched}, reused ${reused}, failed ${failed}, skipped empty ${empty}.`);
    console.log(`Wrote ${index.count} domain entries to ${INDEX_FILE}`);
    console.log(`Wrote ${written.size} detail shards to ${DETAIL_DIR}`);
}

buildDatabase().catch((e) => {
    console.error(e);
    process.exit(1);
});
