/**
 * Data Migration Service
 * Handles schema versioning and data transformations between versions.
 *
 * Each entry in MIGRATIONS maps a "from" version to a function that upgrades
 * storage from that version to the next one. runDataMigrations applies them in
 * order until the storage schema reaches CURRENT_SCHEMA_VERSION. A missing
 * step between two versions is a programming error and fails loudly instead of
 * silently skipping the migration.
 */

import { logEvent } from '../../lib/diagnostics';

const CURRENT_SCHEMA_VERSION = 2;

// Ordered upgrade steps, keyed by the version they migrate FROM.
const MIGRATIONS: Record<number, () => Promise<void>> = {
    1: async () => {
        // `databaseRefreshDays` used to drive only the phishing-feed alarm, so
        // every install was read as "7 days" without the user meaning anything
        // by it. It now controls the background privacy-ratings catalog fetch,
        // so reset a positive value to off: nobody opted into that fetch, and
        // the phishing feed refreshes on its own regardless of this setting.
        const { settings } = await chrome.storage.local.get<{ settings?: Record<string, unknown> }>('settings');
        if (settings && typeof settings.databaseRefreshDays === 'number' && settings.databaseRefreshDays > 0) {
            await chrome.storage.local.set({ settings: { ...settings, databaseRefreshDays: 0 } });
        }
    },
};

export async function runDataMigrations(): Promise<void> {
    const { schemaVersion } = await chrome.storage.local.get<{ schemaVersion?: number }>('schemaVersion');

    const initialVersion = schemaVersion ?? 0;
    let current = initialVersion;

    if (current > CURRENT_SCHEMA_VERSION) {
        // A downgrade (e.g. an older extension build opened newer data) must not
        // run migrations backwards; leave the data untouched.
        logEvent('storage', 'warn', 'schema_downgrade_refused', 'Storage schema is newer than this build; refusing to downgrade', {
            stored: current,
            build: CURRENT_SCHEMA_VERSION,
        });
        return;
    }

    while (current < CURRENT_SCHEMA_VERSION) {
        const from = current;
        const to = current + 1;
        const migrate = MIGRATIONS[from];

        // Version 0 is the pre-versioning baseline; skipping 0 -> 1 is expected.
        // Any other gap is a bug that would leave data half-migrated.
        if (!migrate && from >= 1) {
            throw new Error(`[Migrations] Missing migration step for ${from} -> ${to}`);
        }

        if (migrate) {
            logEvent('storage', 'debug', 'schema_upgrading', 'Upgrading storage schema', { from, to });
            await migrate();
        }

        current = to;
    }

    // Only persist the version when it actually advanced, so a no-op run
    // leaves storage untouched (important for tests and for avoiding a write
    // storm on every startup).
    if (current !== initialVersion) {
        await chrome.storage.local.set({ schemaVersion: CURRENT_SCHEMA_VERSION });
    }
    logEvent('storage', 'debug', 'schema_current', 'Storage schema is up to date', { version: CURRENT_SCHEMA_VERSION });
}
