# Contributing to TraceGuard

Thanks for contributing! TraceGuard is a local-first Chrome extension (Manifest V3) built with
React, Vite, TypeScript, and Tailwind CSS (shadcn/ui). The extension code lives in the
`traceguard-extension/` directory.

## Project rules

The authoritative list of conventions is [`.agents/AGENTS.md`](.agents/AGENTS.md). Read it before
making changes. It covers writing style, diagnostics and failure reporting, commit rules, UI rules,
versioning, and releasing.

The rules are not repeated here on purpose. A second copy drifts, and when the two disagree the
duplicate is the one that gets followed.

## Development workflow

1. Fork the repository and create a feature branch.
2. Install dependencies and build:

   ```bash
   cd traceguard-extension
   npm install
   npm run build      # typecheck + rebuild threat/Tos;DR databases + vite build
   ```

3. Run the checks before opening a pull request:

   ```bash
   npm run typecheck
   npm run test:run
   npm run lint
   ```

4. Load `traceguard-extension/dist` as an unpacked extension in Chrome to verify your changes.
5. Open a pull request against `main` for fixes and small changes. Work that is still in progress,
   such as anything described in `ROADMAP.md`, targets `dev` instead: see
   record [0009](adr/0009-dev-branch-workflow.md).
6. If your change establishes a new convention, update `.agents/AGENTS.md` in the same commit so the
   next contributor inherits it. If it settles a design question, add a record under `adr/`.

## Versioning

Every change that ships counts as a new version. See [VERSIONING.md](VERSIONING.md) for the
SemVer policy and how the version propagates automatically from `package.json`.

## License

TraceGuard is licensed under AGPL-3.0 (see [LICENSE](LICENSE)). Contributions are licensed under
the same terms.
