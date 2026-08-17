# Versioning

TraceGuard follows **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`.

The version lives in **one place**: `traceguard-extension/package.json`. Everything else derives
from it automatically, so you never edit the version in more than one file.

## When to bump

Every change that ships counts as a new version. The Chrome Web Store requires each uploaded
version to be strictly higher than the previous one, so any merged change to the extension must
bump the version.

- **PATCH** (`1.3.0` -> `1.3.1`): bug fixes, small internal changes, dependency updates.
- **MINOR** (`1.3.1` -> `1.4.0`): new features or additions (a new detector, a new database, a
  new UI section).
- **MAJOR** (`1.4.0` -> `2.0.0`): large redesigns or breaking changes.

## How the version propagates

`package.json` is the single source of truth. When you run `npm run build`:

1. `scripts/sync-version.mjs` (wired as the `prebuild` hook) writes the version into
   `manifest.json`, so the committed manifest always matches.
2. `vite.config.ts` also injects the version from `package.json` into the built manifest, so the
   packaged extension always matches even if the sync step is skipped.

Other references update on their own:

- `package-lock.json` is updated by `npm version`.
- The README version badge reads the version from `package.json` via shields.io, so it updates
  automatically whenever the version is bumped (no release required).
- The `Release` workflow refuses to build if the git tag does not match `package.json`, so a
  mismatched tag can never produce a mislabeled ZIP.

## Releasing

1. Bump the version from `traceguard-extension/`:
   ```bash
   npm version patch     # or minor / major
   ```
   This updates `package.json` and `package-lock.json`, commits, and creates a tag like `v1.3.1`.
2. Verify it still builds: `npm run build`.
3. Push both the commit and the tag:
   ```bash
   git push && git push --tags
   ```
4. The `Release` workflow builds `traceguard-extension-<tag>.zip`, creates a GitHub release with
   auto-generated notes, and uploads the ZIP to the Chrome Web Store.

## Chrome Web Store publishing

The release workflow uploads the built ZIP to the Chrome Web Store automatically. Set these once
in the repo (Settings > Secrets and variables > Actions):

- Secrets: `CHROME_WEB_STORE_CLIENT_ID`, `CHROME_WEB_STORE_CLIENT_SECRET`,
  `CHROME_WEB_STORE_REFRESH_TOKEN`. Generate them with the
  [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys) tool
  (Google API OAuth credentials for your store developer account).
- Variable: `EXTENSION_ID`, your extension's ID from the Chrome Web Store dashboard.

The upload step is skipped when the credentials are absent (for example on forks). It uploads the
new version for review; you publish it from the Chrome Web Store dashboard once Google approves.
To publish automatically instead, change the `upload:store` script to use `publish` instead of
`upload`.
