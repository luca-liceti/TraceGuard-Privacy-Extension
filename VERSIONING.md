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

Releases are cut from `main`. `dev` is the integration branch and normally runs ahead of `main`, so
land `dev` on `main` before tagging: a tag on a commit that exists only on `dev` is not a release.
See the Branches section of [`.agents/AGENTS.md`](.agents/AGENTS.md) and record
[0009](adr/0009-dev-branch-workflow.md).

1. Write the entry at the top of `CHANGELOG.md` first. The release workflow copies the **top
   section** of that file into the GitHub release body, so tagging without an entry ships an empty
   release.
2. Bump the version from `traceguard-extension/`:
   ```bash
   npm version patch     # or minor / major
   ```
   This updates `package.json` and `package-lock.json`, commits, and creates a tag like `v1.3.1`.
   Keep the version bump and the changelog entry in the same commit as the change they describe.
3. Verify it still builds: `npm run build`.
4. Push both the commit and the tag:
   ```bash
   git push && git push --tags
   ```
5. The `Release` workflow builds `traceguard-extension-<tag>.zip`, creates a GitHub release whose
   body is the top section of `CHANGELOG.md`, uploads the ZIP to the Chrome Web Store, and
   submits it for review. `DEFAULT_PUBLISH` publishes it automatically after approval.

## Chrome Web Store publishing

The release workflow uploads the built ZIP to the Chrome Web Store and submits it for review.
Set these once in the repo (Settings > Secrets and variables > Actions):

- Secrets: `CHROME_WEB_STORE_CLIENT_ID`, `CHROME_WEB_STORE_CLIENT_SECRET`,
  `CHROME_WEB_STORE_REFRESH_TOKEN`. Generate them with the
  [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys) tool
  (Google API OAuth credentials for your store developer account). The refresh token needs the
  `https://www.googleapis.com/auth/chromewebstore` scope.
- Variables: `PUBLISHER_ID` and `EXTENSION_ID`. `PUBLISHER_ID` is shown under **Publisher >
  Settings** in the Chrome Web Store Developer Dashboard. `EXTENSION_ID` is the item ID from the
  same dashboard.

To create the OAuth credentials:

1. In a Google Cloud project, enable the **Chrome Web Store API** and configure an OAuth consent
   screen.
2. Create an OAuth client ID of type **Web application** and add
   `https://developers.google.com/oauthplayground` as an authorized redirect URI.
3. In the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground), open the settings
   and use your own client ID and secret. Authorize the
   `https://www.googleapis.com/auth/chromewebstore` scope, then exchange the authorization code
   for tokens. Copy the refresh token.
4. Turn on 2-Step Verification for the Google account that owns the item. Google requires it to
   publish or update an extension.

The API cannot create a new item. The listing must already exist, with its Store listing and
Privacy tabs filled in, before the first automated upload.

The step is skipped when any of these are absent (for example on forks). The `upload:store` script
uses `chrome-webstore-upload` with no subcommand, which uploads and then calls `publish` with
`DEFAULT_PUBLISH`. The item is published automatically after Google approves it.

The API can only upload and publish the package, check status, roll back, and set a staged deploy
percentage. It cannot change listing screenshots, the description, category, privacy answers, or
visibility. Update those in the Developer Dashboard before or after the release.
