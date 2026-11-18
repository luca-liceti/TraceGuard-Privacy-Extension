# Changelog

Each release ships with **What's new** and/or **What was fixed** describing user-facing changes. The release workflow pulls the top section of this file into the GitHub release body.

## v1.25.4

**What was fixed**

- Exporting a backup no longer reports **Export Failed**. Chrome reports a download as `in_progress` before `complete`, and the export treated the first state as a failure. It now waits for a terminal state, catches a file that finished before the listener attached, and stops waiting after a minute instead of leaving the dialog stuck.
- Saving a theme no longer closes Settings. The theme provider was keyed on the saved theme, so every theme change remounted the app and unmounted the open dialog.
- **Trackers found** now shows the analyzer's raw tracker count. It used to show the weighted number that feeds the tracking score, so a site with 5 trackers could read "Trackers found 25" next to "Known trackers 5".
- The privacy score no longer dips while the personal-info confirmation card is open. A handover was priced before its verdict, so trusting the site visibly pushed the score back up. Provisional entries are now excluded until the card is answered.
- A second field typed while the confirmation card is open is now recorded and settled with the same answer instead of being dropped. Declining a card also no longer suppresses later cards for that site, matching the card's promise that TraceGuard keeps warning.
- The Settings dialog is taller, so a tab's last card is less likely to be cut off at the bottom.
- A long translated dashboard title now truncates with an ellipsis instead of being cut mid-word, and the password reveal button's accessible label goes through the translation layer.

## v1.25.3

**What was fixed**

- The dashboard now applies the saved theme as soon as settings load. It used to stay light when the saved theme was dark, because the theme provider kept its initial system value.

## v1.25.2

**What was fixed**

- Pausing TraceGuard now stops new personal-info events as well as site analysis. The personal-info path no longer keeps recording and scoring entries while the extension is off.
- The personal-info confirmation card now translates the field type and the other data the site already holds, instead of showing English labels inside Spanish, French, and German text. It also no longer repeats the field type in the sentence.
- A page can no longer reach the confirmation card's **Trust this site** button and click it. The card uses a closed shadow root, so only the user can vouch for the site.
- Encrypted notifications, detector logs, and the cross-site ledger are no longer rewritten as empty when the vault cannot decrypt them. The read-modify-write paths stop and record the failure instead of deleting stored records.
- A failed vault flush now reports back to the UI instead of leaving the unlock request unanswered.
- The network monitor caps the per-tab `Set-Cookie` list at 500 entries, so a page cannot grow it without bound.
- Chrome 114 or newer is required, matching the side-panel API the extension already uses.

## v1.25.1

**What was fixed**

- The three Overview stat cards now use the width actually available instead of the 1024px viewport breakpoint. They stay in three columns in a compressed window and wrap only when a card would be narrower than 220px.
- The weekly digest, personal-info card, policy-report, help, and local-AI strings now have Spanish, French, and German translations. The Release workflow fails before packaging if a user-facing string is missing from a shipped language.

## v1.25.0

**What's new**

- The personal-info confirmation card now shows what the ledger already knows before you choose: whether this site already has this data, how many other sites hold it, and what else this site already has. **Keep warning me** is the primary action; **Trust this site** is secondary.
- A weekly privacy digest appears as an in-app toast at most once a week. It summarizes recent personal-info entries, low-scoring sites, and tracker companies from data already on this device. Settings, **Notifications** has a **Weekly digest** switch.
- A missing privacy policy is explicitly a red flag in the WSS: it scores 25 at full weight, and the policy row shows its grade instead of a dash. Only a policy that exists but has no ToS;DR rating (50) is neutral and excluded from the calculation.

**What was fixed**

- The network monitor stores requests under opaque keys and keeps full URLs only in an in-memory lookup used for error updates. Request paths, queries, and fragments no longer appear in stored network data.
- The background page-analysis handler now lives in `src/background/handlers/page-analysis.ts`. A new message-route test covers the listener, telemetry queue, and handler together.
- CI runs on `dev` as well as `main`.

## v1.24.4

**What was fixed**

- Export now asks for your existing vault password and verifies it before writing a file, instead of accepting a separate export password. An encrypted backup uses that password, so the same password that unlocks TraceGuard restores it. A wrong password is rejected before anything is written, and a plaintext export still requires the password as confirmation.
- Settings, **About** lists recorded errors newest first, so the latest failure is at the top of the list instead of the bottom.

## v1.24.3

**What was fixed**

- The site cache is now split into 64 encrypted shards. A page analysis writes one shard instead of decrypting and re-encrypting the entire cache, so navigating no longer gets slower as the cache fills. Existing caches are migrated once on the next unlock.
- Settings, **About** has one **Diagnostics** toggle instead of a developer stream, a copy button, an export button, and two separate clear buttons. Turn it on to see recorded errors; turn it off to clear them. The list also clears when the browser restarts.
- Export is encrypted by default and asks for a password. A plaintext backup is now an explicit choice, and an export while the vault is locked is refused instead of producing a backup that silently leaves the encrypted history out.
- Policy discovery no longer follows a page's policy link to a different registrable site or to a private, loopback, or link-local host. ToS;DR document links are still allowed, and private hosts are filtered there too.
- Updated `dompurify` and `zod` to patched releases so the production dependency audit passes, and fixed the three lint errors in the response reader, the policy sentence splitter, and the policy report callback.

## v1.24.2

**What was fixed**

- Settings, **Domain Lists** shows the trash can on each allowed and flagged site again, instead of a **Delete** text button on every row. The icon keeps an accessible label and a tooltip naming the domain, so the row still says which site it removes.
- The three stat cards on **Overview** now sit on the same grid as the score and trend charts above them. They used to switch column count at their own widths and space themselves 16px apart while the charts used 24px, so at most window sizes three cards were squeezed into two columns and the third sat alone on a row of its own.

## v1.24.1

**What was fixed**

- Automatic local policy reports now check that the selected, policy-capable Ollama model is actually loaded before reading a policy page. A stopped Ollama server, an unloaded model, or the summaries-only `qwen3.5:0.8b` will not open a policy tab.
- Local policy reports now fetch and parse static policy pages without opening tabs first. A rendered tab is used only as a fallback when the fetched HTML does not contain readable policy text.

## v1.24.0

**What's new**

- Optional local summaries use the Ollama model you run on this device. Current-site summaries send the domain, score, tracker and cookie counts, and ToS;DR grade when present. Overview summaries send aggregate site/visit counts and up to five domains with their visits and scores.
- Summary input is limited to stored facts, never page text, sensitive field types, typed values, tracker URLs, or the personal-data ledger. Output is discarded if it adds an unsupported number, domain, or named entity. Summaries are not saved.
- The feature is off by default. Turn it on in Settings, set the installed `qwen3.5:0.8b` model, and allow the installed browser extension's origin in Ollama's `OLLAMA_ORIGINS`. No new permission prompt is needed because the extension already has broad site-analysis host access.
- This uses Ollama rather than a browser-specific built-in model, so the implementation can be tested across Chromium-based browsers. The next provider checkpoint is the bundled WebGPU model, after this Ollama checkpoint works.
- A local policy report now follows the shape ToS;DR's Docbot uses, on device: the model picks from a closed list of cases and points at the numbered sentence that supports each one, the extension resolves the sentence, and the score and letter grade are computed from the selected cases. Quotes are exact by construction and the grade is reproducible. The case list is this project's own wording, and `CREDITS.md` records the debt to Docbot and ToS;DR.
- A local policy report no longer requires opening the policy page or pressing a button. The policy section finds the site's policy (ToS;DR's document links, then a link on the page, then common paths such as `/privacy-policy`), first reads static HTML without opening a tab, and uses a marked inactive tab only as a fallback for pages that need browser rendering. The selected model runs on the policy text, and capture tabs never record their domain as a visit.
- The report is kept on this device for seven days, keyed by site, so revisiting a site shows the same points without reading the policy or running the model again. Turning the setting off deletes the stored reports.
- The Dashboard's Privacy Policy section now shows the same local report, with the grade, the points and the model that produced it, instead of `N/A` and zero points. The activity log's **Policy** column reads the same report when ToS;DR has not rated the site, so a row and the panel it opens no longer disagree, and a report that finishes while the dashboard is open fills the column without a reload.
- The report renders in the same rows as a ToS;DR rating, with one line noting that it was generated on this device and has no ToS;DR rating. The model now answers a fixed checklist of cases instead of choosing which ones to report, because a free selection returned one or two points on the same long policy on one run and ten on the next.
- Settings now checks this device's graphics hardware when the local model picker opens, and names the model it can actually run, with the `ollama pull` command to copy. Browsers do not report graphics memory, so the card name is read from WebGL and matched against a table of common GPUs; when the card is unknown, the suggestion stays conservative instead of guessing high. Detect a recommended model already installed and it offers to select it.
- The Settings and Help text now name the models a policy report needs, instead of leaving users on the summary default. `qwen3.5:0.8b` stays the summaries-only default for underpowered laptops. Machines with a discrete GPU or Apple Silicon get three options that all handle summaries, overviews, and policy reports: `qwen3.5:9b` (6.6 GB) is functional from 10 GB of memory, `gemma4:12b` (8.0 GB) is better from 12 GB, and `gemma4:26b` (18.7 GB) is outstanding from 24 GB. All four are Apache 2.0.

**What was fixed**

- Every progress message now moves instead of showing a static `Loading...` or `…`, and the policy report puts a spinner where its grade will appear. Each place shows one indicator, not two: a line of text inside a row or button gets animated dots only, and a page, panel or card that is still loading gets the animated circle only. The dots reflect the real request: they stop when it succeeds or fails, and a failed policy analysis marks the Privacy Policy row so the failure is visible without opening the section.
- The On-device summary no longer stops with "the summary facts are missing or too large to send safely" on the Overview when a busy site has a long domain. The Overview facts are now built within the same 300-character value limit the request checks, so whole findings are kept and the request reaches Ollama instead of being rejected before it is sent. A refusal for missing or oversized facts is now recorded in the diagnostics log instead of failing silently.
- A summary rejected by the evidence check used to be retried with no explanation, so the model repeated the same mistake and the second attempt was discarded too. The retry now names the failure (too long, an unsupported number or domain, or an unsupported claim), and the length bound matches the model's own output budget. The check also accepts `bbc.co.uk` for a fact recorded as `www.bbc.co.uk`, no longer reads an unrelated good score as praise for entering data, and no longer treats the correct disclaimer "not submitted" as a submission claim.
- The summary evidence check no longer discards a valid audit when it says that no form entries were recorded on any site, refers to a site by the numbered label inside its domain, or begins a formatted line with a heading word. The retry now names the exact values the model invented, and the reply budget leaves room to close the JSON object, so a long first answer no longer comes back as invalid JSON.
- Policy reports now ask Ollama for a 16,384-token context. The 30,000 characters of policy text are roughly 8,000 tokens, so the previous 8,000 setting silently cut the end of long policies before the model scored them.
- An HTTP 403 from Ollama now names the real cause and the fix: add `chrome-extension://*` to `OLLAMA_ORIGINS` and restart Ollama. The settings model list, the local policy report, and the Help page say the same, and the refusal is recorded in diagnostics, instead of suggesting the Ollama server is down.

## v1.23.1

**What was fixed**

- The allow control on **Your Footprint** is a proper button in both states: outlined while a site is untrusted, filled while it is allowed, and red under the pointer on an allowed site, so the click that takes it back is visible before you make it. It uses the theme's own colours, so it stays readable in the light and dark theme.
- The **Add** buttons under Settings, **Allowed and flagged** now use the outlined style of the **Export** button on Overview, instead of a solid block that was white on the dark theme and black on the light one.
- Settings no longer runs off a short window. The panel is capped to the height of the window instead of a fixed 600 pixels, so its title and buttons stay on screen. On a phone the six tabs become a row of icons and the content gets the full width, instead of being squeezed into the small strip left beside a 240 pixel column.
- The time-range control on the Overview and Rankings charts no longer lands on top of the card title in a narrow window. It sits beside the title when there is room, and drops below it when there is not.
- A long value in a stat card now wraps inside the card. A site name was the usual one to spill past the card's edge and add a sideways scrollbar to the page. The **Top Offenders** rows also give the site name less width on a phone, so the bar and the counts keep their room.
- In the side panel, the headings on the site detail rows (**Security Headers**, **Fingerprinting**, **Network Requests**) wrap instead of spilling outside the card when the panel is narrow.

## v1.23.0

**What's new**

- **Your Footprint** now lets you allow a site from the row that names it, instead of only while a confirmation card appears mid-form. Each row shows whether the site is allowed, one click allows it, and a second click takes it back. It writes the same allow list you edit under **Allowed and flagged**.
- Allowing a site exempts its handovers from the penalty, so the row says so in one line. It never deletes the record and it never blocks anything: the site keeps what it has, and the page still lists it as a holder.

## v1.22.10

**What was fixed**

- The privacy policy now matches the code: it states that the ToS;DR ratings-catalog refresh is on by default for new installs and sends nothing about the sites you visit, while the per-site lookup stays off by default. It previously said both requests were off.
- Settings, the quick search, and the store listing no longer claim TraceGuard blocks or protects anything. "Allow/Block" is now "Allowed and flagged", "Blocked Sites" is "Flagged sites", and the copy about future tracker blocking is removed, because TraceGuard has no blocking permission. A new test fails the build if that wording returns.
- The sidebar no longer greets you with "Welcome back" or "Ready to browse safely?". It shows how many sites were analyzed, a plain fact instead of an invitation to return.

## v1.22.9

**What was fixed**

- The dashboard, popup, and side panel now set the page's language tag to the language you picked, so a screen reader uses the right voice instead of always reading English. It follows every language change.
- Chart dates and times use your selected language instead of always the US format, so "Jul 4" reads as the local month name in Spanish, French, and German.
- The **Privacy Score** ring and the score history chart are now labelled for screen readers, so the score is no longer readable only by looking at the drawing.
- The dashboard no longer flashes a blank frame before its first paint.
- List rows use stable keys instead of their position, so a row can no longer briefly show another row's data after a reorder.

## v1.22.8

**What was fixed**

- Background-worker failures now reach the diagnostics log instead of a browser console nobody has open. Errors in tab tracking, migrations, auto-lock, the threat feed, the ToS;DR catalog, and the four UI entry points are recorded through the same path as the rest of the extension, so they appear in the **Copy diagnostics** bundle. Deprecation warnings are the only console output left in shipped code.
- The bundled HTML sanitizer (DOMPurify) is updated past the known DOM XSS advisories, and build-only tooling moved to `devDependencies` so the CI security audit gates on dependencies that actually ship. `npm audit --omit=dev --audit-level=high` reports no vulnerabilities.
- Added tests that load the background service worker and mount the popup and side panel, raising coverage of those entry points (popup 0 to 78 percent, side panel 0 to 59 percent) and lifting the overall floor.

## v1.22.7

**What was fixed**

- The **Privacy Score** ring on Overview now matches the shadcn radial chart it is built from. The coloured bar was 12 pixels thick and completely covered the ring behind it; shadcn draws an 8 pixel bar sitting inside that ring, and the bar is now the same 8 pixels.

## v1.22.6

**What was fixed**

- The popup scrolls as one region again. The fixed-height list inside the Privacy Policy accordion swallowed the mouse wheel, so the points past the fold could not be reached; the popup now renders them inline and the panel around them scrolls.
- The popup is pinned to the height Chrome allows for it, so the header and the action buttons stay on screen instead of the content pushing the footer out of view.

## v1.22.5

**What was fixed**

- The Reset button in the unsaved changes bar no longer wiped every setting back to factory defaults. It is now Discard changes, which reverts the form to your last saved settings. Restoring factory defaults is a separate Reset to Defaults action in the Data tab, with its own confirmation, and it keeps your activity logs and site lists.

## v1.22.4

**What's new**

- Safety Threshold is now a dropdown of named bands instead of a 0 to 100 slider, and it moved to the Notifications tab next to the alerts it controls. The choices are Critical only (below 20), Poor or worse (below 40), Fair or worse (below 60), and Good or worse (below 80).
- The default threshold is now 60 instead of 50, so sites rated Fair or worse trigger an alert. A value that is not one of the presets is kept and shown as a custom option.
- Data Retention is now a dropdown of preset windows (7, 14, 30, 60, and 90 days) instead of a slider.

## v1.22.3

**What was fixed**

- The Website Safety score now shows an X in a circle for an unsafe site (Poor and Critical) instead of a warning triangle. Fair sites keep the triangle, and Good and above keep the check, so the icon matches the score's color bands.

## v1.22.2

**What was fixed**

- An F grade for security headers now shows in red instead of gray, matching the other failing grade instead of looking neutral.
- The Reputation and Security Headers rows no longer reuse the TraceGuard logo icon. Reputation now uses a verified-badge icon and Security Headers a server icon, so each row is recognizable at a glance.

## v1.22.1

**What was fixed**

- Restored visibility and clickability of the settings modal close button by ensuring it renders above the banner overlay with z-50 stacking.
- Removed unnecessary trailing bottom margin from the Storage Used card when progress indicator is absent.

## v1.22.0

**What's new**

- New installs now refresh the privacy-ratings catalog every 7 days by default, so policy ratings stay current. The refresh downloads the same public ToS;DR catalog for everyone and sends nothing about the sites you visit.
- Existing installs keep the ratings refresh off until you choose a schedule in Settings, and Live Rating Lookup stays off by default because it sends the domain of the site you visit.

## v1.21.6

**What was fixed**

- The unsaved changes banner in settings now extends edge-to-edge across the top of the content area instead of being inset by padding.

## v1.21.5

**What was fixed**

- Safety badges in the activity log and in site search showed the raw lowercase level (for example "excellent") instead of the translated label. They now use the same label as the rest of the interface.
- Two tracker categories ("Anti-fraud" and "Functional") and the "security code" personal-data field type had no translation.
- The translation test now also covers the values the interface looks up dynamically, such as safety labels, tracker categories, and field types, since those cannot be found by scanning literal calls.

## v1.21.4

**What was fixed**

- The remaining user-facing strings that were fixed in English are now translated: the PII warning card and notification explanations, the "Live Rating Lookup is off" notice, and three accessibility labels (closing a toast, the sidebar toggle, and the chart range selector). The PII explanations are looked up dynamically, so the translation test now reads them from their source as well.

## v1.21.3

**What was fixed**

- The sidebar's labels ("Sidebar", "Toggle Sidebar", and the mobile sidebar description) are now translated like the rest of the interface, instead of being fixed in English.

## v1.21.2

**What was fixed**

- Strings that had no Spanish, French, or German translation no longer fall back to English. The gaps were in the import and backup dialogs, the vault lock screen, the two new privacy controls, and the Privacy Policy rating date.
- A test now fails when a user-facing string is not translated into every shipped language, so a new string cannot ship untranslated. It also fails if a string is built dynamically, since those cannot be checked.

## v1.21.1

**What was fixed**

- The two new privacy controls now use the same short title-case labels as the rest of Settings: **Live Rating Lookup** and **Ratings Refresh**. Their descriptions state the privacy cost in the same one-line style as the other settings.

## v1.21.0

**What's new**

- The **Privacy Policy** section now shows when its rating data was captured, for example "Ratings data from Aug 12, 2026". With the background refresh and the per-site lookup both off by default, this makes it clear how current a grade is instead of presenting an old one as current.
- The date reflects when the extension took its copy of the rating, not when ToS;DR last edited the service, so a rating that has been stable for a long time is not mislabelled as out of date.

## v1.20.0

**What's new**

- The privacy settings are now two independent choices, each named for what it does and what it costs:
  - **Live Rating Lookup** fetches a rating from tosdr.org for a site that is missing from our data or whose rating is old, and its description states that it sends the site's domain to tosdr.org.
  - **Ratings Refresh** fetches ToS;DR's public ratings catalog on a schedule you pick, and its description states that it does not reveal the sites you visit.
- Keeping ratings fresh in the background no longer requires the per-site lookup. A privacy-conscious user can keep ratings current without sending a domain on every visit.
- Phishing protection now updates on its own and is not affected by either ratings setting.

**What was fixed**

- The background ratings refresh is off by default and no longer inherits the old **Database Refresh** interval. Existing installs that had an interval start with it off, so nothing fetches from tosdr.org until you choose to.
- A visited site's rating is re-checked against its own seven-day staleness window, separate from the background schedule.

## v1.19.0

**What's new**

- **Live rating updates** now also refresh ratings in the background. With it on, the extension pulls the ratings that changed in ToS;DR since the bundled data shipped, so a site you visit shows a current rating even between releases. The first check runs right after install, and later ones follow the **Database Refresh** schedule. This reveals nothing about the sites you visit: it fetches the same fixed catalog for everyone, unlike a live lookup.
- Privacy ratings are re-checked based on the **rating's own age**, not the age of the whole bundle. Once the bundled data is a week old, only sites whose ToS;DR record is actually older than your refresh interval are re-checked, instead of every site.
- The **Database Refresh** setting now says what it does: it refreshes the threat feed on that schedule and re-checks privacy ratings once they are that old. When **Live rating updates** is off, a note under it says privacy ratings will not update.

**What was fixed**

- The dead single-file privacy-ratings fallback that shipped alongside the sharded dataset is gone, removing about 1.6 MB of unused data from the package.

## v1.17.0

**What's new**

- Services ToS;DR has catalogued but not graded are now bundled too. A service can have a list of points on file while its rating is N/A, such as Anthropic (Claude); those were skipped entirely before and read as no information. They now resolve with a grade of N/A and the points ToS;DR does have.
- The dataset build reports its progress: each catalog page, and a running count of fetched, reused, and skipped services with an estimated time left.

**What was fixed**

- A catalogued service with no grade is no longer treated as dangerous. It scores neutral, the same as a privacy policy link found but not rated, instead of falling through to the lowest local score.

## v1.16.0

**What's new**

- The bundled privacy-policy ratings now cover the whole ToS;DR catalog instead of its first 500 services. Sites such as Instructure (Canvas) and Anthropic were outside that cut and showed no policy rating; the build now pages through the full catalog, so any service ToS;DR has rated resolves.
- Rebuilding the catalog only refetches services whose ToS;DR record has changed. Services that have not moved are reused, so only the first build is slow.
- The ratings ship as a small always-resident index plus detail shards, so the dataset is no longer held in memory all at once and cannot balloon the extension's memory as it grows.

## v1.15.2

**What was fixed**

- Live rating updates work again. ToS;DR returns a site's grade as a plain letter on its list and detail endpoints, but as an object on its search endpoint. The lookup passed that object to the grade converter, which threw, and the error was swallowed. Every live lookup came back as "not found" even for a site ToS;DR had rated, so sites like Instructure showed no policy rating.

## v1.15.1

**What was fixed**

- The site details panel no longer runs words together. The **Personal Data Fields** row read "This page asks for yourpassword" and the **Reputation** rows read "This site has aclean reputation" and "flagged assuspicious or unsafe", because the sentence and the bolded label were rendered without a space between them.
- The **Fingerprinting** section no longer claims more than it knows. Where it said "your device identity is safe here", it now says only that no fingerprinting scripts were detected, which is what the scan actually checks.
- The **Fingerprinting** risk value is now shown in the selected language ("High risk") instead of the raw "high" it stored, matching the label already used on each row below it.
- The score in the panel header is labelled **Safety score**, with a note that higher scores are safer, so the number reads as a 0 to 100 safety score rather than an unexplained figure.

## v1.15.0

**What's new**

- Domain names across the dashboard are now links to the site details panel. In **Overview**, on the **Rankings & Stats** Top Offenders leaderboard, and on **Your Footprint**, clicking the domain itself opens the same breakdown of trackers, cookies, inputs, connections, and policy that Overview previously hid behind its ⋯ menu. On **Your Footprint**, the sites listed under a tracker company open the same panel, so a site's full record is reachable from the company that was seen on it. The row still does what it did before: in Overview it expands the visit history, and on Your Footprint it expands the other kinds of data the site holds.

## v1.14.4

**What was fixed**

- The trust summary at the top of **Your Footprint** is gone. It read "{{percent}}% of the data you entered went to sites we could vouch for" above a page whose job is to list what you handed over and where it went, and a reassurance there did not belong.

## v1.14.3

**What's new**

- Your **Privacy Score** is now a status score, not a running tally. It is read from what you have handed over and keeps charging for it: a password or a card entered on a risky site stays expensive for a long time, while an old handover slowly fades. It is recalculated from the same handovers shown on **Your Footprint**, so the two can no longer disagree. Your number will change when you update, because it is derived from the record rather than from a total built up visit by visit.
- Safer browsing still pays off, just not as points for a visit: a handover on a high-scoring site costs much less than the same handover on a poor one, and expected use (a login, a one-time code, or a checkout on a site we can vouch for) costs nothing.
- System notifications are now rationed. You get at most one warning per site per browser session, and a critical alert about the same site will not repeat within half an hour, so navigating back and forth across a few poor sites no longer produces an alert for each one. A session shows at most five system notifications whatever their severity. Nothing is lost: every alert still appears in the in-app notification list, which is the record rather than an interruption, and a skipped system notification is logged with the rule that skipped it.
- The score chart on **Overview** is now titled **Privacy Score History**, so it reads as the record of how your number changed rather than a second copy of the dial beside it.

**What was fixed**

- The score no longer moves when you visit a site. Safe-site recovery and the safe-streak bonus are removed. Both rewarded the sites you happened to land on rather than a choice you made, which is circumstance and was easy to farm by refreshing. Time is now the only thing that raises the score, through the decay of older handovers.
- The **Safe Streak** card is gone from the side panel, having already been removed from Overview. It counted consecutive visits to sites that scored well, which is mostly circumstance rather than a choice.
- **Overview** shows your Privacy Score from your first day instead of **No data yet**. The score is derived from what you have handed over, and browsing on its own writes nothing to the score history, so a fresh account had nothing to chart until the first handover or the next day's automatic snapshot. Creating your account now records the starting point, so the dial reads 100 and the chart has a line from the start.
- The caption under the **Privacy Score** dial no longer says the score comes from the sites you visited. It does not: the score is derived from the personal data you have entered and how risky each site was when you entered it.
- **Help** now describes the same score the rest of the app does. It said the score falls when you visit risky sites and updates as you browse, and it now names what the number is made of: the personal data you have entered, how risky each site was, and the slow recovery as older entries age.
- The **Read your browsing history** permission note no longer credits the Privacy Score. That permission follows the active tab, so the badge, the side panel and the dashboard show the site you are on.
- A site whose analysis has aged out of the cache could show a score that disagreed with the popup and the side panel, because the dashboard's fallback weights omitted the fingerprinting detector. The fallback now reads every weight from the same table the score itself uses.

## v1.12.0

**What's new**

- **Your Footprint** is browsable now. Tap a tracker company to see the sites it was seen on, which is a list you can paste into a blocker and actually act on, and tap a site to see the other kinds of data it holds. A site with your email usually has more than that, and the only way to see it before was to read every card.
- The **Privacy Score** ring says what moved it. Where it only said "Showing current privacy score", it now names the most recent handover that cost points ("Last drop: 8 pts from password on example.com"), and its description states the basis of the number: the sites you visited and the data you entered.

## v1.11.0

**What was fixed**

- The **Cross-site Network Requests** card is gone from Overview. It measured how much third-party code the pages you happened to open pull in, which is not your choice, and it sat beside cards that do report something you can act on.
- The **Sensitive Data Targeted** card is gone from Rankings & Stats. It listed the kinds of data you entered, which **Your Footprint** already shows with the sites behind each one. The same data in two shapes made both harder to read.
- The percentage trends are gone from the remaining Overview cards. A percentage implied a decision you could make about the number, and whether a page loads trackers is mostly the page's choice rather than yours.
- **Rankings & Stats** no longer describes itself as gamified. A ranking invites comparison; the page reports what happened.
- The safety bands under **Avg. Site Safety** describe the state ("Mostly risky sites") instead of coaching ("keep it up!"). The average across the sites you visited is not a grade you earned.
- Your Footprint's second section is titled **Tracker companies on your sites** rather than "Who has seen you", which read as an alarm about something you cannot act on directly.

## v1.10.6

**What was fixed**

- The record of which sites hold a given piece of your data is now bounded at 500 sites per data type, with the oldest dropped first. It was the only collection with no limit at all, growing with every new site for as long as the extension stayed installed. The cap is far above what normal use reaches, and it is applied both when an entry is written and when buffered entries are merged after the vault is unlocked.

## v1.10.5

**What was fixed**

- Tracker categories can no longer arrive as raw database strings. The category a tracker is filed under now comes from a fixed list, so a category this build does not recognise reads as Unknown rather than leaking an internal name into the site details. Trackers that fingerprint your device, consent managers and bulk email collectors also get their own accurate categories instead of an unmapped one.
- A tracker's organisation now prefers Disconnect's curated company name, which names the parent company, over Tracker Radar's owner, which sometimes holds a product name instead. The same tracker could previously be filed under two different organisations depending on which database answered first. This applies to pages analysed from now on.

## v1.10.4

**What was fixed**

- Nothing in the dashboard credits TraceGuard with blocking any more. Cookies, trackers and requests that never loaded were labelled **Blocked**, which read as protection this extension provided. It provides none: it holds no blocking permission, and the status only means Chrome reported the request as blocked by the client, so your browser or a different extension is what stopped it. They are now labelled **Stopped by browser**, and the summary on the network section names the actor outright. Sites you visited before this change still show their counts correctly.

## v1.10.3

**What was fixed**

- A handover is now written to **Your Footprint** at the moment it happens, instead of when the follow-up question is answered. When TraceGuard asked "Is this website safe?", the record of what you had already entered waited up to two minutes for your answer, held only in the worker's memory, so if Chrome shut the worker down while the card was on screen the entry vanished and the site never appeared. The card still decides whether that entry costs you score; it no longer decides whether the entry exists.
- A card left unanswered because the worker was replaced is now settled on the next start, with the penalty an unanswered card always carried, rather than sitting unresolved. If you do answer a card after the worker has been replaced, your answer is now applied instead of being discarded.

## v1.10.2

**What was fixed**

- A detected handover could be dropped without a trace. When you typed into a sensitive field (a login, a card, an address), the page sent the detection to the extension's background worker and never checked whether it arrived. If the worker happened to be restarting at that moment, the event vanished, and a lost event looks exactly like one that never happened: the site is simply missing from **Your Footprint**. A failed send is now written to the diagnostics log. What gets stored is unchanged; the difference is that a loss is visible instead of silent.

## v1.10.1

**What was fixed**

- **Add Manual Log is removed.** It let anyone hand-write a site visit, a safety score, a tracker count, a policy grade and more, with no analysis behind it, and it was available to every user rather than only in developer mode. Every figure in the dashboard is derived from that record, so the form could fabricate the very numbers the page exists to report.
- The **PII Risk Events** card is replaced by **Sites Holding Your Data**. The old card counted risk events, which is a scoreboard you cannot act on. The new card shows how many sites hold something you entered, names the kinds of data underneath, and opens Your Footprint when clicked.
- The Overview and Rankings pages no longer read the `blocked` flag from network summaries when counting cross-site requests. That flag means the browser or another extension blocked the request, not TraceGuard.

## v1.10.0

**What's new**

- The Overview heading now states the basis of the numbers below it: a line showing how many sites the analysis covers. It is there so a low count reads as "few sites analyzed" rather than "low risk". The same denominator already appears in Your Footprint.

**What was fixed**

- The **Safe Browsing Streak** card is removed. It counted consecutive visits to sites that scored well, which is mostly circumstance rather than a choice, and a single link could reset it to zero. Rewarding visit outcomes teaches people to avoid risk signals instead of risk. A streak will return built on actions you take, once those actions exist.
- The **Sites Analyzed** card is removed. As a standalone figure it measured the extension's own work rather than your habits, and it grew forever without telling you anything. The count is still recorded and is still shown where it does work, as the denominator in "on 18 of 30 sites".

## v1.9.2

**What was fixed**

- Logging in no longer shows up in **Your Footprint** as a physical-address handover. A field labelled with an "email address" (GitHub's login is labelled "Username or email address", and many forms label the field "Email address") was classified as a street address, because the address detector matched the word "address" inside that phrase. Such fields are now recorded as email, and other non-physical uses of the word ("IP address", "wallet address") are no longer read as addresses either.

## v1.9.1

**What was fixed**

- The Rankings & Stats card titled "Total Threats Blocked" now reads **Total Threats Detected**. The number counts detector results that flagged a risk, not anything blocked. TraceGuard has no blocking permission and cannot block a request, so the old wording credited it with protection it never provided.
- Removed an unused `leaderboardConfig` block from the rankings page. It held a second "Threats Blocked" label that was never rendered and no longer described what the code counts.

## v1.9.0

**What's new**

- The extension icon now shows the **Website Safety Score (WSS)** as a live badge on the toolbar icon. The badge updates every time you navigate to a new page and reflects the score for that specific tab, so switching tabs shows the correct score for each one. The badge is color-coded using the same palette as the rest of the extension: green for safe (60-100), yellow for fair (40-59), orange for poor (20-39), and red for critical (0-19). The badge is blank while a page is loading or on browser internal pages.

## v1.8.0


**What's new**

- A new **Your Footprint** page in the dashboard. It turns the data TraceGuard already stores on your device into two lists about you rather than about the websites you visit:
  - **What you have handed over** lists each kind of personal data you have entered (email, password, card, and so on), which sites received it, and when it was last seen. Sites you visited only once, have not visited in a long time, or that scored poorly at the moment you entered your data are marked as ones you may have forgotten.
  - **Who has seen you** lists the tracker companies whose code loaded on the sites you visited, ranked by how many of your sites each one covered, so a company on dozens of them stands out from one on a single page.
- The page is read-only: it reports what was recorded and gives you nothing to click yet. It never sees the values you type, only the type of field.
- No new permissions are requested, nothing leaves your device, and the page is translated into Spanish, French, and German like the rest of the interface.

## v1.7.10

**What was fixed**

- The Rankings & Stats chart colours from 1.7.9 are reverted. The Web Safety Score Distribution, the Risk Breakdown severity badges and bars, the Sensitive Data rows, and the Threat Categories donut look and behave the same as they did in 1.7.8.

## v1.7.8

**What was fixed**

- The Privacy Score colour and score ring changes from 1.7.7 are reverted. The dashboard ring, the side panel bar, and the score number look and behave the same as they did in 1.7.6.

## v1.7.6

**What was fixed**

- The Overview page header now has a subtitle describing what the page shows (your privacy score, activity trends, and the sites you have visited), matching the Rankings & Stats page. It is translated in Spanish, French, and German like the rest of the interface.

## v1.7.5

**What was fixed**

- The Overview page has a top-level heading, so screen readers and the document outline see the same structure as the Rankings, Activity, and Settings pages.
- Locking the extension, clearing activity logs, and resetting your score now use the app's own confirmation dialog instead of the browser's plain confirmation box. The dialog follows your light or dark theme, is translated, and can be dismissed with the keyboard.
- Animations are turned off when your operating system is set to reduce motion. Slide, pulse, and chart animation no longer play in that mode.
- Page analysis no longer rescans every label in the document once per input field. On form-heavy pages this removes a large amount of duplicate work from each analysis.
- The Overview page reads the detector weights from the same source as the score itself, so its fallback can no longer disagree with the popup and the side panel.
- The "no data yet" hint on the score chart now meets the contrast requirement instead of rendering below it.

## v1.7.4

**What was fixed**

- Importing a backup now checks the file before writing anything. A malformed file can no longer leave half-restored settings, a non-list allow list, or an app state the rest of the extension cannot read.
- Backups larger than 50 MB are rejected with a clear message instead of being read into memory. The extension requests unlimited local storage, so a crafted file had no upper bound before.

## v1.7.3

**What was fixed**

- The vault key is no longer exposed to web pages. The extension used to open `chrome.storage.session` to untrusted contexts, and that area holds the key that decrypts your stored data, so a script running on any site could have read it. Developer mode events from the content script now travel through the background worker, which is the only context allowed to write there.
- Unreadable encrypted data is no longer replaced with an empty value. A failed decrypt used to be treated the same as "nothing stored", so one read error could overwrite your site cache, score history, personal-information journal, or notifications with only the newest entry. Those writes are now skipped and the failure is recorded.
- If the extension cannot read your vault settings, it now stays on the locked screen with an explanation instead of showing the account-creation screen. The old behavior let you create a new vault over an existing one and strand every encrypted entry.
- Settings and personal-information messages from the content script are validated before the worker acts on them. A malformed message used to throw inside the listener or store an unreadable value.

## v1.7.2

**What was fixed**

- The release workflow no longer substitutes the pushed tag name into a shell command. A tag containing shell syntax could have run arbitrary commands in the job that holds the Chrome Web Store signing credentials.
- Every dependency advisory is resolved (browserslist, js-yaml, postcss-selector-parser, and vitest with its bundled mocker), so `npm audit --audit-level=high` passes and the CI security gate is green again.
- Test coverage is now measured across the whole codebase, including the background worker, the content script, and the user interface. It previously counted only `src/lib` and the detectors, so the headline number described the least risky part of the extension.

## v1.7.1

**What was fixed**

- Turning on Developer mode now reaches the background worker straight away. It used to read the setting only when it started, so the most useful lines (page scores, reputation checks, personal-information decisions) could be missing from the log until Chrome happened to restart the worker.
- The popup, side panel, and dashboard each read the Developer mode setting for themselves. The popup never did, so anything it recorded at verbose level was thrown away, and it never contributed to the shared log.
- The copied diagnostics bundle now says when the log filled up and older events were dropped, and how many. A timeline that starts abruptly used to look like nothing happened, when in fact the beginning had been discarded.

## v1.7.0

**What's new**

- Developer mode records the full arithmetic behind your privacy score. Every UPS event (visit penalty, PII entry penalty, focus penalty, safe-site recovery, and safe-streak bonus or break) is now written as structured numbers instead of an ASCII tree in a console that disappears.
- The policy pipeline explains itself. Each rating lookup reports whether it came from the dynamic cache, the bundled seed, or a live fetch, whether a cached rating was stale, whether the seed overrode a cached miss, and whether the cloud lookup was disabled.
- Enrichment reports its hit rate. Cookies are counted by whether the Open Cookie Database identified them or the name-length heuristic guessed, and tracker candidates are counted by whether a database recognized them or they were dropped.
- Every personal-information decision is recorded: the gate evaluation (site score, reputation, allow list, reason), whether the confirmation card was shown, duplicate skips, and the penalty arithmetic with the resulting score.

## v1.6.0

**What's new**

- Developer mode now records why every score came out the way it did. Each detector reports its raw observation, its score, and how long it took. Each page reports the weights and the per-detector contributions behind its final safety score, so the arithmetic can be checked from the log alone. Each database load reports its entry count, and each reputation check reports which layer decided the result and how many domains the blocklist holds.
- Page-level detection now reaches the diagnostics bundle. The content script follows developer mode, so tracker counts, cookie counts, sensitive field types, fingerprinting techniques, and the ToS;DR source and grade are recorded. They were previously dropped, because the setting only applied to the background worker and the extension pages.

**What was fixed**

- Missing data is no longer silent. An unreadable or empty bundled database, a blocklist that failed to load, and a score that fell back to a neutral 50 all used to reach a developer console and nothing else. They are now recorded as failures, and a blocklist that never loaded shows up as `blacklistSize: 0` on every reputation check, which is the signal that reputation protection is effectively off.

## v1.5.1

**What was fixed**

- Browser layout warnings such as `ResizeObserver loop completed with undelivered notifications.` are no longer recorded as errors. They are not failures, and on the dashboard they were filling the error log and the Errors section of the copied diagnostics bundle. They still appear in the developer mode timeline, so nothing is hidden.
- Uncaught errors and unhandled promise rejections now name the context that raised them (background, content, popup, side panel, or dashboard). Every one of them used to be reported as "ui", which made a content script crash look like a dashboard crash.

**What's new**

- Developer mode records a scoring summary for every analyzed page: the final safety score plus the score from each detector. This replaces the completion line that the 1.4.3 console cleanup removed, so a score can now be traced back to the detectors that produced it.

## v1.5.0

**What's new**

- Developer mode (Settings, About): a verbose on-device diagnostics log. Turn it on while troubleshooting, then click "Copy diagnostics" to copy a ready-to-paste bundle containing your extension version, browser, every recorded error, and the full event timeline. It is off by default, stays on your device, and is cleared when you close the browser.
- The extension now catches errors that no code path handled. Uncaught errors and unhandled promise rejections are recorded in the background worker, the content script, the popup, the side panel, and the dashboard, so failures surface in the diagnostics bundle instead of disappearing.

**What was fixed**

- Failures that used to vanish silently now leave a trace: detector errors, storage quota exhaustion, page-analysis delivery failures, and first-run check failures are all recorded.
- A thrown error inside the cookie detector no longer looks identical to a clean page in the diagnostics log.
- React crash screens now record the component stack alongside the error.
- Removed the last stray `console.log` from the policy detector.

## v1.4.3

**What's new**

- First click of the extension icon on a fresh install now opens the dashboard's vault-creation page (in both popup and side-panel mode) instead of squeezing account setup into the popup.
- The dashboard sidebar automatically collapses to icons when the window gets too small and expands again when it returns to a normal size.
- Personal-data penalties on risky sites are now gated behind the "Is this website safe?" confirmation card — confirming vouchsafes the site and waives the penalty for that visit.
- The dashboard now recovers automatically after an extension update instead of showing a crash screen when a stale page chunk can no longer be loaded.

**What was fixed**

- Score graph: the 7-day and 30-day tabs now plot each day's closing score (the real trajectory) instead of an average, with a larger history so those tabs show actual data; the donut's up/down delta now matches the chart, and a proper loading state replaced the "No data yet" flash.
- Fixed false-positive personal-data detection: German "ein" fields no longer count as SSNs, and "unit" quantity fields no longer count as addresses.
- Fixed score corruption when a user's score is 0 — penalties and recoveries no longer compute from a baseline of 100.
- Cookie and tracker detection no longer flags lookalikes via substring matches (e.g. `refresh` containing Facebook's `fr` cookie, `notfacebook.com` containing "facebook"), and generic CDNs (CloudFront, S3, etc.) are no longer counted as trackers.
- Overview site logs now show sensitive fields that appeared after the initial page analysis.
- The README badge now links to the live Chrome Web Store listing.

## v1.4.2

**What's new**

- Restored the README screenshots in a tracked `screenshots/` folder after untracking the `docs/` directory.
- Releases now ship with curated "What's new / What was fixed" notes (changelog-driven).

**What was fixed**

- Full ToS;DR privacy-policy catalog (412 graded domains, up from 66) with point-by-point details and document links.
- "Enhanced Policy Analysis" renamed to **Live rating updates**.
- Vault auto-lock now actually re-locks the UI after the timeout.
- PII penalties resolve the correct site's reputation instead of the active tab.
- Locked-vault buffer moved to session storage, matching the privacy policy.
- Same-party tracker/cookie matching no longer treats lookalike domains (e.g. `notexample.com`) as first-party.
- Tracking score computed from the bundled tracker databases.
- Eliminated lost-update races on counter increments.
- Progressive backoff on failed master-password attempts.
- Import/restore for exported backups.

## v1.4.1

**What's new**

- Production-readiness audit remediation (security, correctness, and privacy-policy alignment).
- Bundled ToS;DR catalog and cloud-toggle rename (superseded by v1.4.2 notes).

**What was fixed**

- See the v1.4.2 "What was fixed" list above.
