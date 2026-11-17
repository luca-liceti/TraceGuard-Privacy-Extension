# 0017. A policy report finds and reads the policy itself

**Status:** Accepted
**Date:** 2026-10-21

## Context

The local policy report, added by [0016](0016-bundled-summarization-model.md), only worked if the
user
had already opened the privacy policy page. The background read the active tab, and the content
script refused any page whose path or title did not look like a policy. So the button meant "now
report on this policy page I found myself", not "report on this site's policy". For a site with no
ToS;DR rating, which is exactly the case the report exists for, the user had to hunt through a
footer, open a new page, then come back and press the button. Most will not.

Discovery and reading were also missing. `detectLocalPrivacyPolicy` collected policy anchors on every
page and discarded the list, keeping only a boolean for the policy score.

## Decision

**An opt-in setting enables automatic reports for unrated sites shown in the popup or side panel.**
When enabled, and no saved report exists, TraceGuard finds and reads the policy if a
policy-capable Ollama model is loaded, without a separate report button or prompt. No new permission is needed.

**Capture is fetch-first and tab-free by default.** The service worker fetches up to four candidate
pages using the extension's existing broad host permission. A bounded response body is parsed with
`parse5`, which reads static HTML without creating a live page or running its scripts. The manifest
permits HTTP(S) connections under `connect-src` for this request, without allowing remote scripts.The fetch omits cookies and other site credentials, so a policy host still receives an ordinary page
request and can observe its network metadata, including the user's IP address. Redirects are rejected
by the fetch path; server rendering and browser privacy controls can still make a page unavailable or
return content different from what a normal tab displays.

**One inactive-tab fallback is retained.** If none of the fetched candidates produces enough
validated policy text, the highest-ranked candidate is opened in an inactive tab so JavaScript-built
text can render and the existing content-script extraction can read it. It is closed in a `finally`,
even after a failed or timed-out read. This means most static policies do not open a tab, but a
rendered fallback uses the normal browser session and may send applicable cookies; it can briefly
appear in the tab strip or browser history. No browser API provides a
general-purpose hidden, fully rendered page that avoids those effects.

**Discovery is tiered, cheapest first:**

1. ToS;DR's own `documents` URLs, when the service is catalogued. Already fetched; previously unused.
2. Policy anchors on the page, ranked by link text and path.
3. Common paths on the site's origin, tried only when ToS;DR documents and page links found no
   candidates. The list includes `/privacy`, `/privacy-policy`, `/privacy-notice`, `/legal/privacy`,
   `/legal/privacy-policy`, `/policies/privacy`, `/terms`, `/terms-of-service`, `/legal/terms`, and
   `/cookie-policy`; up to eight candidates are considered, and the capture still fetches at most four.

There is no manual URL-entry step.

A candidate counts only if it renders at least 500 characters that look like policy text. That is what
rejects soft 404s, redirects to the homepage, and consent or geo-gate pages.

**The report run never raises the site score.** This record changes how the text is obtained, not what
a generated rating may do, so [0006](0006-asymmetric-policy-ratings.md) still governs the output.

## Consequences

- **Network behaviour to disclose.** When Local Policy Reports is enabled, no saved report exists, a
  capable model is loaded, and an unrated site is shown in the popup or side panel, the extension
  fetches up to four policy candidates. This uses existing host access and sends no cookies or site
  credentials; each policy host receives an ordinary request and can observe its network metadata,
  including the user's IP address. Static HTML is parsed locally; only the selected policy text and
  address are sent to the user's Ollama server on this device. An inactive tab is opened only as a
  fallback for pages that cannot be read from fetched HTML. That fallback uses the browser session,
  may send applicable cookies, and can appear in the tab strip or history. `PRIVACY.md` and
  `PRIVACY_AND_PERMISSIONS.md` describe both paths.
- **Capture tabs must not be analyzed.** A fallback tab would otherwise record the policy's domain
  as a visited site. Capture tabs carry a `#tg-policy-capture` fragment, and the content script returns
  before analysis when it sees it. The fragment is stripped from the URL recorded with the report.
- **A page can be policy-shaped and still unreadable.** Login walls, bot challenges, PDF policies and
  iframe-only text are reported as "could not read" rather than retried forever.
- **The report is now case-based, following Docbot's shape.** The model selects cases from a closed
  list and points at the numbered sentence that supports each one; the extension resolves the
  sentence and derives the score and grade from the selected cases. See `CREDITS.md` for what that
  borrows from Docbot, and what it deliberately does not.
- **The borrowed shape is credited.** `CREDITS.md` names Docbot, ToS;DR and the model and data
  projects this software depends on. The case statements are this project's own wording, not copies
  of ToS;DR's Cases.
