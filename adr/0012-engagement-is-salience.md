# 0012. Engagement means salience, not return visits

**Status:** Accepted
**Date:** 2026-09-25

## Context

The extension should be engaging, but not so engaging that it becomes annoying. That sentence is not
yet a rule, because "engaging" means two different things.

The first is **return frequency**: the user comes back often. In consumer software this is the usual
meaning, and it is pursued with reminders, streaks, and repeated alerts. TraceGuard has no stake in
it. The extension is free, local, and sends no telemetry, so there is no advertising, no subscription
renewal, and no investor metric that a returning user serves. Pursuing return frequency would mean
importing an incentive this product does not share, and the techniques that produce it are the same
techniques that make software annoying.

The second is **salience**: the user notices the right thing at the moment they decide something.
Record [0010](0010-behaviour-change-as-the-goal.md) already says the leverage of a privacy tool is
the moment of interruption, because it is the only point at which new information can change a
decision. Record [0011](0011-behaviour-test-boundary.md) says which elements may try to change a
decision. Neither says how much attention may be spent, or when spending it stops being an
interruption and starts being noise.

The distraction is already shipping. The level setting (silent, balanced, aggressive) governed how
loud the extension was, but a system notification was raised for every navigation to a site below
the threshold, with no cooldown and no memory of a domain already warned about. A user crossing
three mediocre sites in one session received three system notifications.

## Decision

Engagement is salience, and attention is a budget. Return frequency is not a goal and may not be
used to justify a feature.

An interruption is legitimate only when all three hold:

1. **A decision is being made now.** Not has been made, not will be made.
2. **The information could change it.** If it arrives after the choice, it is informing.
3. **The cost fits the consequence.** A newsletter prompt does not deserve what a card number
   deserves.

Interruptions are rationed per subject and per session, and every one is dismissible in a single
action, with the level setting as the outer bound.

## Consequences

- **The system notification budget** lives in `lib/notification-budget.ts` and is pure so the policy
  is testable without a browser: one warning per domain per session, a critical alert per domain
  with a thirty minute cooldown, and at most five system notifications per session. The cooldown
  counts only previous criticals, so a recent warning can never swallow an escalation.
- **Rationing never loses history.** Every notification is still written to the in-app list, which
  is a record rather than an interruption and is deliberately not rationed. A skipped system
  notification is logged with the rule that skipped it.
- **The streak went from the side panel**, having already gone from Overview in v1.10.0. It rewarded
  consecutive visits to well-scoring sites, which is circumstance rather than a choice, and its only
  other function was to encourage a return. The underlying score mechanic stays until the UPS reward
  redesign, which is where it belongs.
- **A feature that only raises the chance of a return visit does not go on the roadmap**, however
  well it would perform by that measure.
- **A surface that cannot name the decision it lands on is informing, not engaging**, and belongs
  where the user already is rather than where they are being sent.
