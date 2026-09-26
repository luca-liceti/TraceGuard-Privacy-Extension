# TraceGuard Roadmap

**Updated:** September 25, 2026
**Branch:** `dev` (identical to `main` between releases)

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

# Track A: Footprint assistant

The goal is to expose the user to their own behaviour, reward good behaviour, and guide them away
from bad behaviour. That is mostly not an AI problem. It is a memory, timing, and reward-design
problem, so the language layer comes last.

## A1. Footprint ledger, read-only

**Status: built, awaiting the gate.** Released as v1.8.0; the browsing drill-down and the
attributable score ring followed in v1.12.0.

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

## A2. Make it actionable

Only after the gate passes.

- **Forget.** `forgetExposure(fieldType, domain)` in `src/lib/storage.ts`. Deletes the local record
  that a domain holds a field type, from `crossSiteExposure` and the matching `piiDetections`. It
  must **also purge the matching `bufferedExposure` entry**, or `flushBufferedTelemetry` merges it
  back on the next unlock and the delete silently reverts. Label it honestly: it erases the user's
  record, not the site's copy.
- **Trust.** `trustSite(domain)` using the existing whitelist, surfaced where the record lives
  instead of only in Settings.
- **Memory in the PII gate.** The gate currently asks "is this site safe?" with no history. Feed the
  ledger into it so it can say "you have shared this with 12 sites, 3 of them one-off". This is
  where behaviour actually changes, because it appears while the user is typing.

**Two things to be honest about in the design.** Forget and gate memory work against each other:
forgetting erases exactly the evidence the warning depends on, and the UI should say so. And trust
is the only action here that reduces safety, so it needs to be visible, listable, and one-click
reversible.

### Gate A2 to A3

Proceed only if the user hits a question the fixed lists **cannot** answer, and hits it repeatedly,
roughly weekly. "Which sites have my card?" when no card filter exists is a real gap. "A summary
card would look nice" is not.

## A3. Optional local AI

Off by default, opt-in permission, never a dependency of the core. Scope and providers are set by
record [0008](adr/0008-gemini-nano-query-box-only.md).

- **Query box.** Sits on Overview beside the score ring and the activity chart. Note that grid is
  currently two columns, so this needs a third column or its own row. The model routes the question
  to the deterministic data and the answer comes from storage, so it cannot invent facts. Local
  server preferred, Chrome's built-in Gemini Nano as the zero-setup fallback.
- **Policy rating** is Track B, not here.

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
when the feature is enabled. The scrape happens in the content script while the user is on the
policy page, so no new network permission and no CSP change is needed. Only the policy text is sent,
never the footprint ledger or logs.

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

- **UPS reward redesign.** The current model is punishment-only: up to 2 points lost per risky visit,
  at most 0.1 recovered per distinct safe domain. Gamification cannot work on a score that mostly
  falls. Needs its own design document, and it must reward actions the user takes rather than safe
  site visits, because rewarding visit outcomes is farmable and teaches users to avoid risk
  *signals* instead of risk.
- **Promote `/exposure` to the landing page**, once it has proven useful, with the current-site
  summary on top.
- **A streak over actions.** The Safe Browsing Streak card was removed in v1.10.0 because it counted
  consecutive visits to well-scoring sites, which is mostly circumstance rather than a choice, and a
  single link could reset it. A streak is worth building again once A2 ships forget, because "sites
  where you cleaned up your data" is an action the user takes, and record
  [0011](adr/0011-behaviour-test-boundary.md) requires the thing being rewarded to be the user's
  own decision.
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
