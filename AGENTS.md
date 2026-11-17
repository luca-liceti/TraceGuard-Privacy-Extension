# AGENTS.md

The project's conventions live in [`.agents/AGENTS.md`](.agents/AGENTS.md). Read that file
before making changes: it covers diagnostics, commits, versioning, releasing, UI, and writing
style.

This file is deliberately a pointer. Rules are not duplicated here, because a second copy
drifts out of date and any agent that loads only this file silently misses the real ones.
Edit `.agents/AGENTS.md` instead.

## UI learnings

- For copy actions attached to visible commands, use an icon-only button with an accessible label and title; do not repeat “Copy command” as visible button text.
- Settings with long descriptions and wide controls should stack at desktop widths too; the default side-by-side `SettingItem` layout can squeeze the description into a narrow column.

- In settings, keep icons on tab navigation, but do not use icons beside individual settings or controls. The one exception is removing a row from a list, such as a domain under Domain Lists: that is an icon-only trash button with an `aria-label` and a `title` naming the row, because a **Delete** text button on every row crowds the domain out.
- Keep score and rank presentation context-specific: search/log rows may show a rank-only badge, while site detail headers retain their existing separate score and rank layout. Do not replace those layouts with `SafetyRating` without an explicit request.
- `SearchCommand` filters only rendered `CommandItem`s, so render every cached site for search; exclude suggested domains from the full list to avoid duplicate cmdk values.
