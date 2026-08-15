/**
 * =============================================================================
 * GENERATE THREAT-FEED SIGNING KEYS — Ed25519 keypair
 * =============================================================================
 *
 * Generates an Ed25519 keypair used to sign the remote phishlist update
 * (phishlist.signed.json). The PUBLIC key is embedded in the extension and
 * used at runtime to verify updates. The PRIVATE key must never be committed;
 * it is written to scripts/keys/threat-signing-key.pem (gitignored via *.pem)
 * and should also be stored as a GitHub Actions secret named THREAT_SIGNING_KEY
 * so CI can produce signed releases.
 *
 * Run: node scripts/generate-threat-keys.js
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_FILE = path.join(KEYS_DIR, 'threat-signing-key.pem');

function main() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    console.error(`[threat-keys] ${PRIVATE_KEY_FILE} already exists. Refusing to overwrite.`);
    console.error('[threat-keys] Delete it first if you intend to rotate keys (this invalidates all previously signed feeds).');
    process.exit(1);
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  // Ed25519 public keys have no raw DER export; grab the raw 32 bytes from JWK.
  const jwk = publicKey.export({ format: 'jwk' }); // { kty: 'OKP', crv: 'Ed25519', x: base64url }
  const publicKeyHex = Buffer.from(jwk.x, 'base64url').toString('hex');

  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(PRIVATE_KEY_FILE, privPem, { mode: 0o600 });

  console.log('[threat-keys] Generated Ed25519 keypair.');
  console.log('[threat-keys] Private key (KEEP SECRET, gitignored):', PRIVATE_KEY_FILE);
  console.log('[threat-keys] Public key hex (embed in src/background/services/threat-feed.ts):');
  console.log(publicKeyHex);
  console.log('[threat-keys] Store the private key as a GitHub Actions secret named THREAT_SIGNING_KEY for CI.');
}

main();
