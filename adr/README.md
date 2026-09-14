# Architecture Decision Records

Each file here records one decision that shapes TraceGuard, with the reasoning that produced it.
They exist because the reasoning otherwise lives only in conversation and gets lost.

## How to use these

- Read the decision and its consequences before changing the area it covers.
- Never edit an accepted record to match new behaviour. Write a new record and mark the old one
  `Superseded by NNNN`.
- One decision per record. If a record needs an "and", it is two records.

Format follows Michael Nygard's original ADR shape: status, context, decision, consequences.

## Index

| Record | Decision |
|---|---|
| [0001](0001-local-first.md) | Local-first, with no backend and no telemetry |
| [0002](0002-no-cookies-permission.md) | No `cookies` permission; cookie metadata comes from `Set-Cookie` headers |
| [0003](0003-pii-field-types-only.md) | PII detection records field types only, on the first keystroke |
| [0004](0004-ledger-as-pure-aggregation.md) | The footprint ledger is a pure aggregation, not a stored artifact |
| [0005](0005-ledger-own-page-and-gate.md) | The ledger gets its own page and a usefulness gate |
| [0006](0006-asymmetric-policy-ratings.md) | A generated policy rating may lower a score, never raise it |
| [0007](0007-no-p2p.md) | No P2P or decentralized contribution |
| [0008](0008-gemini-nano-query-box-only.md) | Gemini Nano is scoped to the query box |
| [0009](0009-dev-branch-workflow.md) | Develop on `dev`, merge `main` weekly |
