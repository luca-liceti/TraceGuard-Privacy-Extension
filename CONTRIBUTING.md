# Contributing to TraceGuard

Thanks for contributing! TraceGuard is a local-first Chrome extension (Manifest V3) built with
React, Vite, TypeScript, and Tailwind CSS (shadcn/ui). The extension code lives in the
`traceguard-extension/` directory.

## Project rules

- Always recompile the project when finished editing.
- When dealing with colors, always ensure they respect the light and dark theme toggle.
- When adding or replacing a UI section, it must be taken from an existing popular shadcn template.
- **Actionable Data over Vanity Metrics**: prioritize genuinely useful information over vanity
  metrics when designing data visualizations, charts, or dashboards. Every data point should
  provide real value or understanding of privacy risks.

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
5. Open a pull request against `main`.

## License

TraceGuard is licensed under AGPL-3.0 (see [LICENSE](LICENSE)). Contributions are licensed under
the same terms.
