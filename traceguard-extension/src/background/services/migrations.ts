/**
 * Data Migration Service
 * Handles schema versioning and data transformations between versions.
 */

const CURRENT_SCHEMA_VERSION = 1;

export async function runDataMigrations() {
    try {
        const { schemaVersion } = await chrome.storage.local.get<{ schemaVersion?: number }>('schemaVersion');
        
        let currentVersion = schemaVersion;
        
        if (currentVersion === undefined) {
            // First time running migrations on existing or fresh install
            console.log('[Migrations] No schema version found. Setting baseline to version 1.');
            currentVersion = 1;
            await chrome.storage.local.set({ schemaVersion: currentVersion });
        }
        
        if (currentVersion < CURRENT_SCHEMA_VERSION) {
            console.log(`[Migrations] Upgrading schema from ${currentVersion} to ${CURRENT_SCHEMA_VERSION}...`);
            
            // Example Migration Pipeline:
            // if (currentVersion === 1) {
            //     await migrateV1toV2();
            //     currentVersion = 2;
            // }
            
            // Update the stored version after all migrations are successful
            await chrome.storage.local.set({ schemaVersion: CURRENT_SCHEMA_VERSION });
            console.log(`[Migrations] Successfully upgraded to schema version ${CURRENT_SCHEMA_VERSION}.`);
        } else if (currentVersion > CURRENT_SCHEMA_VERSION) {
             console.warn(`[Migrations] Warning: Storage schema version (${currentVersion}) is higher than the extension version (${CURRENT_SCHEMA_VERSION}).`);
        } else {
             console.log(`[Migrations] Storage schema is up to date (v${CURRENT_SCHEMA_VERSION}).`);
        }
    } catch (error) {
        console.error('[Migrations] Failed to run data migrations:', error);
    }
}
