# TraceGuard Privacy Policy

Effective date: November 17, 2026

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
- The timestamp of the last weekly digest shown, so the digest appears at most once a week. The
  digest itself is built on demand from the records above. It is shown as an in-app toast,
  recorded as a notification entry, and available as a section at the top of Your Footprint;
  beyond that entry it creates no new record of your activity and is never transmitted.

The personal-info confirmation card reads the existing cross-site record before it adds the new
entry, so its context describes what the ledger already knew. It does not create a separate
history.

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

TraceGuard is local-first. Live rating lookups and Local Policy Reports are optional. The per-site
ToS;DR lookup is **off by default**; its public ratings-catalog refresh is **on by default for new
installs** and runs on the schedule you choose. Signed threat-feed updates also run automatically;
these shared catalog and threat-feed requests do not include the sites you visit.

- **Look up a site's rating when I visit it.** When enabled, TraceGuard sends the domain of a site
  that is missing from its local data, or whose rating is old, to ToS;DR to look up a
  privacy-policy rating. This reveals that domain to ToS;DR. No other browsing data is included,
  and you can disable it at any time. If it is disabled, missing sites are shown as having no
  rating rather than being looked up.
- **Keep the ratings database current.** On by default for new installs, running on a schedule you
  choose. TraceGuard fetches ToS;DR's public ratings catalog. This request is the same for every
  user and does **not** include or reveal the sites you visit. It only updates ratings the extension
  already knows about.

Ratings returned by either request are cached locally in `tosdr_cache`, a plaintext map of domain to
grade that holds no page data. If both ToS;DR options are off, ratings only change when a new version
of the extension ships.

- **Local AI summaries.** Off by default. If you turn it on, TraceGuard uses its existing website
  access permission to contact Ollama at `http://localhost:11434`. When you request a current-site
audit, it sends that site's domain, overall and detector scores, tracker/cookie counts and
categories, fingerprinting attempts and techniques, missing security-header names, ToS;DR grade,
and up to three adverse ToS;DR point titles. When you request the Overview audit, it sends counts
and score bands across analyzed sites, the lowest- and highest-scoring sample of sites with their
recorded findings, and aggregated counts and scores for recorded form entries. These records mean
typing started, not that data was submitted or received. It never sends page text, sensitive field
types, typed values, the personal-data ledger, raw URLs, tracker URLs, cookie names, or activity
logs. The server and model are chosen and run by you; Ollama may keep prompts according to its own
local settings. Returned text is checked against supplied facts and discarded if it introduces
unsupported numbers, domains, names, or claims about a form entry being submitted. Audits exist
only in the open view and are not saved. Turning the setting off stops future requests.
- **Local policy report.** Off by default. When enabled, TraceGuard automatically starts a report
  for an unrated site shown in the side panel or popup when no saved report exists and the selected
  policy-capable Ollama model is loaded on this device. It looks for a policy using ToS;DR document
  links, links on the page, or common paths such as `/privacy-policy`, then fetches up to four
  candidates without
  cookies or other site credentials. Each policy host receives an ordinary page request and can
  observe its network metadata, including your IP address. TraceGuard reads static HTML locally
  without running page scripts. If none of those pages contains readable policy text, it may briefly
  open one inactive tab so the browser can render the highest-ranked candidate. That fallback uses
  your browser session and may send applicable cookies; it may appear in the tab strip or history, and
  the tab is closed after reading. Up to 30,000 characters of the selected policy text and its page
  address are sent only to Ollama on this device. The report is provisional, keeps the quotes it was
  based on, and never changes the site's score. It is stored on this device for seven days, so
  revisiting that site uses the saved report rather than reading the policy or running the model
  again. Turning the setting off deletes stored reports. If no policy can be found or read, it says
  so instead of guessing.

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
