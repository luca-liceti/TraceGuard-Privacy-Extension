// Syncs the version from package.json (the single source of truth) into
// manifest.json. Runs automatically as the "prebuild" hook so the committed
// manifest always matches the package version.
// Usage: node scripts/sync-version.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const manifestPath = join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`, "utf8");
  console.log(`Synced manifest.json version -> ${pkg.version}`);
} else {
  console.log(`manifest.json version already ${pkg.version}`);
}
