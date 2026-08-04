/**
 * =============================================================================
 * DATABASE LOADER — Lazy-loads bundled privacy databases into memory
 * =============================================================================
 *
 * WHAT THIS FILE DOES:
 * Loads the 4 privacy databases that were bundled at build time into memory
 * for fast lookups during enrichment. Uses lazy loading so we only pay the
 * memory cost when the first analysis runs, not on extension startup.
 *
 * DATABASES:
 * - Tracker Radar: domain → { owner, category, prevalence, fingerprinting }
 * - Cookie DB: cookie name → { platform, category, description, retention }
 * - EasyPrivacy: Set of tracker domains
 * - Disconnect: domain → { category, entityName }
 * =============================================================================
 */

interface TrackerRadarEntry {
    owner: string | null;
    displayName: string | null;
    category: string | null;
    prevalence: number;
    fingerprinting: number;
}

interface CookieDBEntry {
    platform: string | null;
    category: string;
    description: string | null;
    retentionPeriod: string | null;
    dataController: string | null;
    privacyUrl: string | null;
}

interface CookieDBWildcard {
    pattern: string;
    regex: string;
    entry: CookieDBEntry;
}

interface CookieDatabase {
    exact: Record<string, CookieDBEntry>;
    wildcards: CookieDBWildcard[];
}

interface DisconnectEntry {
    category: string;
    entityName: string;
}

// Cached databases (null = not loaded yet)
let _trackerRadar: Record<string, TrackerRadarEntry> | null = null;
let _cookieDB: CookieDatabase | null = null;
let _easyPrivacySet: Set<string> | null = null;
let _disconnectMap: Record<string, DisconnectEntry> | null = null;

// Compiled wildcard regexes (cached after first load)
let _compiledWildcards: Array<{ regex: RegExp; entry: CookieDBEntry }> | null = null;

// Remote snapshots live in IndexedDB rather than chrome.storage.local: the
// Tracker Radar data alone is several megabytes and must not crowd out a
// user's encrypted history. Bundled data remains the safe offline fallback.
const REMOTE_DB_NAME = 'traceguard-privacy-databases';
const REMOTE_STORE = 'snapshots';

interface RemoteSnapshot<T> {
    updatedAt: number;
    data: T;
}

function openRemoteDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(REMOTE_DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(REMOTE_STORE)) {
                request.result.createObjectStore(REMOTE_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readRemoteSnapshot<T>(name: string): Promise<T | null> {
    try {
        const db = await openRemoteDatabase();
        const snapshot = await new Promise<RemoteSnapshot<T> | undefined>((resolve, reject) => {
            const request = db.transaction(REMOTE_STORE, 'readonly').objectStore(REMOTE_STORE).get(name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return snapshot?.data ?? null;
    } catch (error) {
        console.warn(`[DatabaseLoader] Unable to read ${name} snapshot:`, error);
        return null;
    }
}

async function writeRemoteSnapshot<T>(name: string, data: T): Promise<void> {
    const db = await openRemoteDatabase();
    await new Promise<void>((resolve, reject) => {
        const request = db.transaction(REMOTE_STORE, 'readwrite')
            .objectStore(REMOTE_STORE)
            .put({ updatedAt: Date.now(), data } satisfies RemoteSnapshot<T>, name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    db.close();
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === ',' && !quoted) {
            cells.push(current.trim());
            current = '';
        } else {
            current += character;
        }
    }
    cells.push(current.trim());
    return cells;
}

function buildRemoteCookieDatabase(csv: string): CookieDatabase {
    const rows = csv.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(rows.shift() ?? '');
    const headerIndex = (name: string) => headers.findIndex(header => header.toLowerCase() === name.toLowerCase());
    const field = (row: string[], ...names: string[]) => {
        for (const name of names) {
            const index = headerIndex(name);
            if (index >= 0 && row[index]) return row[index];
        }
        return '';
    };
    const exact: Record<string, CookieDBEntry> = {};
    const wildcards: CookieDBWildcard[] = [];
    const categoryMap: Record<string, string> = {
        analytics: 'analytics', performance: 'analytics', marketing: 'marketing', advertising: 'marketing',
        targeting: 'marketing', functional: 'functional', preferences: 'functional', necessary: 'necessary',
        required: 'necessary', security: 'necessary', 'social media': 'marketing',
    };

    for (const line of rows) {
        const row = parseCsvLine(line);
        const name = field(row, 'Cookie / Data Header', 'Cookie', 'Name').toLowerCase();
        if (!name) continue;
        const entry: CookieDBEntry = {
            platform: field(row, 'Platform') || null,
            category: categoryMap[field(row, 'Category').toLowerCase()] || 'unclassified',
            description: field(row, 'Description') || null,
            retentionPeriod: field(row, 'Retention period', 'Retention') || null,
            dataController: field(row, 'Data Controller', 'Controller') || null,
            privacyUrl: field(row, 'User Privacy & GDPR', 'Privacy URL') || null,
        };
        if (name.includes('*') || name.includes('?') || field(row, 'Wildcard') === '1') {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
            wildcards.push({ pattern: name, regex: `^${escaped}$`, entry });
        } else {
            exact[name] = entry;
        }
    }
    return { exact, wildcards };
}

function buildRemoteEasyPrivacyList(text: string): string[] {
    const domains = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
        const match = line.trim().match(/^\|\|([a-z0-9.-]+)\^/i);
        if (match && match[1].includes('.')) domains.add(match[1].toLowerCase());
    }
    return [...domains];
}

function buildRemoteDisconnectMap(raw: unknown): Record<string, DisconnectEntry> {
    const output: Record<string, DisconnectEntry> = {};
    const categories = (raw as { categories?: Record<string, unknown[]> })?.categories;
    if (!categories || typeof categories !== 'object') throw new Error('Disconnect response has no categories');
    for (const [category, entities] of Object.entries(categories)) {
        for (const entity of entities) {
            if (!entity || typeof entity !== 'object') continue;
            for (const [entityName, domainGroups] of Object.entries(entity as Record<string, unknown>)) {
                if (!domainGroups || typeof domainGroups !== 'object') continue;
                for (const domainList of Object.values(domainGroups as Record<string, unknown>)) {
                    for (const domain of Array.isArray(domainList) ? domainList : [domainList]) {
                        if (typeof domain === 'string') output[domain.toLowerCase()] = { category, entityName };
                    }
                }
            }
        }
    }
    return output;
}

function buildRemoteTrackerRadar(domains: unknown, entities: unknown): Record<string, TrackerRadarEntry> {
    if (!domains || typeof domains !== 'object') throw new Error('Tracker Radar response is invalid');
    const entityMap = entities && typeof entities === 'object' ? entities as Record<string, { displayName?: string }> : {};
    const output: Record<string, TrackerRadarEntry> = {};
    for (const [domain, value] of Object.entries(domains as Record<string, any>)) {
        const owner = value?.owner?.name || value?.ownerName || null;
        output[domain.toLowerCase()] = {
            owner,
            displayName: owner ? entityMap[owner]?.displayName || owner : null,
            category: value?.categories?.[0] || null,
            prevalence: Number(value?.prevalence) || 0,
            fingerprinting: Number(value?.fingerprinting) || 0,
        };
    }
    return output;
}

/**
 * Refreshes public tracker databases without sending browsing or user data.
 * Each source is independently optional, so a failed source leaves its last
 * known-good snapshot (or bundled fallback) in place.
 */
export async function refreshDatabases(): Promise<void> {
    const sources = {
        trackerDomains: 'https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/domain_summary.json',
        trackerEntities: 'https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/entity_map.json',
        cookies: 'https://raw.githubusercontent.com/jkwakman/Open-Cookie-Database/master/open-cookie-database.csv',
        easyPrivacy: 'https://easylist.to/easylist/easyprivacy.txt',
        disconnect: 'https://raw.githubusercontent.com/nicedoc/tracking-protection-lists/main/services.json',
    } as const;

    const tasks = [
        Promise.all([fetchJson(sources.trackerDomains), fetchJson(sources.trackerEntities)])
            .then(([domains, entities]) => writeRemoteSnapshot('trackerRadar', buildRemoteTrackerRadar(domains, entities))),
        fetchText(sources.cookies).then(text => writeRemoteSnapshot('cookieDB', buildRemoteCookieDatabase(text))),
        fetchText(sources.easyPrivacy).then(text => writeRemoteSnapshot('easyPrivacy', buildRemoteEasyPrivacyList(text))),
        fetchJson(sources.disconnect).then(data => writeRemoteSnapshot('disconnect', buildRemoteDisconnectMap(data))),
    ];
    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
        if (result.status === 'rejected') console.warn(`[DatabaseLoader] Refresh source ${index + 1} failed:`, result.reason);
    });
    if (results.every(result => result.status === 'rejected')) {
        throw new Error('All database refresh sources failed');
    }
    _trackerRadar = null;
    _cookieDB = null;
    _easyPrivacySet = null;
    _disconnectMap = null;
    _compiledWildcards = null;
    console.log('[DatabaseLoader] Privacy database refresh completed');
}

/**
 * Load and cache the DuckDuckGo Tracker Radar database.
 */
export async function getTrackerRadar(): Promise<Record<string, TrackerRadarEntry>> {
    if (_trackerRadar) return _trackerRadar;
    try {
        const remote = await readRemoteSnapshot<Record<string, TrackerRadarEntry>>('trackerRadar');
        if (remote && Object.keys(remote).length > 0) {
            _trackerRadar = remote;
            console.log(`[DatabaseLoader] Remote Tracker Radar loaded: ${Object.keys(_trackerRadar).length} domains`);
            return _trackerRadar;
        }
        const data = await import('../../assets/tracker-radar.json');
        _trackerRadar = (data.default || data) as Record<string, TrackerRadarEntry>;
        console.log(`[DatabaseLoader] Tracker Radar loaded: ${Object.keys(_trackerRadar).length} domains`);
    } catch (e) {
        console.warn('[DatabaseLoader] Tracker Radar not found, using empty DB. Run: node scripts/build-databases.js');
        _trackerRadar = {};
    }
    return _trackerRadar;
}

/**
 * Load and cache the Open Cookie Database.
 */
export async function getCookieDB(): Promise<CookieDatabase> {
    if (_cookieDB) return _cookieDB;
    try {
        const remote = await readRemoteSnapshot<CookieDatabase>('cookieDB');
        if (remote && remote.exact && Array.isArray(remote.wildcards)) {
            _cookieDB = remote;
            _compiledWildcards = _cookieDB.wildcards.map(w => ({ regex: new RegExp(w.regex, 'i'), entry: w.entry }));
            console.log(`[DatabaseLoader] Remote Cookie DB loaded: ${Object.keys(_cookieDB.exact).length} exact entries`);
            return _cookieDB;
        }
        const data = await import('../../assets/cookie-database.json');
        _cookieDB = (data.default || data) as CookieDatabase;
        // Pre-compile wildcard regexes
        _compiledWildcards = (_cookieDB.wildcards || []).map(w => ({
            regex: new RegExp(w.regex, 'i'),
            entry: w.entry,
        }));
        console.log(`[DatabaseLoader] Cookie DB loaded: ${Object.keys(_cookieDB.exact).length} exact, ${_cookieDB.wildcards.length} wildcards`);
    } catch (e) {
        console.warn('[DatabaseLoader] Cookie DB not found, using empty DB. Run: node scripts/build-databases.js');
        _cookieDB = { exact: {}, wildcards: [] };
        _compiledWildcards = [];
    }
    return _cookieDB;
}

/**
 * Load and cache the EasyPrivacy domain set.
 */
export async function getEasyPrivacySet(): Promise<Set<string>> {
    if (_easyPrivacySet) return _easyPrivacySet;
    try {
        const remote = await readRemoteSnapshot<string[]>('easyPrivacy');
        if (remote && remote.length > 0) {
            _easyPrivacySet = new Set(remote);
            console.log(`[DatabaseLoader] Remote EasyPrivacy loaded: ${_easyPrivacySet.size} domains`);
            return _easyPrivacySet;
        }
        const data = await import('../../assets/easyprivacy-domains.json');
        const arr = (data.default || data) as string[];
        _easyPrivacySet = new Set(arr);
        console.log(`[DatabaseLoader] EasyPrivacy loaded: ${_easyPrivacySet.size} domains`);
    } catch (e) {
        console.warn('[DatabaseLoader] EasyPrivacy not found, using empty set. Run: node scripts/build-databases.js');
        _easyPrivacySet = new Set();
    }
    return _easyPrivacySet;
}

/**
 * Load and cache the Disconnect services map.
 */
export async function getDisconnectMap(): Promise<Record<string, DisconnectEntry>> {
    if (_disconnectMap) return _disconnectMap;
    try {
        const remote = await readRemoteSnapshot<Record<string, DisconnectEntry>>('disconnect');
        if (remote && Object.keys(remote).length > 0) {
            _disconnectMap = remote;
            console.log(`[DatabaseLoader] Remote Disconnect DB loaded: ${Object.keys(_disconnectMap).length} domains`);
            return _disconnectMap;
        }
        const data = await import('../../assets/disconnect-services.json');
        _disconnectMap = (data.default || data) as Record<string, DisconnectEntry>;
        console.log(`[DatabaseLoader] Disconnect loaded: ${Object.keys(_disconnectMap).length} domains`);
    } catch (e) {
        console.warn('[DatabaseLoader] Disconnect not found, using empty map. Run: node scripts/build-databases.js');
        _disconnectMap = {};
    }
    return _disconnectMap;
}

/**
 * Looks up a cookie name in the Open Cookie Database.
 * Checks exact match first, then wildcard patterns.
 * Returns null if not found.
 */
export async function lookupCookie(cookieName: string): Promise<CookieDBEntry | null> {
    const db = await getCookieDB();
    const lowerName = cookieName.toLowerCase();

    // 1. Exact match
    if (db.exact[lowerName]) return db.exact[lowerName];

    // 2. Wildcard match (pre-compiled regexes)
    if (_compiledWildcards) {
        for (const { regex, entry } of _compiledWildcards) {
            if (regex.test(cookieName)) return entry;
        }
    }

    return null;
}

/**
 * Looks up a domain in the Tracker Radar database.
 * Tries exact match, then parent domain (e.g., sub.tracker.com → tracker.com).
 */
export async function lookupTrackerDomain(domain: string): Promise<TrackerRadarEntry | null> {
    const radar = await getTrackerRadar();
    const lower = domain.toLowerCase();

    // 1. Exact match
    if (radar[lower]) return radar[lower];

    // 2. Try parent domain (strip one subdomain level)
    const parts = lower.split('.');
    if (parts.length > 2) {
        const parent = parts.slice(1).join('.');
        if (radar[parent]) return radar[parent];
    }

    // 3. Try two levels up
    if (parts.length > 3) {
        const grandParent = parts.slice(2).join('.');
        if (radar[grandParent]) return radar[grandParent];
    }

    return null;
}

/**
 * Checks if a domain is in any of the privacy blocklists.
 */
export async function isTrackerDomain(domain: string): Promise<boolean> {
    const [radar, easyprivacy, disconnect] = await Promise.all([
        getTrackerRadar(),
        getEasyPrivacySet(),
        getDisconnectMap(),
    ]);

    const lower = domain.toLowerCase();
    if (radar[lower]) return true;
    if (easyprivacy.has(lower)) return true;
    if (disconnect[lower]) return true;

    // Check parent domain
    const parts = lower.split('.');
    if (parts.length > 2) {
        const parent = parts.slice(1).join('.');
        if (radar[parent] || easyprivacy.has(parent) || disconnect[parent]) return true;
    }

    return false;
}

/**
 * Gets the Disconnect category for a domain.
 * Maps Disconnect category names to our internal category strings.
 */
export async function getDisconnectCategory(domain: string): Promise<string | null> {
    const map = await getDisconnectMap();
    const lower = domain.toLowerCase();

    const entry = map[lower] || (domain.split('.').length > 2 ? map[domain.split('.').slice(1).join('.').toLowerCase()] : null);
    if (!entry) return null;

    const CAT_MAP: Record<string, string> = {
        'Advertising': 'advertising',
        'Analytics': 'analytics',
        'Social': 'social',
        'Content': 'content',
        'Cryptomining': 'cryptomining',
        'Fingerprinting': 'fingerprinting',
        'FingerprintingInvasive': 'fingerprinting',
    };
    return CAT_MAP[entry.category] || entry.category.toLowerCase();
}

/**
 * Pre-warms all databases by loading them all at once.
 * Call this during extension startup to avoid cold-load delay on first analysis.
 */
export async function preWarmDatabases(): Promise<void> {
    await Promise.all([
        getTrackerRadar(),
        getCookieDB(),
        getEasyPrivacySet(),
        getDisconnectMap(),
    ]);
    console.log('[DatabaseLoader] All databases pre-warmed and ready');
}
