# TraceGuard Privacy Policy

Effective date: August 16, 2026

TraceGuard is a **local-first privacy journal**. It analyzes the pages you visit on your own
device to help you understand and change your browsing habits, and stores that analysis locally
in Chrome extension storage. It has no backend and no user accounts.

## What TraceGuard records (stored locally on your device)

- Domain names you visit, timestamps, and per-site privacy/safety scores.
- Tracker domains and cookie **names** with metadata (HttpOnly / Secure / SameSite flags, expiry,
  third-party status). Cookie values are never stored or transmitted - only the name and these
  metadata flags are kept.
- Third-party request origins and paths (query strings and URL fragments are discarded).
- Browser fingerprinting attempts and HTTP security headers observed on pages.
- The **type** of sensitive form field you interacted with (e.g. "password", "email"), never the
  value you typed.

## What TraceGuard does NOT do

- It never stores or transmits the contents of form fields, passwords, or other entered data.
  To know that a field was filled in, TraceGuard only checks whether it is non-empty; the entered
  value itself is never logged or sent anywhere.
- It never stores cookie values or full request URLs. Cookie values that are transiently exposed
  by `document.cookie` are discarded immediately and never used, stored, or transmitted.
- It does not use analytics, telemetry, advertising SDKs, or any form of cross-site tracking.

## External network requests

TraceGuard is 100% local by default. The only optional external request is **Enhanced Policy
Analysis**, which is **off by default**. If you enable it, TraceGuard sends the domain of unrated
sites to ToS;DR (`api.tosdr.org`) to look up a privacy-policy rating; no other browsing data is
included, and you can disable it at any time in Settings.

Threat-intelligence data (phishing/malware domain lists from public feeds such as OpenPhish) is
bundled at release time and refreshed from the publisher via signed updates. Those update requests
contain no browsing or account data.

## Encryption and control

Sensitive history is encrypted with a master password you create (the "vault"). While the vault is
locked, new journal entries are held in temporary in-memory storage (cleared when the browser
closes) and encrypted on disk once you unlock. You can review, export, or clear all locally stored
data from TraceGuard Settings at any time.

## Contact

For privacy questions, contact us at **traceguardprivacyextension@gmail.com**. You can also reach the publisher through the Chrome Web Store listing.
