# 0006. A generated policy rating may lower a score, never raise it

**Status:** Accepted
**Date:** 2026-09-13

## Context

ToS;DR covers roughly 4,000 services. When a site has no rating, the policy detector is excluded and
its weight is redistributed across the others, which inflates the WSS for unrated sites. A locally
generated rating could fill that gap. But a policy rating feeds the WSS, and the WSS feeds the PII
gate, where a site above the safe threshold is treated as expected use and is not penalized.

That chain means a confidently wrong "this policy is good" does not merely misinform. It can
suppress a warning at the moment the user is entering a card number.

## Decision

A generated rating may lower a score or leave it neutral. It may never raise one, and it may never
mark a site safe for the PII gate. The rating is shown together with the clauses it was based on and
a link to the source text, and it records which model and prompt version produced it.

## Consequences

- A wrong rating cannot create false safety, which removes the whole class of failure where a
  hallucinated good grade disarms the gate.
- Generated ratings can only warn, never reassure, so they cannot improve a site's standing.
- Where ToS;DR has a human rating, that rating wins.
- Calibration against sites that already have ToS;DR grades is the acceptance test, and disagreement
  there is grounds not to ship the feature at all.
