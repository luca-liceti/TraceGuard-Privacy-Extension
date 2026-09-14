# 0010. Behaviour change is the goal, and friction is the budget

**Status:** Accepted
**Date:** 2026-09-13

## Context

TraceGuard exists to change what the user does, not only to describe it. Until now every feature has
been judged on whether it is accurate, which is necessary but not sufficient. A correct score that
nobody acts on has no effect, and a dashboard opened once informs once.

The tempting reading of "make it frictionless" is to remove interruption. That reading defeats
itself. The leverage of a privacy tool is the moment of interruption, because that is the only point
at which new information can change a decision. A version of TraceGuard that never costs the user
anything is one that never stops them.

## Decision

Every user-facing feature must be able to answer three questions:

1. **Which behaviour is it trying to change?** Name the behaviour, not the metric. "Hand your card to
   fewer sites" is testable. "More engaged users" is not.
2. **When does the user decide?** If the answer is "when they open the dashboard", leverage is near
   zero.
3. **What does it cost, and is that proportional to the consequence?** Attention is the budget. A
   newsletter signup does not deserve what a card number deserves.

Friction is spent only where it changes a decision, and nowhere else.

## Corollaries

- **The default must be safe.** Doing nothing must not be a mistake, and no behaviour change may
  depend on configuration or setup.
- **Every claim must be true.** An overstated warning teaches users to dismiss the tool, which kills
  the real warning later. This is why recording a request as blocked only when the browser reports it
  was blocked is a behavioural requirement and not merely a matter of wording.
- **Reward actions the user takes, not outcomes they stumble into.** Rewarding a "safe site visit"
  teaches avoidance of risk signals instead of risk, and the user controls the input, so it is
  farmable.
- **Information that appears only after the fact informs; it does not change behaviour.** A feature
  should say which of the two it is designed to be.

## Consequences

- **The PII confirmation card is the most valuable surface in the product**, because it appears while
  the user is typing. Changes that strengthen it, or that make it more informed, rank above changes
  that add reporting.
- **The footprint ledger is only behaviour-changing if it feeds that card.** On its own it is memory
  the user has to go and read. That is a legitimate function, but it is informing, not changing, and
  the roadmap should describe it as such.
- **A punishment-only score works against this goal.** It teaches avoidance of risk signals rather
  than care, so the reward redesign is part of the goal rather than a nice-to-have.
- **Features that cannot name a behaviour do not go on the roadmap**, however tidy they look on a
  dashboard.
