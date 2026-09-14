# 0004. The footprint ledger is a pure aggregation, not a stored artifact

**Status:** Accepted
**Date:** 2026-09-13

## Context

`crossSiteExposure`, `piiDetections`, and `siteCache` already contain what is needed to answer
"which sites hold my data" and "which companies covered my browsing". The data existed and was read
by nothing. The tempting implementation is a derived store kept up to date as events arrive.

## Decision

`buildExposureReport` in `src/lib/exposure.ts` is a pure function over those three inputs. It makes
no `chrome.*` calls and imports no React, so it is testable without a browser. `useExposureReport`
in `src/lib/useStorage.ts` reads and decrypts the three keys, calls the function, and memoizes the
result. Nothing new is persisted.

## Consequences

- The rules live in one testable file, and the ledger cannot disagree with its sources because it
  has none of its own.
- No new encrypted blob, no migration, and no extra key in the privacy policy.
- Aggregation runs in memory whenever the inputs change. That is fine at current sizes, but a very
  large `siteCache` would need reconsideration, especially because `crossSiteExposure` grows without
  bound.
- Anything that needs history the sources do not keep, such as values over time, would require a
  store and therefore a new record.
