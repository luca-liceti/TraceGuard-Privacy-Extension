# 0009. Develop on `dev`, merge `main` weekly

**Status:** Accepted
**Date:** 2026-09-13

## Context

The footprint work is exploratory, with an explicit stop condition. It should not be able to
destabilise a shippable `main`, and releases are cut from `main` by tagging. The counter-risk is
familiar: a long-lived branch drifts, conflicts accumulate, and work is tested against stale code
that is missing current fixes.

## Decision

`main` stays shippable and is not touched by in-progress work. `dev` is the integration branch.
Feature branches are cut from `dev` and merged back into `dev`. `main` is merged into `dev` weekly.

## Consequences

- `main` is always releasable, so a fix can ship without waiting for the experiment.
- Weekly merges keep conflict cost small and keep `dev` testing current code.
- Contributors need to know which branch to target: fixes go to `main`, work in progress goes to
  `dev`.
- Version numbers move on `dev` ahead of `main`. Because tagging happens on `main`, an unreleased
  version on `dev` is expected rather than an error.
