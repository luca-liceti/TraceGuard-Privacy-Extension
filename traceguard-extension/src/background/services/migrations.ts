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

const CURRENT_SCHEMA_VERSION = 1;

// Ordered upgrade steps, keyed by the version they migrate FROM.
// Example (future):
//   2: async () => {
//     // migrate v2 -> v3
//   },
const MIGRATIONS: Record<number, () => Promise<void>> = {};

export async function runDataMigrations(): Promise<void> {
    const { schemaVersion } = await chrome.storage.local.get<{ schemaVersion?: number }>('schemaVersion');

    const initialVersion = schemaVersion ?? 0;
    let current = initialVersion;

    if (current > CURRENT_SCHEMA_VERSION) {
        // A downgrade (e.g. an older extension build opened newer data) must not
        // run migrations backwards; leave the data untouched.
        console.warn(
            `[Migrations] Storage schema v${current} is newer than this build (v${CURRENT_SCHEMA_VERSION}); refusing to downgrade.`
        );
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
            console.log(`[Migrations] Upgrading schema ${from} -> ${to}`);
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
    console.log(`[Migrations] Storage schema is up to date (v${CURRENT_SCHEMA_VERSION}).`);
}
