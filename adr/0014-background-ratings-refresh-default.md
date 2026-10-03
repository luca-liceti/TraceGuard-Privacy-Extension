# 0014. The background privacy-ratings catalog refresh is on by default

**Status:** Accepted
**Date:** 2026-10-02

## Context

Policy ratings from ToS;DR feed the WSS and the PII gate (`adr/0006-asymmetric-policy-ratings.md`),
so a stale rating is a wrong signal at the moment a warning matters. ADR 0001 already permits a
network request that carries no user data: the signed threat-feed refresh downloads a fixed
blocklist and sends nothing.

The background ratings refresh (`refreshTosdrCatalog` in `src/background/tosdr-api.ts`) has the same
shape. It fetches the same fixed catalog pages for every user and sends no domain, so it reveals
nothing about which sites the user visits. Its schedule lives in `databaseRefreshDays`
(`src/lib/storage.ts`). It defaulted to off (`0`), which froze every rating at the bundled build
date until the next extension update, so the two settings that control ratings shared a conservative
default despite having opposite privacy shapes.

## Decision

The background catalog refresh defaults to **on at 7 days** for new installs. Live Rating Lookup
(`enableCloudTosdr`), which sends the host of the site being visited, stays off by default. Existing
installs keep `0`: migration `1 -> 2` reset them because they never opted into the catalog fetch,
and that reset is preserved. An install that never had the field takes the new default.

The product rules say the default must be safe and that doing nothing must not be a mistake. Since
this fetch carries nothing about the user, freshness is the safe default and staying stale was the
mistake, while the per-site lookup remains opt-in because it does transmit a domain.

## Consequences

- New installs score against current ToS;DR grades with no per-site disclosure.
- Existing installs stay at `0` and enable it themselves, so no one is opted into the fetch
  silently.
- The two ratings settings no longer share a default, which matches their different privacy shapes.
- This adds load to ToS;DR's volunteer API. The sweep fetches fixed listing pages, only
  detail-fetches services whose `updated_at` moved, and `CATALOG_MAX_DETAILS` bounds each run.
- ADR 0001's category of downloads that carry nothing now has two members: the threat feed and the
  ratings catalog refresh.
