## Context

The Compare dialects page is `docs/reference/compare.md`, which feeds eight
per-dialect reference tables, eight escape tables and `portingFacts` into
`docs/.vitepress/theme/components/DialectCompare.vue`. The diff itself is pure
logic in `docs/.vitepress/theme/dialectCompare.ts` (`diffKeywords`,
`diffEscapes`), whose header states the constraint the whole docs layer obeys:
*Node-testable and SSG-safe: imports only the docs data types, never `src/`.*
Docs data is hand-authored and held true to `src/` by four crosscheck test
suites, not by regeneration — see `docs/contributing/architecture.md` for how
the docs and app layers relate.

Today's "Explain porting with AI" button is gated on `embedded` (true only
inside the IDE's docs-drawer iframe), builds a plain-text diff summary, and
posts it to the app, which appends a fixed instruction and streams a reply into
the AI panel. Critically, that path never includes the user's program or lint
errors — unlike the sibling convert action. Its input is therefore entirely
checked-in documentation data.

Measurements taken across the eight reference tables, which drove the shape
below: 341 unique keyword names, 805 rows, and 2973 "must replace" instances
across the 56 ordered dialect pairs. 195 of the 341 names (57%) appear on
exactly one page.

## Goals / Non-Goals

**Goals:**

- Porting guidance is present on the page for every reader — no API key, no
  iframe, offline.
- The keyword comparison stops misreporting spelling variants as missing
  commands.
- Authoring cost grows with the number of dialects, not with its square.
- Staleness is caught by `npm test`, in the same style as the existing docs
  crosscheck suites.

**Non-Goals:**

- Automatic program translation (the convert action keeps that job).
- Exhaustive per-command porting notes.
- Any change to the `Dialect` / `MachineEmulator` seam. **This change does not
  touch `src/dialects/` or `src/emulator/` at all** — the docs layer never
  imports `src/` at runtime, and the only app-side edit is deleting a message
  handler in `src/components/DocsDrawer.tsx`.

## Decisions

### Author per target dialect, not per dialect pair

Guidance is written once per target machine and reused across all seven source
machines, plus one shared machine-independent guide.

*Alternative considered — one explanation per ordered pair (56 units), closest
to today's AI output.* Rejected on scaling and review cost: 56 essays become
published documentation needing review, and a ninth dialect page would add
sixteen more.

*Alternative considered — a note for every `(keyword, target)` combination.*
Rejected on measurement. Because 57% of keyword names appear on a single page,
the average such note would serve only **1.55** of the 56 pairs; full coverage
is 1923 notes, and even restricting to keywords shared by four or more pages is
138 notes for 22% of the cases. The reuse that motivated the idea is not there.

### Keyword equivalences are a data relation, not prose

`diffKeywords` matches on exact spelling, so `GOTO`/`GO TO` and `CLEAR`/`CLR`
each surface twice: once as a command to replace and once as a command newly
gained. This is a correctness defect in the comparison, and no amount of
generated prose fixes it. A small hand-authored list of equivalent spellings,
consumed by `diffKeywords`, reclassifies them as a rename.

This is deliberately sequenced first: it improves the page on its own, and it
shrinks the set of differences the prose must account for.

*Alternative considered — describing the variants in prose instead.* Rejected:
it would leave the comparison's own counts and lists wrong, which is what
readers scan first.

### Porting content extends `portingFacts`

`docs/reference/data/facts.ts` already holds exactly one entry per documentation
page, and `facts-crosscheck.test.ts` already asserts its id set matches the
page set. Adding the per-dialect notes and substitutions there inherits that
completeness guarantee instead of duplicating it, and keeps all per-dialect
porting data in one file.

*Alternative considered — a separate module per dialect.* Rejected as premature
for a corpus this size, and it would need its own completeness test.

### The shared guide is page prose, not data

The machine-independent part of a port is written directly in
`docs/reference/compare.md`. It has no per-dialect structure to model, so making
it data would buy nothing and cost a schema.

### Authored by AI draft, then edited and committed

The repo has zero checked-in generated data files; generation is one-shot
scaffolding that refuses to overwrite (`scripts/gen-reference-scaffold.mts`),
with correctness held by crosscheck tests. This content follows the same rule:
drafted once, edited by a human, committed as ordinary prose data. No generator
script is added — at eight units plus one guide it would not earn its keep.

Once committed, this is published end-user documentation and is bound by the
`docs/` house rules: no `src/` paths, no internal symbols, no references to
unpublished files.

### Removal, not deprecation, of the AI explain action

`diffSummaryText()`, `explainWithAi()`, `EXPLAIN_MESSAGE` and the app-side
`explainPorting()` handler and its listener branch are deleted outright. Keeping
both paths would mean two answers to the same question that can disagree.
`convertWithAi` / `convertProgram` and their message type are untouched.

## Risks / Trade-offs

- **Prose goes stale when a keyword table changes** → a new
  `docs/reference/data/porting-crosscheck.test.ts` fails `npm test` when a
  substitution names a command that exists on no page, when it names one the
  target dialect already has (making the advice redundant), or when an
  equivalence group names a spelling absent everywhere or groups two spellings
  that both exist on the same page.
- **Guidance is less specific than a tailored AI answer for an unusual pair** →
  accepted, and offset by reaching every reader rather than only key-holding IDE
  users. The convert action remains for users who want something specific to
  their own program.
- **An equivalence group could assert a false synonym**, hiding a real
  difference → the same-page assertion catches the structural error; semantic
  correctness rests on review, as it does for every other hand-authored row in
  `docs/reference/data/`.
- **Notes are best-effort, so coverage is visibly uneven** → accepted
  deliberately; a command with no note renders exactly as it does today, so the
  page is never worse than the current state.
- **Removing the AI action is user-visible in the IDE drawer** → the replacement
  is present on the same page, unconditionally, so no one loses access to the
  answer.
- **The compare page has no e2e coverage today** (`e2e/` has no docs capability
  folder) → the new behaviour is covered by unit tests in the docs theme and by
  the crosscheck suite; whether the page earns e2e coverage is left open below.

## Migration Plan

Additive and self-contained. The equivalence relation ships first and stands
alone; the guidance sections follow. Rollback is reverting the change — no data
migration, no stored state, no persisted user content is involved. The docs
offline cache picks up the new content on its normal update cycle, since the
guidance ships inside the already-precached page bundle.

## Open Questions

- Should the compare page gain e2e coverage? Not required: the layout guard in
  `src/e2eCapabilityLayout.test.ts` is deliberately one-way ("Capabilities
  without e2e coverage … are legal"), so the new capability needs no `e2e/`
  folder and nothing fails without one. The question is whether the page is
  worth covering on its own merits.
- Should the per-dialect notes eventually be surfaced on each dialect's own
  reference page, not just in the comparison? Out of scope here, but the data
  shape chosen allows it.
