# Chrome Web Store Privacy and Permissions Justification

When submitting TraceGuard to the Chrome Web Store, use the following justifications for the requested permissions. This helps reviewers understand why these permissions are necessary for the core functionality of the extension and reduces the risk of rejection.

## Required Permissions

### `storage` and `unlimitedStorage`
**Why it is needed:** TraceGuard runs entirely on the user's local device without relying on external servers. To store the local activity logs, privacy score history, PII tracking databases, and cached domain scores without hitting Chrome's 5MB local storage quota limits, we require `unlimitedStorage`. The `storage` permission is also required to securely persist encrypted vault keys in `chrome.storage.session`.

### `sidePanel`
**Why it is needed:** TraceGuard provides an always-available side panel view for users who want to monitor their privacy score and site analytics persistently as they browse across different tabs, instead of relying solely on the popup.

### `tabs`
**Why it is needed:** We use the `tabs` permission to detect when the user switches to a different webpage so we can update the extension's badge icon, update the side panel context to the newly active tab, and clear unneeded data from inactive background states.

### `notifications` and `alarms`
**Why it is needed:** TraceGuard alerts users in real-time if a highly dangerous site is detected or if severe PII exfiltration is caught in network requests. `alarms` are used to schedule periodic background updates to our local tracking database to ensure the user has the latest tracker signatures.

### `cookies`
**Why it is needed:** TraceGuard analyzes cookies placed by websites to detect third-party tracking cookies, supercookies, and prolonged expiration dates. The extension *only reads* cookie attributes to calculate the site's privacy score and never modifies them or sends them to an external server.

### `webRequest`
**Why it is needed:** To detect tracking pixels, analytics scripts, and potential PII exfiltration in network requests (e.g. form submissions, telemetry pings) before they leave the browser, TraceGuard requires passive observation of network requests via `webRequest`.

## Host Permissions

### `*://*/*`
**Why it is needed:** TraceGuard is a global privacy protector designed to score the privacy practices of *every* website a user visits. To inject the content script that analyzes on-page forms (for PII detection) and to intercept third-party tracking network requests across the web, broad host permissions are strictly necessary.

---

## Privacy Policy Compliance Note
- **No Data Collection:** TraceGuard does not collect, transmit, or monetize user data. All telemetry, logs, and scores are processed and encrypted locally on the device.
- **Data Deletion:** The user has full control to wipe their data instantly via the dashboard settings using the "Factory Reset" option.
