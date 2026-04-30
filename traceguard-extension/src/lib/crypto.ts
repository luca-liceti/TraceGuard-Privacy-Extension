/**
 * =============================================================================
 * CRYPTO LAYER - Bitwarden-Style Encryption
 * =============================================================================
 * 
 * Provides AES-GCM encryption and PBKDF2 key derivation.
 * Used to lock the extension and protect sensitive telemetry.
 */

const ALGO_NAME = 'AES-GCM';
const PBKDF2_ITERATIONS = 600000;
const PBKDF2_HASH = 'SHA-256';

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user password and salt.
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array, extractable = true): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: PBKDF2_HASH
        },
        keyMaterial,
        { name: ALGO_NAME, length: 256 },
        extractable,
        ['encrypt', 'decrypt']
    );
}

/**
 * Converts a string to an ArrayBuffer.
 */
function str2ab(str: string): ArrayBuffer {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

/**
 * Encrypts arbitrary data (objects, strings) using AES-GCM.
 * Returns a Base64-encoded string containing both IV and ciphertext.
 */
export async function encryptData(key: CryptoKey, data: any): Promise<string> {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(data));
    
    // Generate a random 12-byte IV for GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: ALGO_NAME, iv: iv },
        key,
        encodedData
    );
    
    // Combine IV and ciphertext for storage
    const ciphertext = new Uint8Array(ciphertextBuffer);
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
}

/**
 * Decrypts a Base64-encoded string back to its original data.
 */
export async function decryptData<T>(key: CryptoKey, encryptedBase64: string): Promise<T | null> {
    try {
        const binary = atob(encryptedBase64);
        const combined = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            combined[i] = binary.charCodeAt(i);
        }
        
        // Extract IV and ciphertext
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: ALGO_NAME, iv: iv },
            key,
            ciphertext
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedBuffer)) as T;
    } catch (err) {
        console.error("Decryption failed", err);
        return null;
    }
}

/**
 * Exports a CryptoKey to a raw hex string for storing in chrome.storage.session
 */
export async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    const exportedArray = new Uint8Array(exported);
    return Array.from(exportedArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Imports a hex string key from chrome.storage.session back to a CryptoKey
 */
export async function importKey(hexStr: string): Promise<CryptoKey> {
    const raw = new Uint8Array(hexStr.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return crypto.subtle.importKey(
        'raw',
        raw,
        { name: ALGO_NAME },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Utility to generate a random salt
 */
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
}
