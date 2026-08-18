# AGENTS.md

Guidelines for AI agents working in this repository.

## Releases

- Every release **must** include a `CHANGELOG.md` entry containing **What's new** and/or **What was fixed** sections that describe the user-facing changes.
- Add the changelog entry for the new version at the top of `CHANGELOG.md` (newest first) before tagging.
- The release workflow pulls the top `CHANGELOG.md` section into the GitHub release body, so do not tag a release without first writing its entry.
- Bump the version with `npm version patch|minor|major` from `traceguard-extension/` (single source of truth is `package.json`), then push commits and tags.

## Versioning

- Follow SemVer (`MAJOR.MINOR.PATCH`); see `VERSIONING.md`.
- PATCH: bug fixes, small internal changes. MINOR: new features (new detector, new database, new UI section). MAJOR: breaking changes.
