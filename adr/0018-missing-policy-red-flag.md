# 0018. A missing policy is a red flag; an unrated policy is neutral

**Status:** Accepted
**Date:** 2026-11-17

## Context

The policy detector returns 25 when a site has no privacy-policy link and 50 when a policy exists
but ToS;DR has no rating. Both used to sit outside the weighted score, so a site with no policy
could score higher than one whose policy was merely unrated. Absence is a finding, and treating
it as an unknown rewards omission.

## Decision

A missing policy scores 25 and stays in the WSS at its full 10 percent weight. Only score 50 is
neutral and excluded, with its weight redistributed. The policy row shows the grade for 25 and a
dash for 50, and the copy says that no policy counts against the score.

## Consequences

A site cannot improve its WSS by omitting a policy. A policy that exists but is unrated stays
neutral, because the lack of a rating is not evidence of a bad policy. The distinction is pinned
by `POLICY_MISSING_SCORE` and `POLICY_UNRATED_SCORE` in `src/lib/scoring.ts` and by the scoring
tests. Record [0006](0006-asymmetric-policy-ratings.md) still governs what a generated rating may
do.
