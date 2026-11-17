/**
 * =============================================================================
 * SITE CACHE - Encrypted per-site analyses, split into shards
 * =============================================================================
 *
 * WHAT CHANGED AND WHY:
 * The cache used to be one encrypted object under `siteCache`. Every page load
 * decrypted that whole object, added one domain, and wrote it back. Once a
 * heavy user reached the 5,000-domain cap, each navigation re-encrypted tens of
 * megabytes and sorted every entry. That scales linearly with browsing history.
 *
 * The cache is now 64 encrypted shards, `siteCache:v1:00` to `siteCache:v1:63`.
 * A navigation writes one shard, so its cost is about 1/64 of the old write and
 * does not grow with the rest of the history.
 *
 * WHAT STAYS THE SAME:
 * - Values are AES-GCM encrypted with the vault key.
 * - Storage keys reveal only a shard number, never a domain.
 * - The cap stays about 5,000 sites. A shard has a safety valve at 240 entries,
 *   and the daily cleanup alarm trims the merged cache to the exact cap.
 * - A one-time migration splits a legacy `siteCache` blob into shards.
 * =============================================================================
 */

import { DECRYPT_FAILED, decryptDataStrict, encryptData } from './crypto';
import { captureError, logEvent } from './diagnostics';
import type { SiteRiskData } from './types';

/** Prefix shared by every shard key. */
export const SITE_CACHE_PREFIX = 'siteCache:v1:';
/** Number of shards. A write touches one of them. */
export const SITE_CACHE_SHARDS = 64;
/** Total domains kept across all shards. Enforced by the daily cleanup alarm. */
export const SITE_CACHE_MAX_SITES = 5000;

const LEGACY_KEY = 'siteCache';
// A single shard can hold at most about 1/64 of the cap. The safety valve only
// fires for a pathological distribution; normal use never reaches it.
const SHARD_SAFETY_LIMIT = 240;
const SHARD_SAFETY_TARGET = 160;

export type SiteCacheMap = Record<string, SiteRiskData>;
export type SiteCacheShardMap = Record<number, SiteCacheMap>;

// The legacy blob is checked once per context, not once per navigation.
let legacyMigrationComplete = false;
let migrationPromise: Promise<boolean> | null = null;
// Serializes read-modify-write cycles within this context. The worker also
// queues telemetry writes; this chain protects callers that do not.
let writeChain: Promise<void> = Promise.resolve();

function serializeWrite<T>(task: () => Promise<T>): Promise<T> {
    const next = writeChain.then(task, task);
    writeChain = next.then(() => undefined, () => undefined);
    return next;
}

/** FNV-1a. Only chooses a shard, never a security boundary. */
function fnv1a(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

export function siteCacheShard(domain: string): number {
    return fnv1a(domain.toLowerCase()) % SITE_CACHE_SHARDS;
}

export function siteCacheShardKey(shard: number): string {
    return `${SITE_CACHE_PREFIX}${String(shard).padStart(2, '0')}`;
}

export function siteCacheShardKeys(): string[] {
    return Array.from({ length: SITE_CACHE_SHARDS }, (_, shard) => siteCacheShardKey(shard));
}

export function parseSiteCacheShardKey(key: string): number | null {
    if (!key.startsWith(SITE_CACHE_PREFIX)) return null;
    const raw = key.slice(SITE_CACHE_PREFIX.length);
    if (!/^\d{2}$/.test(raw)) return null;
    const shard = Number(raw);
    return shard >= 0 && shard < SITE_CACHE_SHARDS ? shard : null;
}

function isPlainMap(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Drops entries that are not site records, so a corrupt write cannot poison reads. */
function normalizeMap(value: unknown): SiteCacheMap {
    if (!isPlainMap(value)) return {};
    const out: SiteCacheMap = {};
    for (const [domain, site] of Object.entries(value)) {
        if (site && typeof site === 'object' && !Array.isArray(site)) {
            out[domain] = site as SiteRiskData;
        }
    }
    return out;
}

/**
 * Decrypts one shard. Returns null only when the shard exists but cannot be
 * read, so a mutation path can refuse to overwrite it.
 */
async function decryptShard(
    raw: unknown,
    key: CryptoKey | null,
    shard: number
): Promise<SiteCacheMap | null> {
    if (raw === undefined) return {};
    if (typeof raw === 'string') {
        if (!key) return null;
        const decrypted = await decryptDataStrict<SiteCacheMap>(key, raw);
        if (decrypted === DECRYPT_FAILED) {
            captureError(
                'storage',
                new Error(`site cache shard ${shard} could not be decrypted`),
                'site_cache_shard_unreadable',
                { shard }
            );
            return null;
        }
        return normalizeMap(decrypted);
    }
    if (!isPlainMap(raw)) {
        captureError(
            'storage',
            new Error(`site cache shard ${shard} has an unexpected shape`),
            'site_cache_shard_corrupted',
            { shard }
        );
        return {};
    }
    return normalizeMap(raw);
}

export function flattenSiteCacheShards(shards: SiteCacheShardMap): SiteCacheMap {
    const merged: SiteCacheMap = {};
    for (const map of Object.values(shards)) Object.assign(merged, map);
    return merged;
}

/** Reads and decrypts every shard. One storage call, 64 decryptions. */
export async function readSiteCacheShards(key: CryptoKey | null): Promise<SiteCacheShardMap> {
    if (key) await ensureSiteCacheMigrated(key);
    const keys = siteCacheShardKeys();
    const stored = await chrome.storage.local.get(keys);
    const shards: SiteCacheShardMap = {};
    await Promise.all(keys.map(async (storageKey, shard) => {
        const map = await decryptShard(stored[storageKey], key, shard);
        shards[shard] = map ?? {};
    }));
    return shards;
}

export async function readSiteCache(key: CryptoKey | null): Promise<SiteCacheMap> {
    return flattenSiteCacheShards(await readSiteCacheShards(key));
}

/** Reads one shard. Used by the current-site view, which needs one domain. */
export async function readSiteCacheShard(
    shard: number,
    key: CryptoKey | null
): Promise<SiteCacheMap> {
    if (key) await ensureSiteCacheMigrated(key);
    const storageKey = siteCacheShardKey(shard);
    const stored = await chrome.storage.local.get(storageKey);
    return (await decryptShard(stored[storageKey], key, shard)) ?? {};
}

/** Decrypts a shard value already delivered by `chrome.storage.onChanged`. */
export async function decryptSiteCacheShard(
    raw: unknown,
    key: CryptoKey | null,
    shard = -1
): Promise<SiteCacheMap> {
    return (await decryptShard(raw, key, shard)) ?? {};
}

export async function readSiteEntry(
    domain: string,
    key: CryptoKey | null
): Promise<SiteRiskData | undefined> {
    if (!domain) return undefined;
    const map = await readSiteCacheShard(siteCacheShard(domain), key);
    return map[domain];
}

function trimShard(map: SiteCacheMap, shard: number): void {
    const entries = Object.entries(map);
    if (entries.length <= SHARD_SAFETY_LIMIT) return;
    entries.sort(([, a], [, b]) => Number(a.lastAnalyzed ?? 0) - Number(b.lastAnalyzed ?? 0));
    const remove = entries.length - SHARD_SAFETY_TARGET;
    for (const [domain] of entries.slice(0, remove)) delete map[domain];
    logEvent(
        'storage',
        'info',
        'site_cache_shard_trimmed',
        'Trimmed one site cache shard to its safety limit',
        { shard, removed: remove, remaining: SHARD_SAFETY_TARGET }
    );
}

/** Writes one site, touching only its shard. Returns false on an unreadable shard. */
export async function writeSiteCacheEntry(site: SiteRiskData, key: CryptoKey): Promise<boolean> {
    if (!site?.domain) return false;
    if (!(await ensureSiteCacheMigrated(key))) return false;
    return serializeWrite(async () => {
        const shard = siteCacheShard(site.domain);
        const storageKey = siteCacheShardKey(shard);
        const stored = await chrome.storage.local.get(storageKey);
        const current = await decryptShard(stored[storageKey], key, shard);
        if (current === null) return false;
        current[site.domain] = site;
        trimShard(current, shard);
        await chrome.storage.local.set({ [storageKey]: await encryptData(key, current) });
        return true;
    });
}

/** Merges many sites, one read-write cycle per affected shard. */
export async function mergeSiteCacheEntries(entries: SiteCacheMap, key: CryptoKey): Promise<boolean> {
    if (!entries || Object.keys(entries).length === 0) return true;
    if (!(await ensureSiteCacheMigrated(key))) return false;
    return serializeWrite(async () => {
        const grouped = new Map<number, SiteCacheMap>();
        for (const site of Object.values(entries)) {
            if (!site?.domain) continue;
            const shard = siteCacheShard(site.domain);
            const group = grouped.get(shard) ?? {};
            group[site.domain] = site;
            grouped.set(shard, group);
        }
        for (const [shard, group] of grouped) {
            const storageKey = siteCacheShardKey(shard);
            const stored = await chrome.storage.local.get(storageKey);
            const current = await decryptShard(stored[storageKey], key, shard);
            if (current === null) return false;
            Object.assign(current, group);
            trimShard(current, shard);
            await chrome.storage.local.set({ [storageKey]: await encryptData(key, current) });
        }
        return true;
    });
}

/** Replaces the whole cache. Used by import, where a merge would leave stale domains. */
export async function replaceSiteCache(entries: SiteCacheMap, key: CryptoKey): Promise<boolean> {
    return serializeWrite(async () => {
        const shards: SiteCacheShardMap = {};
        for (let shard = 0; shard < SITE_CACHE_SHARDS; shard += 1) shards[shard] = {};
        for (const site of Object.values(entries)) {
            if (!site?.domain) continue;
            shards[siteCacheShard(site.domain)][site.domain] = site;
        }
        const payload: Record<string, string> = {};
        for (let shard = 0; shard < SITE_CACHE_SHARDS; shard += 1) {
            trimShard(shards[shard], shard);
            payload[siteCacheShardKey(shard)] = await encryptData(key, shards[shard]);
        }
        await chrome.storage.local.set(payload);
        await chrome.storage.local.remove(LEGACY_KEY);
        legacyMigrationComplete = true;
        return true;
    });
}

export async function removeSiteCache(): Promise<void> {
    await chrome.storage.local.remove([LEGACY_KEY, ...siteCacheShardKeys()]);
    legacyMigrationComplete = true;
}

/**
 * Splits a legacy single-blob `siteCache` into shards. Safe to call on every
 * cache operation: the check is memoized after the first successful run, and a
 * locked or unreadable vault leaves the legacy blob in place for a later try.
 */
export async function ensureSiteCacheMigrated(key: CryptoKey): Promise<boolean> {
    if (legacyMigrationComplete) return true;
    if (!migrationPromise) {
        migrationPromise = migrateLegacySiteCache(key).finally(() => {
            migrationPromise = null;
        });
    }
    return migrationPromise;
}

async function migrateLegacySiteCache(key: CryptoKey): Promise<boolean> {
    const stored = await chrome.storage.local.get(LEGACY_KEY);
    const raw = stored[LEGACY_KEY];
    if (raw === undefined) {
        legacyMigrationComplete = true;
        return true;
    }

    let map: SiteCacheMap;
    if (typeof raw === 'string') {
        const decrypted = await decryptDataStrict<SiteCacheMap>(key, raw);
        if (decrypted === DECRYPT_FAILED) {
            captureError(
                'storage',
                new Error('siteCache could not be decrypted during migration'),
                'site_cache_migration_failed'
            );
            return false;
        }
        map = normalizeMap(decrypted);
    } else {
        map = normalizeMap(raw);
    }

    const written = await replaceSiteCache(map, key);
    if (written) {
        logEvent('storage', 'info', 'site_cache_migrated', 'Split the site cache into encrypted shards', {
            sites: Object.keys(map).length,
            shards: SITE_CACHE_SHARDS,
        });
    }
    return written;
}

/**
 * Trims the merged cache to `SITE_CACHE_MAX_SITES`, oldest analysis first.
 * Runs from the daily cleanup alarm, so the cost is paid once a day rather
 * than on every navigation.
 */
export async function enforceSiteCacheCap(key: CryptoKey): Promise<number> {
    if (!(await ensureSiteCacheMigrated(key))) return 0;
    return serializeWrite(async () => {
        const shards = await readSiteCacheShards(key);
        const entries = Object.entries(flattenSiteCacheShards(shards));
        if (entries.length <= SITE_CACHE_MAX_SITES) return 0;

        entries.sort(([, a], [, b]) => Number(a.lastAnalyzed ?? 0) - Number(b.lastAnalyzed ?? 0));
        const remove = entries.length - SITE_CACHE_MAX_SITES;
        const byShard = new Map<number, string[]>();
        for (const [domain] of entries.slice(0, remove)) {
            const shard = siteCacheShard(domain);
            const list = byShard.get(shard) ?? [];
            list.push(domain);
            byShard.set(shard, list);
        }

        let removed = 0;
        for (const [shard, domains] of byShard) {
            const map = shards[shard];
            for (const domain of domains) {
                delete map[domain];
                removed += 1;
            }
            await chrome.storage.local.set({
                [siteCacheShardKey(shard)]: await encryptData(key, map),
            });
        }

        logEvent('storage', 'info', 'site_cache_cap_enforced', 'Trimmed the site cache to its cap', {
            before: entries.length,
            removed,
            remaining: entries.length - removed,
        });
        return removed;
    });
}

/** Test helper: clears the migration memo and the write chain. */
export function resetSiteCacheStateForTests(): void {
    legacyMigrationComplete = false;
    migrationPromise = null;
    writeChain = Promise.resolve();
}
