# Credits and attribution

TraceGuard is licensed under AGPL-3.0. It is built on other people's work, data and ideas. This file
records what came from where, so attribution travels with the code.

## ToS;DR (Terms of Service; Didn't Read)

- Project: <https://tosdr.org> · source: <https://github.com/tosdr>
- **What we use:** the bundled ratings catalog, built by `traceguard-extension/scripts/build-tosdr.js`
  from ToS;DR's public JSON: a service's grade, the points behind it, and the links to the documents
  ToS;DR has on file. The optional Live Rating Lookup queries the same API for a domain the user
  visits.
- **Terms:** ToS;DR publishes its JSON under CC BY-SA 3.0, with an exception that allows distribution
  inside a larger program under AGPL-3.0. The derived files in
  `traceguard-extension/src/assets/tosdr-*` remain under those terms. ToS;DR has not reviewed or
  endorsed TraceGuard, and a report TraceGuard generates is not a ToS;DR rating.

## Docbot

- Evan Radkoff, *What did you agree to? Readable privacy policies with help from ML*, May 2025 —
  <https://www.soundsandwords.io/privacy-policies/>
- Docbot is the system described there, built with ToS;DR: one classifier per ToS;DR Case, evidence
  selected as a span of the document, a confidence per case, and human curators approving submissions
  before they count towards a grade.
- **What we took:** the shape of the local policy report, not its implementation. Our report uses a
  fixed list of cases, has the model select the single numbered sentence that supports each case
  instead of writing a quote, keeps a confidence per case, and derives the score and grade from the
  selected cases rather than asking a model for a number. See
  [ADR 0017](adr/0017-background-policy-capture.md) and
  `traceguard-extension/src/lib/ai/cases.ts`.
- **What we did not take:** Docbot's trained adapters, its training data, its thresholds, and its
  curation queue. TraceGuard has no training data and no per-case classifiers. Its case list is an
  independent set of statements written for this project, inspired by the idea of a Case taxonomy.
  Local reports are an approximation made on the user's own machine, and they are never presented as
  ToS;DR output.

If you maintain Docbot or ToS;DR and would like different wording or a different kind of credit,
please open an issue and we will change it.

## Local models

TraceGuard ships no model weights. It talks to models the user installs in
[Ollama](https://ollama.com) (MIT), over `http://localhost:11434`.

- **Qwen 3.5** (Alibaba) — Apache 2.0 — the summary default and the recommended starting point.
- **Gemma 4** (Google DeepMind) — Apache 2.0 — the recommended larger local models.
- **Granite 4.2** (IBM) — Apache 2.0 — documented summarization alternative.

Model behavior, output and any local logs are governed by those projects' own terms. TraceGuard
validates what it receives before showing it.

## Bundled data

Built at release time by scripts in `traceguard-extension/scripts/` from these published sources:

- **DuckDuckGo Tracker Radar** — tracker and domain classification.
- **EasyPrivacy** (EasyList project) — tracker domain list.
- **Disconnect** services list — tracker and service metadata.
- **OpenPhish** and **phishunt.io** — phishing domains.
- **ToS;DR** — policy ratings and points, described above.

Each source keeps its own terms. The build scripts fetch and transform the data; they do not relicense
it. See those projects before redistributing a build.

## Libraries

React, Radix UI, Tailwind CSS, Recharts, i18next, DOMPurify, zod, lucide-react, Vite and Vitest are
used under their respective open-source licenses. `traceguard-extension/package.json` is the
authoritative list of dependencies and versions.

## Reporting a credit problem

If something here is missing, wrong, or attributed to the wrong person, open an issue. We would rather
fix an attribution than ship a wrong one.
