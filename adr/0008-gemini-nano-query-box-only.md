# 0008. Gemini Nano is scoped to the query box

**Status:** Accepted
**Date:** 2026-09-13

## Context

Chrome ships an on-device model, Gemini Nano, available to extensions without an origin trial and
without sending data to Google. It costs nothing to ship and needs no user setup. It is also a small
model, gated on desktop hardware (roughly 22 GB free disk, plus a multi-gigabyte download and either
a capable GPU or 16 GB of RAM), and too weak for rubric-based legal classification.

## Decision

Two jobs, two different requirements:

- **Queries.** The model routes a natural-language question to the deterministic data, and the
  answer comes from storage. Local server preferred, Gemini Nano accepted as the zero-setup
  fallback.
- **Policy rating.** A user-run local server only (Ollama, LM Studio, llama.cpp), reached over an
  optional localhost host permission that is requested only when the user enables it.

Every local-AI feature is off by default, and none is ever a dependency of the core product.

## Consequences

- A query answer cannot be fabricated, because the model does not supply the facts.
- Policy rating gets a model strong enough for the task, and record 0006 keeps a wrong rating from
  creating false safety.
- Many users will not meet the hardware requirement, so the deterministic view must stand alone and
  nothing may assume a model is present.
- Two providers mean two sets of failure modes to support. The local server is the better first bet
  because it needs no hardware gate and no download.
