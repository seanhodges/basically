## Context

The comparison page is `docs/reference/compare.md`, rendering
`docs/.vitepress/theme/components/DialectCompare.vue` against the diff logic in
`docs/.vitepress/theme/dialectCompare.ts` (see
`docs/contributing/architecture.md` for how the docs layer and its data relate
to `src/`). The component already renders seven `<ul class="cmp-list">`
sections built from that diff output: false friends, keyword renames,
keywords to replace, changed-behaviour keywords, newly-available keywords, and
two escape-code lists. Each rendered one `<li>` per entry with no limit. For
dissimilar pairs the "must replace" and "newly available" keyword lists in
particular run past 70 rows.

This is a template/rendering-only change: `diffKeywords`, `diffEscapes`, and
the hand-authored porting data are untouched, so the numbers the page reports
(the counts in the headings and summary line) are exactly as before — only how
many of those rows render as `<li>` elements before the reader acts changes.

## Goals / Non-Goals

**Goals:**

- Cap each of the seven difference lists to a fixed number of visible rows by
  default, with an obvious, low-friction way to see the rest.
- Keep every count the reader already relies on (section headings, the
  top summary line) reporting the true total, never the visible subset.
- Reset to the capped view whenever the compared pair changes, so switching
  pairs never leaves a stale "expanded" list from a previous, unrelated
  comparison.

**Non-Goals:**

- Changing `diffKeywords`/`diffEscapes` or any porting data — the comparison
  computes exactly what it did before.
- A "load more" / paged UI, a configurable page size, or persisting expansion
  state anywhere (URL, storage) — a single reveal-the-rest control per list is
  enough for a page meant to be read in a few minutes.
- Any change to the `Dialect`/`MachineEmulator` seam or `src/`: this is a
  docs-only, presentation-layer change with no runtime app impact.

## Decisions

**One small reactive helper (`useTruncatedList`) in the component, not a
change to the diff logic.** The cap is purely about how many of an already-
computed array's rows get a `<li>`; `dialectCompare.ts` is documented as
"Node-testable and SSG-safe" pure logic with no Vue dependency, and mixing a
UI-only concern like "how many rows to show right now" into it would break
that separation for no benefit. The helper lives directly in
`DialectCompare.vue`'s `<script setup>` and is instantiated once per list
(seven call sites), each pointed at the relevant computed array
(`keywordDiff.value?.mustReplace`, `escapeDiff.value?.newlyAvailable`, etc.).

**Reset keyed on the chosen pair, not on the list's own identity.** Each
helper instance watches a shared `pairKey = computed(() => \`${from}:${to}\`)`
and collapses when it changes. This is deliberately keyed on the pair (the
thing the reader actually changes) rather than on incidental recomputation, so
expansion state is predictable: it only ever resets because the reader picked
a new comparison, matching the mental model established elsewhere on the page
(`showUnchanged`, the URL sync) where the pair is the unit of "current view."

**Headings and the summary line read the full array, the `<li v-for>` reads
the capped view.** Two different bindings against the same underlying
computed (`keywordDiff.value.mustReplace.length` for the heading,
`mustReplaceList.visible` for the `v-for`) rather than threading a "total"
field through a new intermediate object — the full array is already there and
reading its `.length` directly keeps the heading obviously correct by
inspection.

*Alternative considered — a single generic wrapper component
(`<TruncatedList>`) instead of a composable used at 7 call sites.* Rejected:
each list's `<li>` markup differs (icons, tags, "instead" notes, two-column
escape layout), so a wrapper would need slots for nearly everything anyway,
trading a ~20-line composable for a component with little shared markup to
justify it.

## Risks / Trade-offs

- **A reader assumes the heading count is also what's on screen** → the
  heading and every truncated list sit within a couple of lines of each other,
  and the "Show N more…" row states the exact remaining count, so the gap
  between "visible" and "total" is never silent.
- **Expansion resetting on pair change surprises a reader who expected it to
  stick** → accepted; the page's own summary line and URL already change with
  the pair, so a reader already expects a new pair to be a fresh view, not a
  continuation.
- **No automated coverage of the truncation/expand/collapse behavior** → this
  repo has no Vue component-testing dependency and no precedent for testing
  `.vue` files directly (only the framework-free `dialectCompare.ts` is
  unit-tested); verified instead with a manual Playwright-driven pass against
  a live `docs:dev` server (truncated count, expand reveals the rest and hides
  the control, heading stays at the true total, switching pairs re-collapses).
  Recorded here rather than silently skipped.

## Migration Plan

Additive and self-contained: a rendering change to one component, no data
migration, no stored state. Rollback is reverting the component change.
