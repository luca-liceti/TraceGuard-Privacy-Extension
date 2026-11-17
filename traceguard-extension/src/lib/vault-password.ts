/**
 * =============================================================================
 * VAULT PASSWORD - One verification path for unlock and destructive actions
 * =============================================================================
 *
 * The vault stores a salt and a validator encrypted with the password-derived
 * key. Decrypting the validator to the known marker proves the password without
 * storing the password itself. The unlock screen and the export dialog both use
 * this helper, so they cannot disagree about what a valid password is.
 * =============================================================================
 */

import { deriveKeyFromPassword } from './crypto';

const VALIDATOR_TEXT = 'TraceGuardValidator';

export type VaultPasswordVerification =
    | { ok: true; key: CryptoKey }
    | { ok: false; reason: 'not-set-up' | 'invalid' };

/**
 * Derives the vault key and verifies it against the stored validator.
 * A missing salt or validator means this installation has no vault yet.
 */
export async function verifyVaultPassword(password: string): Promise<VaultPasswordVerification> {
    const local = await chrome.storage.local.get<{ cryptoSalt?: number[]; validator?: string }>([
        'cryptoSalt',
        'validator',
    ]);
    if (!local.cryptoSalt || !local.validator) {
        return { ok: false, reason: 'not-set-up' };
    }
    if (!password) {
        return { ok: false, reason: 'invalid' };
    }

    try {
        const key = await deriveKeyFromPassword(password, new Uint8Array(local.cryptoSalt));

        const binary = atob(local.validator);
        const combined = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            combined[index] = binary.charCodeAt(index);
        }

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: combined.slice(0, 12) },
            key,
            combined.slice(12)
        );
        if (new TextDecoder().decode(decrypted) !== VALIDATOR_TEXT) {
            return { ok: false, reason: 'invalid' };
        }
        return { ok: true, key };
    } catch {
        return { ok: false, reason: 'invalid' };
    }
}
