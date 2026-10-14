# TraceGuard Roadmap

**Updated:** October 14, 2026
**Branch:** `dev`, the integration branch. Releases are cut from `main` by tagging, so `dev` runs
ahead of `main` between releases.

This file says what is being built next, in what order, and what would make us stop. It is not the
description of the system: that is [ARCHITECTURE.md](ARCHITECTURE.md), and the reasoning
behind settled decisions is in [adr/](adr/README.md).

Two independent tracks. They share only plumbing, and neither gates the other.

| Track | Subject | Gate |
|---|---|---|
| **A** | The footprint assistant | Does it tell the user something they did not know? |
| **B** | Policy rating for unrated sites | Does it agree with human ratings where truth is known? |

They are separate because they answer different questions. Track A is about behaviour: does knowing
your footprint change what you do. Track B is about correctness: ToS;DR does not cover most sites,
and unrated sites currently score higher than they should. A useful ledger says nothing about
whether a rating model is accurate, and an accurate model says nothing about whether anyone reads a
ledger.

---

# Prerequisites before any on-device AI

Both A3 and B1 stay blocked until the items below are done. They are shared plumbing and shared
disclosure rather than feature work, and none of them assumes a model is present.

- **The two providers are the browser's model and the user's own model, and the names get crossed.**
  Record [0015](adr/0015-ai-ships-no-model.md) decides this. Chrome's built-in model is **Gemini
  Nano**; the extension APIs are `Summarizer` and `LanguageModel`. "Gemma Nano" is not a product: it
  is **Gemma**, Google's separate open family (Gemma 3n, Gemma 4 E2B/E4B), which the extension does
  not ship. The paths are:
  - **Chrome's built-in model.** The extension makes no WebGPU call and ships no model: Chrome runs
    Gemini Nano on the GPU or CPU. It is available to extension pages and the service worker from
    Chrome 138, but not to ordinary web workers. It is gated on hardware, about 22 GB free disk and
    either more than 4 GB VRAM or 16 GB RAM with 4 cores, plus a one-time multi-gigabyte download, so
    many users fail the gate and nothing may assume a model exists.
  - **The user's own model over localhost.** Ollama, LM Studio or llama.cpp, reached with the
    optional host permission below. This is the only provider that exists in Brave and the other
    Chromium browsers.
  - **Bundling our own runtime over WebGPU is rejected.** WebLLM, Transformers.js, ONNX Runtime Web
    or MediaPipe with a Gemma model would break the "ships without AI" requirement, and it adds a
    bundled WASM runtime, `wasm-unsafe-eval` in the CSP, a weight-download feature and the Gemma
    Terms of Use, for a gain the browser's own model already gives in Chrome.
- **"Chromium-based" is not enough for the built-in path.** Chrome's built-in AI is not a
  Chromium-wide feature: the model is a separate Google component and the backend depends on
  Google-internal services. Brave disables the Optimization Guide keyed service, and where `LanguageModel`
  was exposed there it crashed. Edge ships same-named `LanguageModel` and `Summarizer` APIs but
  backed by a different model (Phi-4-mini), in preview, with different options. So built-in-only
  means Chrome on desktop and ChromeOS, not Brave, Vivaldi or Opera. Detection must be
  `await LanguageModel.availability()` (and the Summarizer equivalent) inside a `try`/`catch`, never a
  name check, because Brave showed the API while the backend was broken. Those browsers therefore show
  an honest unavailable state for the summary, and only the local provider works there.
- **The governing record is [0015](adr/0015-ai-ships-no-model.md).** It supersedes
  [0008](adr/0008-gemini-nano-query-box-only.md) and sets the two providers. Read it before touching
  any AI feature.
- **Manifest and CSP.** The local-server path needs `optional_host_permissions` for the exact
  loopback origins (`http://localhost:11434/*`, and `http://127.0.0.1:11434/*` only if the server is
  addressed that way), requested when the user enables the feature and never granted up front.
  `manifest.json` line 46 also pins `connect-src` to `'self'`, `api.tosdr.org` and
  `raw.githubusercontent.com`, so a fetch to a local model is blocked until that origin is added.
- **Server-side setup belongs to the user.** Ollama refuses extension origins unless `OLLAMA_ORIGINS`
  allows them, and LM Studio needs `--cors`. Chrome 142's Local Network Access permission needs a
  real test against the exact extension origin, because the docs do not settle whether it applies to
  extension-origin requests.
- **Disclosure moves with the local provider.** The built-in provider sends nothing and downloads
  nothing on our behalf. The local provider sends text to the user's own machine: policy text for the
  report, which `PRIVACY.md` today says it never reads, or the site's analysis and browsing log for a
  summary. Three files change with each provider that is added: `PRIVACY.md`,
  `traceguard-extension/PRIVACY_AND_PERMISSIONS.md`, and the "Remote code and services" answer in
  `docs/store-listing/data-usage-questionnaire.md`.
- **Classify each output against the behaviour rules.** Both summaries are Context: they restate
  true facts and make no claim on behaviour. The browsing brief must not become a Persuasion without
  naming the behaviour it exists to change. If a generated policy rating feeds the score, record
  [0006](adr/0006-asymmetric-policy-ratings.md) binds it: it may lower a score or stay neutral, and
  it may never raise one or mark a site safe for the PII gate.
- **Gate B is still unanswered.** Coverage, impact and calibration come before any policy rating, so
  no part of B1 ships even when the plumbing above is done.

---

# Track A: Footprint assistant

The goal is to expose the user to their own behaviour, reward good behaviour, and guide them away
from bad behaviour. That is mostly not an AI problem. It is a memory, timing, and reward-design
problem, so the language layer comes last.

## A1. Footprint ledger, read-only

**Status: built, kept by decision on October 14, 2026.** Released as v1.8.0; the browsing drill-down
and the attributable score ring followed in v1.12.0.

Two defects were fixed before the gate starts, because either would have failed it for the wrong
reason: a handover whose send to the worker was rejected vanished silently, indistinguishable from
having typed nothing (v1.10.2), and a handover was only written after the confirmation card was
answered, so a worker terminated during that wait lost it (v1.10.3). The record is now written
before the card, and the card decides only the penalty.

| Item | Path |
|---|---|
| Pure aggregation, no `chrome.*`, no React | `traceguard-extension/src/lib/exposure.ts` |
| Unit tests for the flag rules and counting | `traceguard-extension/src/lib/exposure.test.ts` |
| `useExposureReport()`, reads and memoizes | `traceguard-extension/src/lib/useStorage.ts` |
| Page, read-only | `traceguard-extension/src/components/traceguard/pages/exposure.tsx` |
| Route `/exposure`, sidebar entry, command palette | `src/dashboard/App.tsx`, `src/components/app-sidebar.tsx` |
| Translations | `src/lib/translations.ts` |
| Journal rules for the PII record, testable without booting the worker | `traceguard-extension/src/lib/pii-journal.ts` |

Two lists, both deterministic. See record [0004](adr/0004-ledger-as-pure-aggregation.md).

- **What you handed over.** Per field type: which domains hold it, first and last seen, and whether
  the entry is surprising. Surprising only fires for a reason the UI can name: visited once, not
  visited in about 180 days, entered while the site scored under 50, or gone from the site cache.
- **Tracker companies on your sites.** Tracker organisations aggregated across visited sites, ranked
  by how many of the user's sites each one covered, with company aliases merged. Titled "Who has seen
  you" before v1.11.0, when the heading was changed because it read as an alarm about something the
  user cannot act on directly.

The page is deliberately separate from Overview, and the reasons are in record
[0005](adr/0005-ledger-own-page-and-gate.md).

### Gate A1 to A2: the usefulness test

**Started:** September 25, 2026. **Decide by:** October 9, 2026.

**The capture path was verified before the clock started**, by signing in on sites that had not been
used during development. The handover appeared on Your Footprint with the right field type and site,
and the browsing drill-down resolved in both directions: a company listed the sites it was seen on,
and a site named the other data types it holds. That matters for reading the result, because a thin
ledger now means little browsing rather than a detector that never fired.

**The baseline on day one** was two handover sites and one tracker-bearing list of nine visited
sites. The "at least 3 forgotten holders" threshold needs real browsing volume to be meaningful: if
the two weeks pass with the ledger barely growing, that is an unanswered gate rather than a failed
one, and the honest move is to extend the clock rather than to judge it.

Use the ledger on real browsing for **two weeks**. All three must hold:

1. **Surprise.** It names at least **3** holders the user had genuinely forgotten, at least **1** of
   them a site visited only once.
2. **Return, unprompted.** The user opened the page on at least **6 of the 14 days** without being
   reminded.
3. **Nothing missing.** No holder the user knows about is absent from the list. A wrong list is
   worse than no list.

**Kill criterion.** If after two weeks the user cannot name a thing the page told them that they did
not already know, stop. Delete the page, keep the commit history, do not start A2.

The thresholds are agreed now so the decision is not made while invested. "At least one forgotten
holder" was the original wording and it was too loose: it would pass by noise.

Because the extension sends no telemetry, every threshold is self-reported. That is unavoidable for
a privacy product, and it is why the numbers are few and blunt.

**Outcome: kept, and A2 unblocked.** Decided on October 14, 2026, five days after the clock ran out.
The export of October 14, 2026 covers the window exactly (all 11 handovers were recorded between
September 30 and October 7), so the criteria can be scored from the record instead of remembered.
Running `buildExposureReport` over it, from the plaintext `crossSiteExposure`, `piiDetections`, and
`siteCache` that `exportAllData` in `src/lib/export.ts` writes while the vault is unlocked:

- **Criterion 1 fell short.** 5 sites hold the user's data, across 11 handovers. The ledger flags 1
site, `app.freewill.com`, on 2 flags (`email` and `password`), both for a single visit. The
threshold was 3 holders with at least 1 visited once, so the single-visit half passed and the count
did not. The site it named is a real finding: visited once, and holding an email and a password.
- **Criterion 2 was never observable.** Nothing counts opens of `/exposure` and no stored field
records them, so "6 of the 14 days" was memory only, and no verdict was reachable whatever the user
did.
- **Criterion 3 could not be judged as written.** Every one of the 5 holder domains is still in the
site cache and has a journal entry with dates, and neither cap was near its limit (5 domains held
against 500, 52 sites cached against 5000). As written it can never pass, because the ledger is
derived from records written while the extension runs, so a holder the user knew about from before
install is absent by construction.

**Why it is kept anyway.** The measurement was the point of the two weeks and it now exists, and the
page named a site that no other surface names. What failed was the test's observability, not the
page, and the kill criterion (does the page name something the user did not know) is answered by
that one site.

**The terms a future verdict uses.** The original three are replaced, so the next reading is
decidable:

1. A **holder** is a site, not a field type, so a site holding an email and a password counts once.
2. **Completeness** is scoped: no holder missing that the ledger could have recorded, with either
   cap named when it trims (`MAX_EXPOSURE_DOMAINS_PER_TYPE` in `src/lib/exposure.ts`, and the site
   cache eviction above 5000 domains in `src/background/index.ts`).
3. **Criterion 1 is re-measured** from a fresh export at the next release, with the same command, and
   the result written here. If a month of real use names nothing new, the kill criterion stands.

The return-visit requirement is dropped rather than instrumented. It measured the user's curiosity,
and counting a dashboard being opened is a metric with no action behind it.

The second list is the weaker one on this record. Tracker companies come from `enrichedDetails` on
41 of the 52 cached sites, and 63 of their 238 tracker items carry no organisation name, so the
ranking under-counts. The display also stops at `MAX_WATCHERS` (25) while the record holds 32
organisations, so 7 are never shown. Neither figure casts doubt on the first list, which is the one
the three criteria are about.

## A2. Make it actionable

Unblocked on October 14, 2026, when the ledger was kept.

- **Trust. Shipped in v1.23.0.** Each holder row on `/exposure` carries an allow control that writes
  the same `settings.whitelist` the confirmation card and the settings screen write, shows the state
  on the row, and takes it back on a second click. The row reads the list the way the engine does, so
  an entry covering a subdomain is what removal takes out.
- **Memory in the PII gate.** The gate currently asks "is this site safe?" with no history. Feed the
  ledger into it so it can say "you have shared this with 12 sites, 3 of them one-off". This is
  where behaviour actually changes, because it appears while the user is typing.

**There is deliberately no delete action.** Record [0013](adr/0013-no-forget-action.md) settles it: a
site does not forget because the user clears a note on their own device, so deleting a record would
change nothing about the exposure while raising the score, which makes the number improvable by
bookkeeping instead of behaviour.

**One thing to be honest about in the design.** Trust is the only action here that reduces safety,
so it needs to be visible, listable, and one-click reversible. The shipped control states its effect
in one line on the page rather than leaving it implicit, and it deletes nothing: an allowed site
stays on the list of holders.

### Gate A2 to A3

Proceed only if the user hits a question the fixed lists **cannot** answer, and hits it repeatedly,
roughly weekly. "Which sites have my card?" when no card filter exists is a real gap. "A summary
card would look nice" is not.

## A3. Optional local AI

Off by default, opt-in permission, never a dependency of the core. Providers are set by record
[0015](adr/0015-ai-ships-no-model.md). Blocked on the shared prerequisites above.

- **Query box.** Sits on Overview beside the score ring and the activity chart. Note that grid is
  currently two columns, so this needs a third column or its own row. The model routes the question
  to the deterministic data and the answer comes from storage, so it cannot invent facts.
- **Context summarization.** One setting, two providers. The browser's built-in lightweight model is
  the default, and the user's own local model is the option they can switch to. It summarizes the
  current site's analysis in the popup and side panel, and writes a short brief of the user's
  browsing log into an Overview section. Both read the deterministic record (`siteCache`, the
  detector results and the log), so no page text is scraped and the `PRIVACY.md` promise that it
  reads page structure and never page text still holds. Classification is Context: it restates true
  facts and makes no claim on behaviour.
- **Policy report** is Track B, not here.

---

# Track B: Policy rating for unrated sites

Fixes a defect that exists today: when ToS;DR has no rating, the policy detector is excluded and
its weight is redistributed, which inflates the WSS for unrated sites. Record
[0006](adr/0006-asymmetric-policy-ratings.md) governs what a generated rating may and may not
do.

## Gate B: measure before building

Nothing here starts until all three are answered from real data.

1. **Coverage.** What fraction of the sites the user actually visits have no ToS;DR rating? This is
   computable now from `siteCache` against the bundled ToS;DR data. If it is 10 percent this is a
   small feature. If it is 60 percent it is a real one.
2. **Impact.** For those sites, how much does the excluded policy weight inflate the WSS? The weight
   is known, so this is arithmetic.
3. **Calibration, and this decides it.** Run the candidate model against sites that **do** have
   ToS;DR grades and measure agreement. If it disagrees with human raters where the truth is known,
   it must not ship, whatever Track A does.

A cheaper option to test first: many sites reuse policy templates (Termly, Iubenda and similar), so
template clustering may cover the long tail deterministically, with no model at all.

## B1. Local policy rating

The user's own local model only, reached over an optional localhost host permission requested only
when the feature is enabled. The scrape happens in the content script while the user is on the policy
page, so the page never talks to the local server. The inference call itself is made from an
extension context (the service worker, or a dedicated offscreen document), which does need the
optional host permission and the matching `connect-src` entry named in the prerequisites. Only the
policy text is sent, never the footprint ledger or logs. Providers are set by record
[0015](adr/0015-ai-ships-no-model.md): the user's local model only, and it stays blocked on Gate B.

- Cache by a **normalised content hash** (strip dates, whitespace, navigation), not by domain, so
  one analysis covers every site sharing a policy. Re-analyse on change using a similarity
  threshold, not exact equality, or policies with dynamic dates cause re-analysis storms.
- Run inference off the critical path and show the analysis **age**. A bare grade implies it is
  current.
- Show the clauses the rating was based on, with a link to the source text.
- Record which model and prompt version produced each rating so results can be invalidated.
- **Asymmetric by design:** may lower a score or stay neutral, never raise one, and never mark a
  site safe for the PII gate.

**Estimate:** A3 about a week. B1 several weeks, between chunking long policies, hash and diff
logic, output validation, and two failure modes per provider.

---

# Later, annotated but not scheduled

- **UPS as a derived status score.** Shipped. The model is a function of the record: each
  handover costs its field sensitivity multiplied by how risky the site was, decayed by age, and
  visits contribute nothing, because which sites appear in someone's browsing is mostly not their
  choice. `scoreUps` in `src/lib/ups.ts` derives it; the visit penalty, safe-site recovery, and
  streak bonus are removed. There is no reward loop and none is planned, because no honest repeatable action exists to
  reward: record [0013](adr/0013-no-forget-action.md) rules out deleting records, and rewarding visit
  outcomes is farmable, which record [0010](adr/0010-behaviour-change-as-the-goal.md) already says.
  The behaviour lever is the PII gate, in A2.
- **Promote `/exposure` to the landing page**, once it has proven useful, with the current-site
  summary on top.
- **Sharing analyses**, if ever wanted: contribute to ToS;DR through its reviewed process, or export
  a file the user shares manually. Not P2P.

---

# Explicitly not doing

- **P2P or decentralized contribution.** Contradicts the local-first claim, leaks browsing interest
  through domain metadata, and is an attack path: a contributed fake good grade inflates a score,
  which can make the PII gate exempt a phishing site. Full reasoning in
  record [0007](adr/0007-no-p2p.md).
- **Gemini Nano for policy rating.** Too weak for rubric-based legal classification that feeds a
  score.
- **Cloud AI.** Sending the visited site to a provider is a category error for a footprint
  assistant.
- **A forget action.** A site does not forget because the user deletes a local note, so the delete
  would change nothing about the exposure while raising the score. That makes the number improvable
  by bookkeeping, and it erases the evidence the PII gate warning depends on. Full reasoning in
  record [0013](adr/0013-no-forget-action.md).
- **A streak, or any reward loop over local bookkeeping.** The Safe Browsing Streak card was removed
  in v1.10.0 because it counted consecutive visits to well-scoring sites, which is circumstance
  rather than a choice. Its replacement was to have been a streak over records the user had cleared,
  and record [0013](adr/0013-no-forget-action.md) removes that action. Nothing is built until an
  honest repeatable action exists to count.

---

# Recently closed

Defects that earlier drafts of this file listed as open. Kept only so a reader who remembers them as
open can see when they were fixed; drop the detail when it stops mattering.

- **The `blocked` field naming** (v1.10.4). Nothing in the dashboard credits TraceGuard with blocking
  any more. Chrome reporting `net::ERR_BLOCKED_BY_CLIENT` means the browser or another extension did
  it, so the field is `blockedByBrowser`, the label reads "Stopped by browser", and the network
  summary names the actor. Legacy cached values still render.
- **The tracker category cast** (v1.10.5). All 11 Disconnect categories are mapped, anything
  unrecognised becomes `unknown` instead of leaking a raw database string into the UI type, and the
  `as` cast is gone.
- **Organisation name precedence** (v1.10.5). Disconnect's curated `entityName` now wins over
  DuckDuckGo's inconsistent `owner`. Changes stored data, so it affects future analyses only.
- **Cap on `crossSiteExposure`** (v1.10.6). Bounded at 500 domains per data type, trimmed on both
  write paths and logged when it trims.

---

# Open caveats

- **Tracker companies on your sites** depends on `enrichedDetails` tracker `organization` being
  populated, so early numbers will be thin for sites analysed before that field existed.
- **`piiDetections` is capped at 100**, so long-run history for the ledger comes from
  `crossSiteExposure`.
- **The ledger is empty on install.** Nothing appears until the user types into a sensitive field
  somewhere, so the page needs an honest empty state rather than looking broken.
- **An entry means typing, not sending.** The detector fires on the first character typed into a
  sensitive field (`pii-detector.ts:122`), before the form is submitted, and the record is now
  written before the confirmation card is answered. Abandoned forms are therefore recorded as if the
  site had received the data, which is the safe direction to be wrong in, but it is not evidence
  that anything was sent.
