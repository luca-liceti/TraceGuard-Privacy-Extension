# TraceGuard Privacy Policy

Effective date: September 30, 2026

TraceGuard is a **local-first privacy journal**. It analyzes the pages you visit on your own
device to help you understand and change your browsing habits, and stores that analysis locally
in Chrome extension storage. It has no backend and no user accounts.

## What TraceGuard records (stored locally on your device)

- Domain names you visit, timestamps, and per-site privacy/safety scores.
- Tracker domains and cookie **names** with metadata (HttpOnly / Secure / SameSite flags, expiry,
  third-party status). Cookie values are never stored or transmitted - only the name and these
  metadata flags are kept.
- Third-party request origins only. Request paths, query strings, and URL fragments are discarded
  before anything is stored.
- Browser fingerprinting attempts and HTTP security headers observed on pages.
- The **type** of sensitive form field you interacted with (e.g. "password", "email"), never the
  value you typed. This is recorded on the first character entered into a field, once per field, so
  it means you started typing, not that the site received anything. An abandoned form is recorded
  the same way as a submitted one.
- A cross-site record grouping those field types by the domains they were entered on: which sites
  hold an email, a card number, and so on. This is what the Footprint page in the dashboard reads.
  It is derived from the entries above, stored encrypted alongside them, never transmitted, and
  removed when you clear your data.

## What TraceGuard does NOT do

- It never stores or transmits the contents of form fields, passwords, or other entered data.
  To know that a field was filled in, TraceGuard only checks whether it is non-empty; the entered
  value itself is never logged or sent anywhere.
- It never stores cookie values or full request URLs. Cookie values that are transiently exposed
  by `document.cookie` are discarded immediately and never used, stored, or transmitted.
- It does not use analytics, telemetry, advertising SDKs, or any form of cross-site tracking.
- It does not block network requests. TraceGuard has no blocking permission, so it cannot prevent a
  tracker or an advertisement from loading. A request it records as blocked was blocked by your
  browser or by another extension.

## External network requests

TraceGuard is 100% local by default. Both external requests to ToS;DR (`api.tosdr.org`) are
**off by default**, and each is a separate choice in Settings.

- **Look up a site's rating when I visit it.** When enabled, TraceGuard sends the domain of a site
  that is missing from its local data, or whose rating is old, to ToS;DR to look up a
  privacy-policy rating. This reveals that domain to ToS;DR. No other browsing data is included,
  and you can disable it at any time. If it is disabled, missing sites are shown as having no
  rating rather than being looked up.
- **Keep the ratings database current.** When enabled on a schedule you choose, TraceGuard fetches
  ToS;DR's public ratings catalog. This request is the same for every user and does **not** include,
or reveal, the sites you visit. It only updates ratings the extension already knows about.

Ratings returned by either request are cached locally in `tosdr_cache`, a plaintext map of domain to
grade that holds no page data. If both are off, ratings only change when a new version of the
extension ships.

Threat-intelligence data (phishing/malware domain lists from public feeds such as OpenPhish) is
bundled at release time and refreshed from the publisher via signed updates. That refresh is always
on, because it is a security protection rather than a preference, and those update requests contain
no browsing or account data.

## Encryption and control

Sensitive history is encrypted with a master password you create (the "vault"). While the vault is
locked, new journal entries are held in temporary in-memory storage (cleared when the browser
closes) and encrypted on disk once you unlock. You can review, export, or clear all locally stored
data from TraceGuard Settings at any time.

## Chrome Web Store Limited Use

The use of information received from Google APIs adheres to the Chrome Web Store User Data
Policy, including the [Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use/).
TraceGuard collects no data beyond what is described above, uses it only to provide its single
purpose, and never sells or transfers it.

## Contact

For privacy questions, contact us at **traceguardprivacyextension@gmail.com**. You can also reach the publisher through the Chrome Web Store listing.
