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

**One button in the policy section of the site card finds and reads the policy.** No notification,
no prompt, no new permission.

**Capture reads a page in an inactive tab, not with `fetch`.** A service-worker fetch is blocked by
this extension's own `connect-src`, returns unrendered HTML, and arrives without `SameSite=Lax`
cookies. An inactive tab is governed by none of those: it renders JavaScript-built policies, carries
the user's session, and reuses the content script's existing extraction. The tab is closed in a
`finally`, including on load failure or timeout.

**Discovery is tiered, cheapest first:**

1. ToS;DR's own `documents` URLs, when the service is catalogued. Already fetched; previously unused.
2. Policy anchors on the page, ranked by link text and path.
3. Common paths on the site's origin: `/privacy`, `/privacy-policy`, `/privacy-notice`,
   `/legal/privacy`, `/legal/privacy-policy`, `/policies/privacy`, `/terms`, `/terms-of-service`,
   `/legal/terms`, `/cookie-policy`. At most eight, only when the first two tiers found nothing.
4. Pasted URL, only when all three fail.

A candidate counts only if it renders at least 500 characters that look like policy text. That is what
rejects soft 404s, redirects to the homepage, and consent or geo-gate pages.

**The report run never raises the site score.** This record changes how the text is obtained, not what
a generated rating may do, so [0006](0006-asymmetric-policy-ratings.md) still governs the output.

## Consequences

- **New behaviour to disclose.** Pressing the button opens a URL the user did not choose to open.
  `PRIVACY.md` and `PRIVACY_AND_PERMISSIONS.md` must say so, including that the page can appear in
  browser history. Nothing is sent anywhere except the user's own Ollama server.
- **Capture tabs must not be analyzed.** A hidden tab would otherwise record the policy's domain as a
  visited site. Capture tabs carry a `#tg-policy-capture` fragment, and the content script returns
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
