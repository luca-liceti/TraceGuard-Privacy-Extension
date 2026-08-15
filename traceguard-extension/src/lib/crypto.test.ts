/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { deriveKeyFromPassword, encryptData, decryptData, generateSalt, exportKey, importKey } from './crypto';

import * as nodeCrypto from 'node:crypto';

// Polyfill web crypto for Node/Vitest environment
if (typeof crypto === 'undefined' || !crypto.subtle) {
  // @ts-expect-error - polyfilling global crypto
  global.crypto = nodeCrypto.webcrypto;
}

describe('Vault Cryptography', () => {
  it('should encrypt and decrypt data roundtrip successfully', async () => {
    const password = 'my-super-secret-password-123!';
    const salt = generateSalt();
    
    // 1. Derive key
    const key = await deriveKeyFromPassword(password, salt);
    expect(key).toBeDefined();

    // 2. Data to encrypt
    const sensitiveData = {
      siteCache: { 'example.com': { safetyScore: 99 } },
      piiDetections: 42,
      lastUpdated: '2026-08-14'
    };

    // 3. Encrypt
    const encryptedText = await encryptData(key, sensitiveData);
    expect(typeof encryptedText).toBe('string');
    expect(encryptedText.length).toBeGreaterThan(0);
    expect(encryptedText).not.toContain('example.com'); // Should not leak plain text

    // 4. Decrypt
    const decryptedData = await decryptData<typeof sensitiveData>(key, encryptedText);
    expect(decryptedData).toBeDefined();
    expect(decryptedData).toEqual(sensitiveData);
  });

  it('should export and import a CryptoKey successfully', async () => {
    const password = 'another-password-456';
    const salt = generateSalt();
    
    // Derive initial key
    const originalKey = await deriveKeyFromPassword(password, salt);
    
    // Export key
    const hexKey = await exportKey(originalKey);
    expect(typeof hexKey).toBe('string');
    expect(hexKey).toMatch(/^[0-9a-f]+$/); // Should be a valid hex string
    
    // Import key
    const importedKey = await importKey(hexKey);
    expect(importedKey).toBeDefined();
    
    // Verify imported key can decrypt data encrypted with original key
    const secretMessage = { msg: 'top secret' };
    const ciphertext = await encryptData(originalKey, secretMessage);
    
    const decrypted = await decryptData(importedKey, ciphertext);
    expect(decrypted).toEqual(secretMessage);
  });

  it('should fail to decrypt with the wrong key', async () => {
    const passwordOne = 'password-one';
    const passwordTwo = 'password-two';
    const salt = generateSalt();
    
    const keyOne = await deriveKeyFromPassword(passwordOne, salt);
    const keyTwo = await deriveKeyFromPassword(passwordTwo, salt);
    
    const data = { msg: 'hello' };
    const ciphertext = await encryptData(keyOne, data);
    
    // Try to decrypt with keyTwo
    const decrypted = await decryptData(keyTwo, ciphertext);
    expect(decrypted).toBeNull();
  });
});
