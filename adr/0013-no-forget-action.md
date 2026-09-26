# 0013. No forget action, and no score that moves when records are deleted

**Status:** Accepted
**Date:** 2026-09-25

## Context

A2 listed a forget action. `forgetExposure(fieldType, domain)` would delete the local record that a
domain holds a field type, from `crossSiteExposure` and the matching `piiDetections`, and it carried
two warnings: that it must also purge the matching `bufferedExposure` entry, or the merge on unlock
would silently restore the record, and that it must be labelled honestly as erasing the user's record
rather than the site's copy.

It was also carrying more weight than a tidy-up. It was the intended reward loop, the streak over
"sites where you cleaned up your data" that record [0012](0012-engagement-is-salience.md) left open,
and it was the only upward lever a derived score would have.

The premise behind all of that is false. **A site does not forget because the user deletes a note on
their own device.** The exposure is unchanged; only the local ledger is. So an action that removes a
record cannot be a privacy improvement, and a score that rises when a record is removed measures
bookkeeping rather than care: a user could read 100 while every one of those sites still holds their
data. It also works against the warning the product depends on, because forgetting erases exactly the
evidence the PII gate uses to say "you have already shared this".

## Decision

There is no delete action for exposure records. The ledger is read-only.

The score may never be movable by editing the record. Its only upward force is time, through decay,
because an old exposure is genuinely less actionable than a recent one.

If a "stop showing me this" need appears later, it is a **dismissal of a row**, not a deletion of a
record, and it must not touch the score.

## Consequences

- **A2 keeps two items, not three:** `trustSite`, and feeding the ledger into the PII gate. The third
  is dropped.
- **The reward loop is dropped rather than postponed.** There is no honest repeatable action to
  reward. Rewarding an absence (not handing data over) is farmable, since the user chooses where to
  browse; rewarding a visit outcome is excluded by record
  [0010](0010-behaviour-change-as-the-goal.md). Nothing is built until an honest action exists.
- **The score's honesty rests entirely on decay**, which is time passing rather than effort. The UI
  must say so instead of implying progress the user earned. Record
  [0011](0011-behaviour-test-boundary.md) already forbids the related temptation of softening a
  discouraging truth to protect motivation.
- **Counts beside the score describe state, not achievement.** They are worth showing because a
  count is clearer than a single compressed number, not because clearing one changes anything.
- **The buffer trap becomes latent.** `flushBufferedTelemetry` merging deleted records back is only a
  hazard if something deletes records, and nothing does.
- Record [0003](0003-pii-field-types-only.md) mentions the ledger offering forget as an alternative
  fix to a detection problem. That mention is removed by this decision; the record's decision about
  field types only is unchanged.
