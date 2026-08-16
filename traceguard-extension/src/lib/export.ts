/**
 * =============================================================================
 * EXPORT — Single canonical "Export Data" path
 * =============================================================================
 *
 * Both the Settings modal and the search-command palette route through
 * `exportAllData` so they behave identically. The exported backup:
 *   - never includes the raw buffer encryption key (`bufferKeyHex`)
 *   - decrypts vault fields only when the vault is unlocked (so the backup is
 *     actually usable)
 *   - strips cookie values and request query strings as a defensive measure
 *   - can be password-protected with PBKDF2-SHA256 + AES-GCM
 * =============================================================================
 */

import {
    decryptData,
    deriveKeyFromPassword,
    encryptData,
    generateSalt,
    importKey,
} from './crypto';

const PBKDF2_ITERATIONS = 600000;

// Fields that are stored AES-GCM-encrypted when the vault is unlocked.
const VAULT_FIELDS: Array<[string, 'object' | 'array']> = [
    ['siteCache', 'object'],
    ['crossSiteExposure', 'object'],
    ['scoreHistory', 'array'],
    ['piiDetections', 'array'],
    ['detectorLogs', 'array'],
    ['notifications', 'array'],
];

type Translate = (key: string) => string;

function triggerDownload(json: string, passwordProtected: boolean): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traceguard-backup${passwordProtected ? '-encrypted' : ''}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Gathers, sanitizes, optionally encrypts, and downloads a full data backup.
 * Throws if the user cancels the password prompt or supplies a weak password.
 */
export async function exportAllData(t: Translate): Promise<boolean> {
    const protect = confirm(
        t('Protect the export with a password? (OK = encrypted, Cancel = unencrypted)')
    );

    let password = '';
    if (protect) {
        const entered = window.prompt(t('Enter a password to encrypt your backup (minimum 8 characters):'));
        if (entered === null) return false; // cancelled
        password = entered.trim();
        if (password.length < 8) {
            throw new Error('password-too-short');
        }
    }

    const allData: Record<string, unknown> = await chrome.storage.local.get(null);

    // Never export the raw buffer key — it would let a reader decrypt
    // locked-vault buffered telemetry.
    delete allData.bufferKeyHex;
    delete allData.cryptoKeyHex; // defensive: should never be in local anyway

    // Decrypt vault fields (only possible while unlocked) so the backup is usable.
    const session = await chrome.storage.session.get<{ cryptoKeyHex?: string }>('cryptoKeyHex');
    if (session.cryptoKeyHex) {
        const key = await importKey(session.cryptoKeyHex);
        for (const [field, kind] of VAULT_FIELDS) {
            if (typeof allData[field] === 'string') {
                allData[field] = (await decryptData(key, allData[field] as string)) ?? (kind === 'object' ? {} : []);
            }
        }
    }

    // Defensively strip legacy cookie values / query strings.
    if (allData.siteCache && typeof allData.siteCache === 'object') {
        for (const site of Object.values(allData.siteCache as Record<string, any>)) {
            const enriched = site?.enrichedDetails;
            if (enriched?.cookies?.items) {
                for (const c of enriched.cookies.items) delete c.value;
            }
            if (enriched?.networkRequests?.items) {
                for (const r of enriched.networkRequests.items) {
                    if (typeof r.url === 'string') {
                        try {
                            const u = new URL(r.url);
                            r.url = u.origin + u.pathname;
                        } catch {
                            /* keep as-is */
                        }
                    }
                }
            }
        }
    }

    if (password) {
        const salt = generateSalt();
        const key = await deriveKeyFromPassword(password, salt);
        const payload = await encryptData(key, allData);
        const envelope = {
            format: 'traceguard-backup',
            version: 1,
            encrypted: true,
            kdf: {
                name: 'PBKDF2-SHA256',
                iterations: PBKDF2_ITERATIONS,
                salt: Array.from(salt),
            },
            payload,
        };
        triggerDownload(JSON.stringify(envelope, null, 2), true);
    } else {
        triggerDownload(JSON.stringify(allData, null, 2), false);
    }

    return true;
}
