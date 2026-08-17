# Chrome Web Store Data-Usage Questionnaire (paste-ready)

The developer dashboard asks a set of questions about user data. TraceGuard is local-first, which
makes this straightforward, but be precise: the form treats reading data on-device as "collection"
even when nothing is transmitted. Answer exactly as below.

## Core questions

**Does your extension comply with the Chrome Web Store User Data Policy?**
> Yes.

**Does your product collect or use sensitive user data?**
> Select: **Yes, it processes browsing activity data, but only on the user's device.**
> In the explanation box paste:
> TraceGuard reads on-device browsing activity (domains visited, cookie names and metadata, form
> field types) to compute privacy scores. All processing and storage happen locally in the browser.
> No browsing data is transmitted to any server. The only optional external request is Enhanced
> Policy Analysis, which is OFF by default and sends only the domain of an unrated site to ToS;DR.

**What data does your product collect?**
> Select the applicable categories:
> - **Web browsing activity** (domains visited, timestamps, per-site scores; stored locally)
> - **Content of non-sensitive form fields** (only the TYPE of sensitive field, e.g. "password",
>   never the value typed)
> - **Other** (cookie names and metadata only, never cookie values)
> In the explanation box paste:
> TraceGuard stores locally: domains visited with timestamps and scores, tracker/cookie names with
> metadata (flags, expiry, third-party status), third-party request origins, and the type of
> sensitive form field interacted with. It never reads or stores the contents of forms, passwords,
> or entered data.

**Is any of this data transmitted?**
> Select: **No** (with the exception below).
> Explanation:
> No browsing data leaves the device. Optional Enhanced Policy Analysis (off by default) sends only
> the domain of an unrated site to ToS;DR. Threat-feed update requests contain no browsing or
> account data, and downloads are signature-verified.

## Data handling and security

**Is the data encrypted in transit?**
> Select: **Not applicable** (no browsing data is transmitted). Any optional request uses HTTPS.

**Is the data encrypted at rest?**
> Select: **Yes, in part.**
> Explanation:
> Sensitive history can be encrypted behind an optional master password (the "vault", AES-256-GCM).
> Non-sensitive settings and cached scores are stored in chrome.storage.local.

**Do you sell or transfer user data?**
> Select: **No.**

**Do you use the data for purposes unrelated to the extension's stated functionality?**
> Select: **No.**

**Do you allow third parties to access user data?**
> Select: **No.**

## Remote code and services

**Does your product use remote code, remote services, or server-side code?**
> Select: **No remote code.**
> Explanation:
> The extension contains no remote code. It fetches static data only: a signature-verified
> phishing blocklist update and (optionally, off by default) a ToS;DR policy rating for unrated
> domains. Both are data, never executable code.

## Certification

**I certify that I will comply with the Chrome Web Store User Data Policy.**
> Yes.

---

## Notes for the reviewer

- Permissions justification: see `traceguard-extension/PRIVACY_AND_PERMISSIONS.md` in the repo.
- Full privacy policy: `PRIVACY.md` (hosted at the GitHub Pages URL).
- The extension has no accounts, no backend, and no telemetry; it works fully offline.
