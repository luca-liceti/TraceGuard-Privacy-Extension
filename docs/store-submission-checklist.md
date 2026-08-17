# Chrome Web Store Submission Checklist

Everything you need to prepare by hand for the first store submission. The
code and release pipeline are ready; these are the store-listing assets and
dashboard answers that only you can provide. (The previous versions of these
assets live in git history at commit `bbb9fdb` under `docs/store-listing/` if
you want to reuse any of them.)

## 1. Store item (created in the dashboard)

- [ ] Create the item at https://chrome.google.com/webstore/devconsole
- [ ] Upload the release ZIP (from the GitHub Release, e.g.
      `traceguard-extension-v1.3.0.zip`)
- [ ] Copy the extension **ID** from the item page and save it as the
      `EXTENSION_ID` repo variable if you ever want store auto-upload

## 2. Listing content

- [ ] **Name**: TraceGuard Privacy Extension
- [ ] **Short description** (up to 132 chars): e.g. "Real-time privacy scoring
      and protection. See exactly how websites track you and get a live
      privacy score for every site you visit."
- [ ] **Full description**: features, how it works, privacy guarantees
      (everything runs locally, open source, no data leaves the device)
- [ ] **Category**: Productivity (or Security)
- [ ] **Language**: English (United States)

## 3. Visual assets (must be exact sizes)

- [ ] **Icon**: 128x128 PNG (exists at
      `traceguard-extension/src/assets/icons/icon-128.png`); also upload the
      16/48 sizes if asked
- [ ] **Screenshots**: at least 3, exactly **1280x800** (or 640x400). The
      committed `docs/screenshots/*.png` are ~1919x944 and won't be accepted;
      you need to produce 1280x800 captures. Recoverable versions from
      `bbb9fdb` if you want a starting point.
- [ ] **Promo tiles**: 1400x560 (small tile) and 440x280 (marquee). Also
      recoverable from `bbb9fdb`.

## 4. Privacy & data questionnaire

- [ ] Paste the **privacy policy URL**:
      https://luca-liceti.github.io/TraceGuard-Privacy-Extension/
- [ ] Answer the **data usage questionnaire** (single purpose, no remote data
      collection, no ads, no analytics, no selling of data)
- [ ] Confirm the **single purpose**: privacy scoring and protection

## 5. Permission justifications (write one for each)

The store asks you to justify every permission. Draft these:

- [ ] `storage` / `unlimitedStorage` — settings, activity logs, and score
      history stored locally on the device; never sent anywhere
- [ ] `sidePanel` — the side panel showing the current site's privacy score
- [ ] `tabs` — reading the active tab's URL to score the current site
- [ ] `notifications` — alerting you to critical privacy/security findings
- [ ] `alarms` — scheduled background tasks (e.g. threat feed refresh)
- [ ] `downloads` — saving JSON exports (activity logs, data backups) to your device; the file is written locally and never sent anywhere
- [ ] `webRequest` — observing network requests to detect trackers
- [ ] `host_permissions` (`*://*/*`) — "Read and change all your data on all
      websites" — required to scan page content and detect trackers/PII in
      real time on every site

## 6. Before you hit submit

- [ ] Test the extension in Chrome (load unpacked from `traceguard-extension/dist`)
- [ ] Confirm the version in the dashboard matches the ZIP you upload
- [ ] Every future upload must be a **higher** version than the last
      (bump via `npm version` from `traceguard-extension/`)
