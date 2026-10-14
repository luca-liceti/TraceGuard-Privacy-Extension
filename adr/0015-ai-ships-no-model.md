# 0015. AI is opt-in and the extension ships no model

**Status:** Superseded by [0016](0016-bundled-summarization-model.md)
**Date:** 2026-10-14

## Context

Record [0008](0008-gemini-nano-query-box-only.md) scoped Chrome's Gemini Nano to the query box and
allowed a user-run local server only for policy rating. The requirement has since widened and
sharpened:

- The extension must ship without AI. Nothing in the package may be a model, no feature may depend
  on a model being present, and the deterministic analysis must stand alone.
- Summaries are wanted in two places: the current site's analysis in the popup and side panel, and a
  short brief of the user's own browsing log in an Overview section.
- Some users run their own model on their PC and want to use it instead of the browser's.
- Sites that ToS;DR does not cover still need a policy report, which is the Track B defect.

The context that decides the providers is coverage. Chrome's built-in model needs no setup and no
bundle, but it exists only in Chrome and ChromeOS. Edge ships its own model behind same-named APIs,
and Brave, Vivaldi and Opera ship neither. A user-run server is the only provider that works in
every Chromium browser, because it is just a fetch to localhost.

## Decision

The extension ships no model. Three jobs, and every AI feature is off by default and never a
dependency of the core.

1. **Context summarization.** One setting. It summarizes the current site's analysis in the popup
   and side panel, and writes a short brief of the user's browsing log into an Overview section.
   - Default provider: the browser's built-in lightweight model, Chrome's Gemini Nano, through
     `Summarizer` and `LanguageModel`.
   - Optional provider: the user's own model, reached over localhost, chosen in the same setting.
2. **Policy report.** A separate setting. It has the user's own local model rate a privacy policy
   that ToS;DR does not cover and write a report in ToS;DR's shape.
   - Provider: the user's local model only. Gemini Nano is not used here, for the reason record 0008
     gives, that it is too weak for rubric-based legal classification that feeds a score, and record
     [0006](0006-asymmetric-policy-ratings.md) governs what a generated rating may and may not do.
3. **Query box.** Carried forward from record 0008 unchanged: the model routes a question to the
   deterministic data and the answer comes from storage, so it cannot invent facts.

Provider selection is always `await availability()` inside `try`/`catch` at the moment of use, never
a check by API name, because Brave has shown the API present while the backend was broken.

Bundling our own runtime over WebGPU (WebLLM, Transformers.js, ONNX Runtime Web, or MediaPipe LLM
Inference with a Gemma model) is rejected. It would break the "ships without AI" requirement, and it
adds a bundled WASM runtime, `wasm-unsafe-eval` in the CSP, a weight-download feature and the Gemma
Terms of Use, for a gain the browser's own model already provides in Chrome.

## Consequences

- **No model ships.** No weights, so no Gemma license, no download UI, no package-size cost and no
  `wasm-unsafe-eval`. The model download belongs to Chrome, not to us.
- **Coverage follows the provider.** In Chrome both features can run. In Brave and the other
  Chromium browsers only the local model exists, so the summarization setting shows an honest
  unavailable state rather than a dead toggle or a silent failure.
- **Two providers mean two failure modes per feature.** The local server needs the optional host
  permission, `OLLAMA_ORIGINS` or LM Studio `--cors`, and a `connect-src` entry.
- **The deterministic view stands alone.** Losing the model changes nothing about scores, the ledger,
  or the PII gate.
- **A generated policy rating may not create false safety.** It may lower a score or stay neutral,
  never raise one, and never mark a site safe for the PII gate. It must record the model and prompt
  version so a result can be invalidated.
- **Classification.** Both summaries are Context: they restate true facts and make no claim on
  behaviour. The browsing brief must not become a Persuasion without naming the behaviour it exists
  to change, and it must not reward an outcome the user stumbled into.
- **Disclosure moves with the local provider.** Sending policy text or a site's analysis to the
  user's own machine needs a line in `PRIVACY.md`, a justification in
  `traceguard-extension/PRIVACY_AND_PERMISSIONS.md`, and an accurate "Remote code and services"
  answer in `docs/store-listing/data-usage-questionnaire.md`.
