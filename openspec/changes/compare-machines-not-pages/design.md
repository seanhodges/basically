## Context

The porting comparison is keyed by docs page slug — `porting.ts` says so in its
own header, and `facts-crosscheck.test.ts` encodes it as a `REPRESENTATIVE`
page→dialect map. That was the same thing as "machine" when every machine had
its own page. Five delegation dialects later it is not: `zxspectrum128`,
`bbcmaster`, `cpc6128`, `pet` and `vic20` share a page with a sibling, so four of
the eight pages each cover two or more BASIC versions.

The component layout and dialect seam this builds on are described in
`docs/contributing/architecture.md`.

**Dialect seam impact: none.** Nothing here crosses the `Dialect` /
`MachineEmulator` boundary. The seam already models every variant exactly —
`cpc6128Keywords = locoKeywords('basic11')`, `petKeywords = c64Keywords` plus the
15 BASIC 4.0 disk commands, `vic20Keywords` re-exports the C64's, `BASIC_IV =
bbcKeywordTable + basicIVExtraKeywords`. This change stops the docs from
flattening what the seam already distinguishes. No `src/dialects/` or
`src/emulator/` behaviour changes; the one `src/` edit is a resolution fix in
`DocsDrawer.tsx`.

The binding constraint is that **the docs runtime must never import `src/`**.
`src/dialects/registry.ts` imports all 13 dialect index files, each of which
pulls in its emulator core, so importing it would drag the CPC, BBC and C64
machines into a public docs bundle. Only `*.test.ts` files under `docs/` may
import `src/` — vitest runs them in node and the VitePress bundle never includes
them. Every decision below follows from that.

## Goals / Non-Goals

**Goals:**

- The comparison's unit is the machine; all 13 answer for themselves.
- Per-machine data is *derived from* and *pinned to* `src/dialects/`, not
  independently researched, so it cannot drift.
- Family selections survive, relabelled honestly, so existing shared links keep
  working without an alias table.
- The crosscheck tests get stronger, not weaker: one union assertion per page
  becomes an exact assertion per machine.

**Non-Goals:**

- The machine-picker UI (a follow-up change; see the proposal's Non-goals).
- Splitting the shared `docs/reference/<family>.md` reference pages.
- The `bbcShared/` extraction flagged in `src/dialects/bbcmaster/index.ts`.
- Changing what `docsReference` means for docs links.

## Decisions

### Scope rows by machine id, keep `tag` as the display label

`ReferenceEntry` and `EscapeEntry` gain `onlyOn?: string[]` — dialect ids the
row exists on, absent meaning every machine on the page. The existing prose `tag`
(`'BASIC 4.0'`, `'BASIC 1.1 only'`, `'128K only'`) stays as the human label.

The field is **not** called `machines`, because `ReferenceTableData` already has
a `machines: string[]` — the page's *display names*
(`['Commodore 64', 'Commodore VIC-20', 'Commodore PET']`). Two different meanings
behind one name, one nested inside the other, is a trap for the next reader.
`onlyOn: ['cpc6128']` reads correctly at the call site and cannot be confused
with it.

*Alternative considered: drive the filter off `tag` itself.* Rejected on three
counts. It is prose, so matching it means string-sniffing; `bbc.ts` has no tags
at all despite BASIC IV adding `EDIT`; and `zx80.ts` carries 8 tags that are ROM
revisions, not machine scoping — a `tag`-driven filter would misread every one of
them. Structured scoping says exactly what it means.

*Alternative considered: one reference table per machine.* Rejected — it would
triple the Commodore table and duplicate ~90% of every family's rows by hand,
which is precisely the drift the crosscheck tests exist to prevent.

### Narrow the tables at the call site; the diff engine is unchanged

`dialectCompare.ts` needs **no signature changes**. Every function in it is
already pure with all inputs passed in: `diffKeywords` takes whole
`ReferenceTableData` objects, `capabilitySections` takes entry arrays plus a
table, `escapeSections` takes entries plus a table, `composeGuidance` takes
`targetFacts` ready-made. So machine scoping is applied by narrowing the tables
*before* they go in:

```
tableForMachine(page: ReferenceTableData, dialectId): ReferenceTableData
  → the same table with entries filtered by onlyOn
```

*Alternative considered: thread a machine id through the four entry points.*
Rejected — it would change four public signatures and every existing test in
`dialectCompare.test.ts` to achieve what one filter does at the call site, and it
would push a machine concept into a module whose header promises it imports only
docs data types and stays node-testable and SSG-safe.

Two engine details must survive the change:

- `operatorNames(source, target)` deliberately unions **both** tables, because
  the pages disagree about kind — `NOT` is an operator row on the BBC and a
  function row on the ZX81. Narrowing happens before that union and must not
  disturb it, or `NOT` gets reported as newly available on a machine that has
  always had it.
- `composeGuidance`'s `from`/`to` stay **page slugs**. Pair notes and false
  friends are family-wide by design; machine → page resolution happens at the
  call site.

The only genuinely new engine logic is the union-range presentation for facts.

### Per-machine crosschecks replace the union crosschecks

`keyword-crosscheck.test.ts` currently pins each page to a family union
(`commodore` → `petKeywords`, `zxspectrum` → 48K + `SPECTRUM` + `PLAY`). Replace
that with: for each of the 13 registered dialects, the rows selected for that
machine equal `getDialect(id).keywords` exactly, in both directions.

This is what makes hand-authored `machines` data trustworthy — a mis-scoped row
fails immediately, and a newly registered dialect fails until its scoping exists.
It also surfaces the pre-existing BBC gap on the first run: `bbcReference` is
pinned to `bbcKeywords` (BASIC II), so BASIC IV's `EDIT` is missing from the docs
and the per-machine assertion for `bbcmaster` will fail until it is added.
Expect that failure; it is the test doing its job.

`escapes/escape-crosscheck.test.ts` gets the same treatment.

### Facts key by machine, with family bases to avoid 13× prose

`PortingFacts.id` becomes a dialect id and the list grows 8 → 13. Most fields are
identical within a family and several are long prose, so entries gain
`extends?: string` naming a base entry, resolved at load. A family member then
declares only what genuinely differs — the hardware fields (`freeRamBytes`,
`screen`, `colour`, `sound`, `programStart`, `screenBase`) and, for the PET, its
BASIC 4.0 storage notes.

`facts-crosscheck.test.ts` then deletes `REPRESENTATIVE` and pins all 13 entries
to their own `Dialect`. Its existing assertions (`freeRamBytes ===
dialect.programRamBytes`, `addressNotation`, `hexPrefix`, `statementSepChar`,
`memoryWriteSyntax`, `screenBase`, `programStart`) work unchanged, just applied
per machine. **Deleting `REPRESENTATIVE` is the completion signal for this
change** — while it exists, the fold does.

*Alternative considered: flatten all 13 entries with no inheritance.* Rejected —
it duplicates paragraphs of hand-written prose across family members, and the
crosscheck can only pin the structural fields, not the prose, so the copies would
drift silently.

### Family selections stay, as explicit unions

The four multi-machine pages remain selectable, keeping today's union semantics
but relabelled ("Locomotive BASIC — either CPC"). Where a figure differs across
members the union reports the range (Commodore free RAM as a spread across
3583–38911) rather than the marquee machine's value.

This is what makes keeping the family slugs defensible: it converts a silent
inaccuracy into a labelled choice, and it means `?from=cpc&to=bbc` reopens
exactly the comparison it always did — no redirect, no legacy alias table,
because family slugs are still first-class selections. Single-machine pages
(`zx81`, `zx80`, `atom`, `trs80`) already have slug === dialect id, so they need
no union entry.

### `dialectForPage` resolves machine ids exactly

`DocsDrawer.tsx:42` currently does `dialects.find((d) => (d.docsReference ?? d.id) === slug)`,
which returns whichever family member is first in registry order — so "Convert my
program" to Locomotive BASIC always opens a CPC 464. It must try an exact id
match first, falling back to the page lookup. A union selection necessarily still
resolves to the family's marquee machine, since the IDE has to open *some*
machine; the spec now requires that machine to be named in the offer.

### Hand-authored and pinned, not generated

`scripts/gen-reference-scaffold.mts` exists and could emit the scoping, but the
scoping is a one-off classification of ~30 rows, not an ongoing generation
pipeline, and the reference tables are hand-maintained prose everywhere else.
Hand-author the `machines` fields and let the per-machine crosschecks be the
guarantee — the same contract every other docs data module already operates
under.

## Risks / Trade-offs

- **The BBC `EDIT` row is a real docs gap, not just a test failure.** → It needs
  a genuine reference row (syntax, description, domain) written from
  `basicIVExtraKeywords` in `src/dialects/bbcmicro/keywords.ts`, scoped to
  `bbcmaster`. Treat it as content work, not a test fix.
- **Union facts need a defined answer for every field, not just free RAM.** →
  Screen, colour, sound and program start all differ across the Commodore family.
  Decide the range/"varies" presentation once, in `dialectCompare.ts`, rather
  than per field at the call sites.
- **What a machine's hardware ignores is a fact, not an absent row.** The
  Commodore escape codes are the worked example: all three machines re-export
  `c64Charset`, and `pet/charset.ts` states that the colour escapes are
  "meaningless-but-harmless bytes on a monochrome PET: a program may still store
  and round-trip them, they just have no visible effect". Scoping them off the
  PET would tell a porter to *replace* `{red}`, and the charset probe in
  `escape-crosscheck.test.ts` would still pass for the PET — the scoping would
  contradict its own crosscheck. → The PET's monochrome display belongs in its
  `colour` fact. Only scope a row when the machine genuinely cannot express it.
  The same trap applies in reverse to keywords: never scope one in a way the
  charset disagrees with.
- **The Spectrum scopes in both directions.** `escapes/zxspectrum.ts` already
  tags the UDG rows for `0xA3`/`0xA4` `'48K only'` — on a 128K those bytes are
  the `SPECTRUM` and `PLAY` tokens, not UDGs. So the Spectrum needs 2 keyword
  rows scoped to `zxspectrum128` *and* 2 escape rows scoped to `zxspectrum`.
  These two rows are the only escape scoping in the change; every other escape
  table is a single-machine page or has one row.
- **Selection count roughly doubles (8 → 17) in a native `<select>`.** → Group
  the options so the list stays scannable. The follow-up picker change removes
  this concern entirely, which is part of why it follows closely.
- **`porting.ts` equivalences stay page-keyed.** Spellings are family-wide, so
  this is correct today — but a future variant that renames a command would need
  row-level scoping there too. → Extend `porting-crosscheck.test.ts` so a scoped
  entry must name a row that exists for that machine, making the gap loud if it
  ever arrives.
- **Docs bundle size.** Adding `machines` arrays and 13 facts entries grows the
  shipped data slightly. → Negligible next to the reference tables themselves,
  and far smaller than the alternative of importing the registry.

## Migration Plan

No user data or persisted state is involved. Shared links are the only external
contract, and they are preserved by keeping family slugs selectable — a link
using a machine id is new, a link using a family slug behaves as before. Rollback
is a straight revert; nothing is written anywhere that a revert would strand.

## Open Questions

- Should a union selection be offered as a *target* at all, or only as a source?
  Converting to "either CPC" has to pick a machine anyway, so restricting unions
  to the source side is defensible. Deferred — the spec currently allows both and
  requires the chosen machine be named.
- Does the VIC-20 warrant a bespoke porting note about its 3583-byte budget?
  Its free RAM is small enough that a program fitting on any other Commodore may
  not fit at all, which is arguably guidance rather than a figure.
