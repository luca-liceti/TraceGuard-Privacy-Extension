# 0011. The behaviour test governs persuasion, not entitlements

**Status:** Accepted
**Date:** 2026-09-13

## Context

Record [0010](0010-behaviour-change-as-the-goal.md) says every user-facing feature must name the
behaviour it tries to change. Applied literally, that is wrong for a class of elements the user is
owed regardless of whether they change anything, and it invites the tool to start shaping its user
rather than informing them.

Two failure modes fall out of the literal reading. First, transparency and control surfaces get
justified by behavioural effect, so the privacy policy, the export button, and the delete button
start being written to motivate. Second, elements whose honest content is discouraging get softened
or hidden, because discouragement looks like a failed metric.

## Decision

Every user-facing element is exactly one of four things, and it must be labelled as such when it is
added **or reviewed**:

| Classification | Requirement |
|---|---|
| **Persuasion** | Tries to change a decision. Must name the behaviour and appear where the decision is made. |
| **Context** | True information with no claim on the user's behaviour. Must not pretend to persuade. |
| **Entitlement** | Transparency, control, correctness, safety. Owed regardless of effect; never justified by behaviour change. |
| **Decoration** | None of the above. Cut it. |

The test applies to existing surfaces, not only to proposals. Most of what fails it is already
shipped.

## Guardrails

- **Never suppress a discouraging truth to protect motivation.** If the honest picture is "your
  score fell and nothing you can do today changes that", it is still shown.
- **Steering must be visible and reversible.** An assistant that quietly optimises behaviour is
  indistinguishable from a dark pattern aimed at a good end.
- **Rewarding continuation follows record [0010](0010-behaviour-change-as-the-goal.md):** reward
  actions the user takes, never accumulated outcomes, which are farmable and decay.

## Consequences

- **Entitlements stop needing a case.** Export, delete, the vault lock, permission transparency, and
  detector-failure notices are owed, and a review that asks them to change behaviour is the wrong
  review.
- **Existing surfaces become reviewable.** The safe-browsing streak and the PII event count are
  persuasion minus a mechanism, so they fail. The rebuilt threats card was both inaccurate and
  behaviourally inert.
- **The Footprint page splits.** The handover list is persuasion, because the user chooses where
  they log in. The watchers list is context, because the user does not choose who loads a tracker.
  The page should lead with the half that can actually steer.
- **Reviews get cheap.** One classification per element, then act on it: strengthen a persuasion,
  label a context, leave an entitlement alone, cut a decoration.
