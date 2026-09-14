# 0003. PII detection records field types only, on the first keystroke

**Status:** Accepted
**Date:** 2026-09-13

## Context

The extension needs to warn a user before they hand personal data to an untrustworthy site, and it
needs to build a record of what was given where. To be trustworthy it must be incapable of leaking
what the user typed.

## Decision

The content script attaches an `input` listener to fields it classifies as sensitive and reports
the interaction once `value.length > 0` (`src/content/pii-detector.ts:124`). It never reads the
value. The payload is the field type, the sensitivity, the domain, a timestamp, and page context.

Recording happens on the first character typed into a field, once per field. Submission is not
observed.

## Consequences

- The extension cannot leak a typed value, because it never holds one.
- The record means "the user started typing here", not "the site received this". An abandoned form
  is indistinguishable from a submitted one. This is the known false-positive class, it is why the
  ledger offers forget, and fixing the trigger is the better long-term fix.
- Product copy must not claim to know what a site received.
- Anything that reads field values would break the guarantee this record depends on, so it needs a
  new record rather than an edit.
