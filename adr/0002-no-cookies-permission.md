# 0002. No `cookies` permission; cookie metadata comes from `Set-Cookie` headers

**Status:** Accepted
**Date:** 2026-09-13

## Context

Tracking-cookie detection needs cookie names and metadata (HttpOnly, Secure, SameSite, expiry,
domain). The obvious route is the `cookies` permission, which grants read access to cookies. That
permission is broad, it alarms users and store reviewers, and it implies the extension could read
values it does not need.

## Decision

Request `webRequest` in its observational form only, not `cookies`. Derive cookie names and
metadata from `Set-Cookie` response headers during page load, supplemented by names visible in the
DOM. Cookie values are never read, stored, or transmitted. Values transiently exposed by
`document.cookie` are discarded immediately.

## Consequences

- One fewer sensitive permission to justify, and the questionnaire can state plainly that values
  are never read.
- Cookies set before the extension was installed, and cookies set by background requests the
  monitor does not observe, are invisible.
- The derived picture is therefore incomplete by design, and the UI must not present it as a full
  inventory.
- Detection quality depends on `Set-Cookie` coverage, so any change to `network-monitor.ts` that
  drops response-header observation silently degrades this detector.
