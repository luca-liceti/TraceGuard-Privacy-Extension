import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// Align test crypto with browser environment used by the extension
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}

function canonicalizeValue(value, type) {
  if (!value) return '';
  const trimmed = String(value).trim();
  switch (type) {
    case 'phone':
    case 'ssn':
    case 'credit':
      return trimmed.replace(/\D/g, '');
    case 'email':
      return trimmed.toLowerCase();
    default:
      return trimmed;
  }
}

async function fingerprintValue(value, type) {
  const canonical = canonicalizeValue(value, type);
  if (!canonical) return '';
  const enc = new TextEncoder().encode(canonical);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureLogFingerprints(logs) {
  const sanitized = [];

  for (const log of logs) {
    if (!log) {
      sanitized.push(log);
      continue;
    }

    if (log.fingerprint && /^[0-9a-f]{64}$/i.test(log.fingerprint)) {
      sanitized.push({ ...log, value: log.fingerprint });
      continue;
    }

    if (log.value && /^[0-9a-f]{64}$/i.test(log.value)) {
      sanitized.push({ ...log, fingerprint: log.value });
      continue;
    }

    if (typeof log.value === 'string' && log.value) {
      const fp = await fingerprintValue(log.value, log.type);
      sanitized.push({ ...log, fingerprint: fp, value: fp || '' });
      continue;
    }

    sanitized.push({ ...log, value: '', fingerprint: '' });
  }

  return sanitized;
}

test('fingerprintValue normalizes phone formatting', async () => {
  const inputA = '555-123-4567';
  const inputB = '(555) 123-4567';

  const canonicalA = canonicalizeValue(inputA, 'phone');
  const canonicalB = canonicalizeValue(inputB, 'phone');

  assert.equal(canonicalA, '5551234567');
  assert.equal(canonicalA, canonicalB);

  const fingerprintA = await fingerprintValue(inputA, 'phone');
  const fingerprintB = await fingerprintValue(inputB, 'phone');

  assert.equal(fingerprintA.length, 64);
  assert.equal(fingerprintA, fingerprintB);
});

test('ensureLogFingerprints scrubs plaintext values', async () => {
  const logs = [
    { type: 'email', value: 'alice@example.com', shortDisplay: 'a••••@example.com' },
    { type: 'phone', value: '5551234567', shortDisplay: '••••4567' },
    { type: 'email', value: 'b7f4d5d0e7c1f8a2c8451a2c841234567890abcdef1234567890abcdef123456', shortDisplay: 'b••••@domain.com' }
  ];

  const sanitized = await ensureLogFingerprints(logs);

  sanitized.forEach(entry => {
    assert.ok(entry.fingerprint, 'fingerprint should be populated');
    assert.equal(entry.fingerprint.length, 64);
    if (entry.value) {
      assert.equal(entry.value, entry.fingerprint);
    }
  });
});

test('canonicalizeValue handles custom types without mutation', () => {
  const raw = '   Driver License 12345  ';
  const canonical = canonicalizeValue(raw, 'license');

  assert.equal(canonical, 'Driver License 12345');
  assert.ok(canonical.includes('12345'));
});
