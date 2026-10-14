# 0016. Summarization ships a bundled small model

**Status:** Accepted
**Date:** 2026-10-14

## Context

Record [0015](0015-ai-ships-no-model.md) shipped no model, on the reasoning that Chrome's built-in
model covers the summary and that in every other case the user's own server can. That reasoning
breaks on the coverage requirement:

- Chrome's built-in model exists only in Chrome and ChromeOS. Brave, Vivaldi and Opera ship no
  model, so on those browsers the summary had no provider at all, and the browsing-log brief, the
  part of the feature that earns its place, simply never appeared.
- A user-run server is capable but not zero-setup. Summarizing a handful of counts should not
  require installing Ollama first.
- The two AI jobs are not equally hard. Summarizing short structured facts (counts, detector names,
  scores) is easy. Rating legal text feeds a score, needs a much larger model, and stays on the
  user's own server, which is what 0015 already decided.

So the summary needs a provider that ships with the extension and runs on the device. The question
was only which model, and the answer is set by license and by fit rather than by brand.

## Decision

The extension bundles one small model for **context summarization only**, and ships nothing larger.

- **Model:** `Qwen/Qwen3.5-0.8B`, about 0.8B parameters, Apache 2.0. The WebLLM build is
  `Qwen3.5-0.8B-q4f16_1-MLC`: roughly 437 MB to download, about 1.6 GB of GPU memory at run time.
- **Runtime:** WebLLM over WebGPU, in an offscreen document. WebGPU exists in every Chromium
  browser from about version 113, so this is the provider that works in Brave, Vivaldi and Opera,
  not just Chrome.
- **Provider order for the summary:**
  1. Chrome's built-in model when `await availability()` succeeds, because it costs no download.
  2. The bundled model, which is the default everywhere else.
  3. The user's own local model, for a user who would rather use the one they already run.
- **The policy report is unchanged from 0015:** the user's local model only, never the bundled one.
  That job needs a model far larger than 0.8B (the reason 0008 gives), and record
  [0006](0006-asymmetric-policy-ratings.md) governs what a generated rating may do.
- **The query box is unchanged from 0008.**

Why this model rather than Gemma. Gemma 3 and Gemma 3n use Google's own terms of use, which
require passing those terms on to the user and enforcing the use restrictions, which is a poor fit
for weights the extension downloads by itself. Gemma 4 is Apache 2.0 but needs about 3.4 GB of GPU
memory at q4f16, too heavy for rewriting a few numbers. Qwen3.5-0.8B is Apache 2.0, is already in
WebLLM's prebuilt catalog so no custom compilation is needed, and fits a modest GPU. The smaller
Apache 2.0 fallbacks, if quality or memory turns out to be the binding constraint, are
`SmolLM2-360M-Instruct` (also in WebLLM, about 376 MB of GPU memory) and `granite-4.0-350m` (a
Transformers.js build, about 350 MB).

## Consequences

- **No feature depends on the model.** If the download is declined or fails, if the device has no
  WebGPU, or if memory is short, the deterministic view is unchanged and the summary shows a plain
  unavailable state.
- **This reverses the "ships no model" half of 0015.** The other half stands and is the more
  important half: every AI feature is off by default, and none is ever a dependency of the core.
- **The package grows by a runtime, not by weights.** A WASM runtime ships, so `script-src` needs
  `wasm-unsafe-eval`. The weights are data, fetched on first use from the pinned WebLLM artifact
  repository, so the store package itself stays small.
- **New machinery to build:** a download with progress and a cancel, storage accounting and a
  delete, an offscreen document because the service worker is killed mid-generation, and a model
  plus prompt version recorded with each summary so a result can be invalidated.
- **New disclosure:** the weight download is an external request, so `PRIVACY.md`,
  `traceguard-extension/PRIVACY_AND_PERMISSIONS.md` and the store data-usage questionnaire all
  change. The summary itself is computed on device and sends nothing.
- **GPU memory is the real gate, not download size.** About 1.6 GB of VRAM is a higher bar than the
  437 MB download suggests, so the measurement on real machines stays a prerequisite.
- **Output validation is mandatory, and it is not only for the policy report.** A 0.8B model can
  invent a tracker or a count while restating the record, so every number and named fact in the
  output must be present in the input, or the summary is discarded.
