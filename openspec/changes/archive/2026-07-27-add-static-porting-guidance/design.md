## Context

The Compare dialects page is `docs/reference/compare.md`, feeding eight
per-dialect reference tables, eight escape tables and `portingFacts` into
`docs/.vitepress/theme/components/DialectCompare.vue`. The diff is pure logic in
`docs/.vitepress/theme/dialectCompare.ts` (`diffKeywords`, `diffEscapes`), whose
header states the constraint the docs layer obeys: *Node-testable and SSG-safe:
imports only the docs data types, never `src/`.* Docs data is hand-authored and
held true to `src/` by four crosscheck suites rather than by regeneration — see
`docs/contributing/architecture.md` for how the two layers relate.

Today's "Explain porting with AI" button is gated on `embedded` (true only
inside the IDE's docs-drawer iframe), builds a plain-text diff summary and posts
it to the app, which appends a fixed instruction and streams a reply into the AI
panel. That path never includes the user's program or lint errors — unlike the
sibling convert action — so its input is entirely checked-in documentation data.

Measurements taken over the eight pages, which drove the design:

- 341 unique keyword names, 805 rows, 2973 "must replace" instances across the
  56 ordered pairs; 195 of the 341 names (57%) appear on exactly one page.
- Keyword-set relatedness (Jaccard) has a **baseline of 27–33%** — simply how
  much vocabulary any two BASICs share. Only `zx81↔zxspectrum` (54%),
  `commodore↔trs80` (46%) and `zx80↔zx81` (41%) clear it.
- **342 of the 2973 "must replace" entries (11%) are operator rows**, reaching
  11 of 14 on `zx80 → zx81`.

## Goals / Non-Goals

**Goals:**

- Guidance present for every reader — no API key, no iframe, offline.
- The comparison stops reporting operators and spelling variants as missing
  commands, and starts reporting same-name-different-meaning commands.
- Authoring cost grows with the number of dialects, not its square.
- Any one pair view reads in about five minutes.
- Staleness caught by `npm test`, in the style of the existing crosschecks.

**Non-Goals:**

- Automatic program translation (the convert action keeps that job).
- Exhaustive per-command notes.
- Normalising the reference tables' operator rows.
- Any change to the `Dialect` / `MachineEmulator` seam. **This change does not
  touch `src/dialects/` or `src/emulator/` at all** — the docs layer never
  imports `src/` at runtime, and the only app-side edit is deleting a message
  handler in `src/components/DocsDrawer.tsx`.

## Decisions

### Four tiers of content, chosen by what each is anchored to

| Tier | Anchored to | Count |
|---|---|---|
| Generic guide | nothing; interpolates both sides | 1 |
| Target-only notes and substitutions | target page | 8 |
| False friends | keyword, with a page→meaning map | ~30–68 |
| Source→target notes | ordered pair | ~10–12 |

*Alternative considered — one explanation per ordered pair (56 units), closest
to today's AI output.* Rejected on scaling and review cost: 56 pieces of
published prose, and a ninth page would add sixteen more.

*Alternative considered — a note for every `(keyword, target)` pair.* Rejected on
measurement: because 57% of keyword names appear on a single page, such a note
would average **1.55** of the 56 pairs of reuse; full coverage is 1923 notes.

*Alternative considered — folding false friends into the pairwise tier,* as
originally scoped. Rejected because they are anchored to a keyword, not a pair:
`LOG` differs between Commodore and both Acorn pages, so a pairwise encoding
duplicates it and a page→meaning map does not. The map also covers new dialect
pairs automatically.

### Pairwise notes only where the relationship is real

Given the 27–33% baseline, a pair note at that level would be padding. Tier 4 is
reserved for the three pairs that clear it, plus two cases the numbers do not
capture:

- **Carrier incompatibilities.** ZX80/ZX81 carry machine code inside the listing
  as hidden-REM records (`supportsBinaryLines`); the Spectrum uses separate
  `.TAP` CODE blocks, so such a program cannot port as-is. And ZX80/ZX81 use
  identical escape spellings with different byte values (20 of 23 differ), so
  block graphics port silently wrong between the two closest machines.
- **False continuity.** `atom↔bbc` scores 32% — baseline, and below
  `atom↔zx81` — so the note exists to warn that same-manufacturer intuition is
  wrong here.

### Operators are excluded from the keyword diff, not normalised

The tables have no consistent inclusion rule for `kind: 'operator'`: `+ - * /`
appear on four of eight pages, `( ) , ;` only on zx80, and `NOT` is an operator
row on four pages, a function row on three and absent on atom. Excluding them
from `diffKeywords` removes 11% of false claims in one edit.

*Alternative considered — normalising the operator rows across all eight
tables.* Rejected as separate, larger work whose primary consumer is the
language reference rather than the comparison, and some divergence is
deliberate (`docs/reference/bbc.md:18-21` omits `?`/`!`/`$` on purpose).
Operator differences that matter to a port are carried by `PortingFacts`
instead, as `exponentOperator` already is.

### Porting content extends `portingFacts`

`docs/reference/data/facts.ts` already holds one entry per page, and
`facts-crosscheck.test.ts` already asserts its id set matches the page set.
Putting the target-anchored notes there inherits that completeness guarantee.
The keyword- and pair-anchored data is sparse and belongs in its own module.

### Brevity is enforced, not merely intended

The page already renders the twelve fact rows side by side and the full keyword
lists. Prose that restates them would consume the entire reading budget without
adding anything, so the crosscheck asserts a character cap per note and a
maximum bullet count. This keeps the budget from rotting as dialects are added.

### Removal, not deprecation, of the AI explain action

`diffSummaryText()`, `explainWithAi()`, `EXPLAIN_MESSAGE` and the app-side
`explainPorting()` handler are deleted outright; keeping both paths would mean
two answers to one question that can disagree. `convertWithAi` /
`convertProgram` are untouched.

### Authored by AI draft, then edited and committed

The repo has zero checked-in generated data files; generation is one-shot
scaffolding that refuses to overwrite. This content follows the same rule:
drafted once, edited by a human, committed as prose data. No generator script —
at eight units plus one guide it would not earn its keep. Two mechanical
worklists keep the drafting bounded: the 68 same-name/same-kind/divergent-
description false-friend candidates, and `(keyword, target)` gaps ranked by how
many pages carry the keyword.

## Risks / Trade-offs

- **Prose goes stale when a keyword table changes** → the new
  `porting-crosscheck.test.ts` fails when a substitution names a command the
  target already has or that exists nowhere; when a false friend names a page
  that lacks that command, lists fewer than two pages, or gives identical
  meanings; when a pair note names a non-page, has `from === to`, or duplicates
  another; when an equivalence group names a spelling absent everywhere or
  groups two spellings present on the same page. The substitution and
  false-friend assertions are mirror images — one requires absence on the
  target, the other presence on both.
- **A false friend or equivalence could assert something untrue** → structural
  errors are caught by the above; semantic correctness rests on review, as for
  every other hand-authored row under `docs/reference/data/`.
- **Excluding operators hides a genuine operator difference** → mitigated by
  carrying the ones that matter in `PortingFacts`; `exponentOperator` already
  establishes the pattern and is already rendered in the fact table.
- **Notes are best-effort, so coverage is uneven** → accepted; a command with no
  note renders exactly as today, so the page is never worse than now.
- **The drafting pass could launder unverified machine behaviour into published
  docs** → CLAUDE.md requires machine behaviour to come from primary sources,
  never from memory. Known repo contradictions must be resolved or omitted
  rather than smoothed over: ZX81 variable naming (`docs/reference/zx81.md:19`
  versus `facts.ts` and the aiProfile), Atom's `?` operator (documented as
  working in the reference, "not yet implemented" on the hardware page), and
  `PRINT @` / `PRINT USING`, which are TRS-80 reference rows that the shipped
  interpreter does not implement.
- **The Commodore/TRS-80 lineage claim is not on any published page** — it is
  stated only in `src/editor/variableLint.ts` and `src/editor/crunch.ts`
  comments. Writing it into the guide introduces the claim rather than repeating
  it, so it needs review against primary sources.

## Migration Plan

Additive and self-contained, and sequenced so each step stands alone: the
operator exclusion and equivalences improve the page on their own, before any
prose exists. Rollback is reverting — no data migration, no stored state, no
persisted user content. The docs offline cache picks the content up on its
normal update cycle, since it ships inside the already-precached page bundle.

## Open Questions

- Should the compare page gain e2e coverage? Not required — the layout guard in
  `src/e2eCapabilityLayout.test.ts` is deliberately one-way ("Capabilities
  without e2e coverage … are legal"), so the new capability needs no `e2e/`
  folder. The question is whether the page is worth covering on its own merits.
- Should the per-dialect notes also appear on each dialect's own reference page?
  Out of scope here; the data shape allows it.
