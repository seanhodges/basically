## Why

The porting guide's "Keywords to replace" list is a flat alphabetical set
difference that runs from 4 to 147 entries depending on the dialect pair, capped
at 10 with a "Show N more…" button. Alphabetical order is uncorrelated with
importance, so the ten visible entries are the ten least interesting ones:
porting ZX81 → CPC opens on `AFTER ASC AUTO BIN$ BORDER CALL CAT CHAIN
CHAIN MERGE CINT`, while `DATA READ RESTORE ELSE WHILE WEND LEFT$ MID$ RIGHT$
PLOT DRAW SOUND` sit below the fold.

The deeper cause is that a keyword row carries no notion of *what it does*.
`ReferenceEntry.kind` is only `command | function | operator` — a syntactic
class. A porter thinks "I lose all my graphics", not "I lose 40 functions", and
the data cannot express that. Adding a capability axis fixes the ordering
problem now and is the prerequisite for attaching per-capability porting advice
(a separate follow-up change).

## What Changes

- **New shared capability vocabulary.** 13 domains — `control-flow`, `data`,
  `numeric`, `strings`, `text-screen`, `graphics`, `colour`, `sound`, `input`,
  `storage`, `memory-hardware`, `program-editing`, `error-handling` — closed and
  identical across all eight BASIC reference pages, so `graphics` means the same
  thing on every machine.
- **Every BASIC keyword row gains a domain.** All 805 rows across the eight
  dialect data files, including the 101 operator rows (which are already
  semantically typed: a ZX80 `;` is a PRINT separator, an Atom `:` is bitwise
  XOR). Enforced at compile time by a narrowed table type, not only by tests.
- **"Keywords to replace" is grouped by capability** instead of presented as one
  alphabetical list, with each group showing its full count.
- **Commands are named, not tabulated.** Each group lists its commands as one
  comma-separated run rather than a detailed row each, so 41 lost graphics
  commands are a wrapped line instead of 41 rows. The advice a reader acts on is
  written per capability, so a description repeated against every lost command
  makes the guide longer without making it clearer.
- **No truncation in that section.** Because a group is a line rather than a
  table, every lost command is shown; capabilities the port does not touch are
  omitted entirely instead of collapsed behind a control. The five lists that do
  render a row per entry keep their existing cap unchanged.
- **Reference pages gain a `?domain=` filter** — a second chip row alongside the
  existing kind chips, mirroring the escape pages' existing `?cat=` filter. It
  renders only where entries carry domains, so the two assembly reference pages
  are unaffected.

No behaviour is removed and no existing list disappears in this change.

## Non-goals

- **Per-capability porting advice** (what to do instead, worked examples) and
  **replacing the "Newly available" list with a capability brief**. Both depend
  on this change's domain axis and land in the follow-up change
  `add-capability-porting-advice`. Grouping ships first because it fixes the
  ordering defect with zero prose authoring.
- **Categorising the two assembly reference tables** (`m6502-assembly.ts`,
  `z80-assembly.ts`). Their mnemonics have no BASIC capability; the domain field
  stays absent there and a test pins that.
- **Folding multi-word keyword variants** (`ON BREAK` / `ON BREAK CONT` /
  `ON BREAK GOSUB` / `ON BREAK STOP` count as four entries today). Grouping
  already places them adjacent, and folding them would renegotiate the "counts
  reflect every entry" guarantee this change strengthens.
- **Changing `diffKeywords` itself.** Bucket membership, the operator exclusion
  and the rename mapping are untouched; grouping layers on top.
- **The docs sidebar.** No new pages, no sidebar edits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: adds a requirement that the commands a port must replace
  are grouped by the capability they provide, ordered so that capabilities the
  target lacks entirely report first; and extends the existing capped-list
  requirement so that its counting and reveal guarantees apply to a group within
  a list as well as to a whole list.

No delta for `dialect-toolchain`, whose only reference-documentation requirement
concerns version tags on keywords, which this change does not touch. The
`?domain=` reference-page filter is not covered by any capability spec.

## Impact

**New files**

- `docs/reference/data/domains.ts` — the vocabulary, its canonical order, and
  the tie-break rules an author needs.
- `docs/.vitepress/theme/domainMeta.ts` — labels and icons, mirroring the
  existing `kindMeta.ts` split between data ids and presentation.

**Modified**

- `docs/reference/data/types.ts` — optional `domain` on `ReferenceEntry` (shared
  with the assembly tables), plus `BasicReferenceEntry` / `BasicReferenceTableData`
  that make it required for the eight BASIC pages.
- `docs/reference/data/{atom,bbc,commodore,cpc,trs80,zxspectrum,zx80,zx81}.ts` —
  one type annotation each, plus a `domain` on every row (47–191 rows per file).
- `docs/.vitepress/theme/dialectCompare.ts` — `groupByDomain` and
  `domainSections`, both pure and taking the domain order as an argument so the
  module keeps importing nothing but docs data types.
- `docs/.vitepress/theme/components/DialectCompare.vue` — grouped rendering and
  a per-group truncation helper replacing the single `mustReplaceList`.
- `docs/.vitepress/theme/{referenceTable.ts,deepLinkParams.ts}` and
  `components/ReferenceTable.vue` — the `?domain=` filter.
- Tests: `reference-data.test.ts`, `asm-reference.test.ts`,
  `dialectCompare.test.ts`, `referenceTable.test.ts`, `deepLinkParams.test.ts`.

**Not affected**

No `src/` code changes — this is confined to the docs site. `keyword-crosscheck.test.ts`
keeps pinning the reference rows to the real dialect keyword tables unchanged,
because `BasicReferenceTableData` is assignable to `ReferenceTableData`. No new
dependencies. The comparison remains fully static: no network, no API key, no
runtime generation.

**Risk**

Categorising 805 rows by hand is the main correctness risk, and no test can
prove that `SPEED INK` is `colour` rather than `text-screen`. Mitigated by
writing the tie-break rules into `domains.ts`, committing one dialect file at a
time, and a test asserting every domain in the vocabulary is actually used.
