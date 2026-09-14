# 0005. The ledger gets its own page and a usefulness gate

**Status:** Accepted
**Date:** 2026-09-13

## Context

The ledger is indexed by the user's data: field type to domains, company to sites. The Overview page
is indexed by site visit: stat cards and a time-ordered table. Both grouping models on one page
would make each harder to read. The direction was also unproven, and the extension already has a
pattern of shipping surfaces that take credit for work they do not do.

## Decision

`/exposure` is its own route and sidebar entry. Overview is unchanged and remains the landing page.
Phase 1 is read-only, with no actions.

The direction continues only if real use supports it: after two weeks the page must have named
holders the user had genuinely forgotten, and the user must have returned to it unprompted. If it
did not surprise anyone, the page is deleted rather than extended.

## Consequences

- A clean removal if the idea fails: one page, one route, one nav entry.
- Discoverability is the main risk. A page nobody visits fails the gate for the wrong reason, so a
  link from Overview is a reasonable mitigation rather than a compromise.
- The gate is agreed before the work starts, so the decision is not made while invested in it.
- Phase 2, and everything downstream of it, is blocked until the gate passes.
