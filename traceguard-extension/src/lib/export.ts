/**
 * =============================================================================
 * EXPORT, Single canonical "Export Data" path
 * =============================================================================
 *
 * Both the Settings modal and the search-command palette route through
 * `exportAllData` so they behave identically. The exported backup:
 *   - never includes the raw buffer encryption key (`bufferKeyHex`)
 *   - decrypts vault fields only when the vault is unlocked (so the backup is
 *     actually usable)
 *   - strips cookie values and request query strings as a defensive measure
 *   - can be password-protected with PBKDF2-SHA256 + AES-GCM
 *
 * The password decision and prompt live in the UI (ExportDataDialog), not here,
 * so the export never relies on browser `confirm`/`prompt` dialogs.
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

/**
 * Reliably saves a JSON payload to the user's machine and resolves only when
 * the browser has actually finished writing the file (or rejects when the
 * save was cancelled or interrupted). Uses the `downloads` API when available
 * so the caller never shows a false "exported" toast for a save that did not
 * happen.
 */
export async function downloadJson(json: string, filename: string): Promise<void> {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    if (typeof chrome.downloads?.download === 'function') {
        const id = await chrome.downloads.download({ url, filename, saveAs: false });
        await new Promise<void>((resolve, reject) => {
            const listener = (delta: chrome.downloads.DownloadDelta) => {
                if (delta.id !== id || !delta.state) return;
                chrome.downloads.onChanged.removeListener(listener);
                URL.revokeObjectURL(url);
                if (delta.state.current === 'complete') {
                    resolve();
                } else {
                    reject(new Error(`Download ended with state '${delta.state.current}'`));
                }
            };
            chrome.downloads.onChanged.addListener(listener);
        });
        return;
    }

    // Fallback for contexts without the downloads permission: anchor click.
    // The blob URL must outlive the save, so revoke it late instead of
    // immediately — an immediate revoke can abort a download that is waiting
    // on the OS "save as" dialog.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function triggerDownload(json: string, passwordProtected: boolean): Promise<void> {
    await downloadJson(
        json,
        `traceguard-backup${passwordProtected ? '-encrypted' : ''}-${new Date().toISOString().split('T')[0]}.json`
    );
}

/**
 * Gathers, sanitizes, optionally encrypts, and downloads a full data backup.
 * Pass a non-empty `password` to encrypt the backup, or `null` for a plaintext
 * export. Throws on failure; the caller handles cancellation and toasts.
 */
export async function exportAllData(password: string | null): Promise<void> {
    const allData: Record<string, unknown> = await chrome.storage.local.get(null);

    // Never export the raw buffer key, it would let a reader decrypt
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
        await triggerDownload(JSON.stringify(envelope, null, 2), true);
    } else {
        await triggerDownload(JSON.stringify(allData, null, 2), false);
    }
}
