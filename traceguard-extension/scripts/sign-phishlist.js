/**
 * =============================================================================
 * SIGN PHISHLIST, Produce a signed remote threat-feed artifact
 * =============================================================================
 *
 * Reads src/assets/phishlist.json (built by build-phishlist.js) and emits
 * src/assets/phishlist.signed.json containing the payload plus an Ed25519
 * signature over the canonical payload `{ version, updated, domains }`.
 *
 * The private key is read from, in order:
 *   1. The THREAT_SIGNING_KEY environment variable (PEM string), used in CI.
 *   2. scripts/keys/threat-signing-key.pem, used locally.
 *
 * Run: node scripts/sign-phishlist.js
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INPUT_FILE = path.join(__dirname, '../src/assets/phishlist.json');
const OUTPUT_FILE = path.join(__dirname, '../src/assets/phishlist.signed.json');
const PRIVATE_KEY_FILE = path.join(__dirname, 'keys/threat-signing-key.pem');

/** Canonical byte string that the runtime verifier reproduces identically. */
function canonicalPayload(version, updated, domains) {
  return JSON.stringify({ version, updated, domains });
}

function getPrivateKeyPem() {
  if (process.env.THREAT_SIGNING_KEY) return process.env.THREAT_SIGNING_KEY;
  if (fs.existsSync(PRIVATE_KEY_FILE)) return fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');
  throw new Error(
    '[sign-phishlist] No signing key found. Set THREAT_SIGNING_KEY, or run scripts/generate-threat-keys.js first.'
  );
}

function main() {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const { version, updated, domains } = data;

  if (!Array.isArray(domains) || domains.length === 0) {
    throw new Error('[sign-phishlist] phishlist.json has no domains, refusing to sign an empty feed.');
  }

  const canonical = canonicalPayload(version, updated, domains);
  const privateKey = crypto.createPrivateKey(getPrivateKeyPem());
  const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKey);

  const out = {
    version,
    updated,
    domains,
    signature: signature.toString('base64'),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`[sign-phishlist] Signed ${domains.length} domains -> ${OUTPUT_FILE}`);
}

main();
