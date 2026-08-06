## 1. The vocabulary

- [x] 1.1 Create `src/reference/placeholders.ts` mirroring `src/reference/domains.ts`:
      `CORE_PLACEHOLDERS` (35 entries, `{ id, meaning }`, canonical order), the derived
      `CorePlaceholder` type, the `Placeholder` interface, `placeholderTokens(syntax)`
      using `/<([a-z][a-z0-9]*)>/g`, and `placeholdersUsed(entries, extension)`. Header
      comment carries R0–R12 and the D3 tie-break rules.
- [x] 1.2 Add `placeholders?: readonly Placeholder[]` to `ReferenceTableData` in
      `src/reference/types.ts`, narrowed to required on `BasicReferenceTableData` (the
      same optional-then-narrowed pattern `domain` already uses), and update the `syntax`
      field doc comment to point at `placeholders.ts` as the contract.
- [x] 1.3 Declare `placeholders` on all nine BASIC tables — `[]` for `altair8800`,
      `atom`, `zx80`, `zx81`; the extension arrays for `cpc` (13), `commodore` (4),
      `trs80` (2), `zxspectrum` (1), `bbc` (1: `amplitude`). Typecheck green, nothing
      asserted yet.

## 2. Finish the Amstrad page's enrichment

`cpc.ts` is the scaffold `scripts/gen-reference-scaffold.mts` seeded and its own header
says was "hand-enriched" — its syntax strings are still byte-identical to `signature:` in
`src/dialects/cpc464/keywords.ts`. **Do not touch `src/dialects/**`**: terse is correct
for the autocomplete tooltip. 81 of the 192 rows take no arguments, so ~110 need work.
Batch by domain to keep each diff reviewable.

- [x] 2.1 control-flow and data (~40 rows), including the fragment rows per R7 (`STEP`,
      `TO`, `THEN`, `ELSE`) and `IF <number> THEN <statement> [ELSE <statement>]`.
- [x] 2.2 strings and numeric (~35 rows).
- [x] 2.3 text-screen and storage (~45 rows), including `#<stream>` per R6 and
      `<filename>` replacing every quoted `"name"` per R5.
- [x] 2.4 graphics and colour (~30 rows), applying the `<pen>` vs `<colour>` correction:
      `PLOT`/`DRAW`/`CLG`/`FILL`/`GRAPHICS PEN` take a pen number, while
      `INK <pen>, <colour>[, <colour>]` assigns a hardware colour 0–26 to a pen.
- [x] 2.5 sound and memory-hardware (~27 rows), including
      `SOUND <channel>, <period>[, <duration>[, <volume>[, <volenv>[, <toneenv>[,
      <noise>]]]]]` and `POKE <addr>, <byte>`.
- [x] 2.6 The 17 operator rows per R12 (free — `operatorNames()` drops operator rows from
      the diff on both pages).
- [x] 2.7 Lift the prose out of the syntax cells per R9: `ENT`/`ENV`
      (`(up to 5 sections)` → description), `SYMBOL code,row,…`, and
      `ON n GOSUB/GOTO line,…` → the two `|` alternatives the BBC already uses (which
      also fixes a real defect: `GOSUB/GOTO` is not something a user can type).

## 3. Normalise the other eight tables

- [x] 3.1 The 48 mechanical retirements, all shape-neutral: `<int>`→`<number>` ×22,
      `<handle>`→`<file>` ×8, `<channel>`→`<file>` ×7 (storage sense only — `SOUND
      <channel>` keeps it), `<expression>`→`<expr>` ×6, `<text>`→`<comment>` ×4,
      `<lf>`→`<file>` ×4, `<item>`→`<constant>` ×2, `<cond>`→`<number>` ×2, and Atom's
      `DIM <name>(…)`→`<var>` ×1.
- [x] 3.2 Role enrichment, ~150 rows, shape-neutral by construction (one marker in, one
      marker out): `<addr>`, `<byte>`, `<x>`, `<y>`, `<dx>`, `<dy>`, `<row>`, `<col>`,
      `<colour>`, `<mode>`, `<action>`, `<port>`, `<pitch>`, `<duration>`, `<amplitude>`,
      `<filename>`, `<prompt>`. Enrich **heterogeneous** repeats only — leave homogeneous
      lists such as `READ <var>[, <var>]…` alone.
- [x] 3.3 The shape-changing structural edits (~120 rows): R2 ellipsis outside its bracket
      (commodore ×9, zxspectrum ×6, trs80 ×3), R5 quotes off placeholders, R11 `…` that
      means "and so on" becomes a real placeholder, R7 fragment expansion, R4 alternation
      spacing, R12 operator operands, R3 separator spacing.
- [x] 3.4 Verify the R0 exceptions rather than assuming them: Commodore's literal
      `D<number>` / `[, W]` / `I<id>` stay; check whether the Atom requires
      `?<addr>=<byte>` tight against `src/dialects/atom/`; check the Spectrum's
      empty-parameter `DEF FN` form against its tokenizer. Add a row comment wherever a
      rule yields.
- [x] 3.5 Re-run the pairwise behaviour-change count across all 36 page pairs (scratch
      script, not committed) and confirm it moved **below** today's 650 — not above.
- [x] 3.6 Record any vocabulary additions or removals the sweep proved necessary back into
      `placeholders.ts`, and resolve the `<switch>` open question (core if ≥2 pages use
      it, otherwise a page extension).

## 4. Enforce it

- [x] 4.1 Extend `src/reference/reference-data.test.ts` with the per-page assertions
      (D5.1–D5.7): every token in core ∪ extension, no dead extension entry, no shadowing,
      no unexplained `<`, no surviving bare placeholder, the mechanically safe structural
      rules, and entry hygiene.
- [x] 4.2 Add the global assertions (D5.8–D5.9): the core is used in full across the BASIC
      tables and nothing beyond it, and two pages declaring the same extension id declare
      the same meaning.
- [x] 4.3 Add an explicit test that the relational-operator rows
      (`'<number> < <number> | <string> < <string>'`, `<=`, `<>`) yield exactly their real
      placeholders and no phantom token — the one place a naive `<[^>]*>` scan would
      silently corrupt the check.

## 5. Remove the dead laundering

- [ ] 5.1 Drop `syntaxShape()`'s lowercase-word → `#` replacement in
      `src/reference/compare.ts`, keeping `<…>` → `#` and the whitespace/bracket
      normalisation.
- [ ] 5.2 Rewrite the `syntaxShape` doc comment: it asserts a now-false fact and a stale
      figure. State the surviving reason — pages name the same slot differently where each
      machine's manual does, and one page may be more specific than another about the same
      argument. Note the `DEF FN<name>` vs `DEF FN <name>` residue the change does not fix.
- [ ] 5.3 Update the five `compare.test.ts` fixtures: `ABS(n)` → `ABS(<expr>)` (test
      fails otherwise), `DRAW x,y` → `DRAW <x>, <y>` (fails otherwise), `DRAW x,y,ink` →
      `DRAW <x>, <y>, <pen>`, `LIST [line]` → `LIST [<line>]`, and `FILL <ink>` →
      `FILL <pen>`. Rewrite the comment above the first, which repeats the CPC claim.
- [ ] 5.4 Confirm `perMachineCompare.test.ts` (never asserts `behaviourChanged`),
      `portDescription.test.ts`, `keyword-crosscheck.test.ts` and `src/ai/portReport.test.ts`
      pass unchanged.

## 6. The legend

- [ ] 6.1 Add `## Argument notation` to `docs/reference/index.md` covering the structural
      markings only, in the spirit of `docs/reference/z80-assembly.md`'s
      `## Operand notation`.
- [ ] 6.2 Render a `<details>` vocabulary legend in
      `docs/.vitepress/theme/components/ReferenceTable.vue` from
      `placeholdersUsed(props.data.entries, props.data.placeholders ?? [])`, placed below
      the table above `.reftable-count`.
- [ ] 6.3 Make `.reftable-syntax` wrap (`pre-wrap` + `overflow-wrap: anywhere`) while
      `.reftable-name code` keeps `nowrap` — CPC's `SOUND` cell goes from 52 to ~88
      characters, the longest in the tree.
- [ ] 6.4 Add a colocated unit test for `placeholdersUsed`: given entries and an
      extension, it returns exactly the entries used, core order then extension.
- [ ] 6.5 Link the legend from each of the nine dialect pages and from
      `docs/reference/compare.md`. Do not touch the sidebar config.

## 7. Docs prose

- [ ] 7.1 Sweep the ~18 argument-bearing code spans: `atom/hardware.md` (`MOVE x,y`,
      `DRAW x,y`, `PLOT mode,x,y`), `bbc/hardware.md` (`COLOUR n`, `GCOL mode,n`,
      `PLOT k,x,y`, `SOUND channel,amplitude,pitch,duration`), `cpc/hardware.md`
      (`INK p,c`, `PLOT x,y[,pen]`, `DRAW x,y[,pen]`, `SOUND channel,period,…`,
      `CALL address`), `trs80/hardware.md` (`PRINT @ n,`, `SET(x,y)`, `RESET(x,y)`,
      `POINT(x,y)`, `OUT 255,n`), `zxspectrum/hardware.md` (`PLOT x,y`,
      `BEEP duration,pitch`). `commodore`, `altair8800`, `zx80`, `zx81` have none.
      Concrete literals (`MODE 0`, `CLEAR 32767`, `OUT &7F00,&C0+n`, `RAND USR 16514`)
      stay literal per R10.
- [ ] 7.2 Add an "arguments and their order" theme to `docs/reference/porting-basics.md`:
      differing argument counts, a leading action argument on the Acorn machines only,
      reordered arguments (`SOUND` puts duration last on the BBC and third on the
      Amstrad; the Spectrum's `BEEP` puts it first), optional arguments the target lacks,
      and parenthesisation — cross-linking the comparison's existing bracketing bucket.
      Verify every claim against the reference data and the hardware pages.
- [ ] 7.3 Fix the sentence in `docs/reference/file-formats.md` that mixes `NN` and `xx`
      for escape placeholders.

## 8. Optional adjacent fix

- [ ] 8.1 `PortingFacts.memoryWriteSyntax` in `src/reference/facts.ts` is a third argument
      notation (`'POKE addr,val'` ×7, `'?addr=val (byte), !addr=val (word)'` ×2) rendered
      in the comparison's facts table right beside reference syntax. Bring the nine onto
      the same notation; `facts-crosscheck.test.ts` asserts only `/POKE/` and `/[?!]/`, so
      `POKE <addr>, <byte>` passes. Leave the prose `substitutions` notes alone —
      `portDescription.test.ts` pins one verbatim.

## 9. Quality gates

- [ ] 9.1 `npm run typecheck && npm test && npm run lint && npm run format:check`.
- [ ] 9.2 `npm run docs:build`, then `npm run docs:dev` and read one dialect page, the
      legend disclosure and the comparison page by eye.
- [ ] 9.3 `npm run e2e:chromium -- e2e/porting-guidance` — the comparison is the only
      app-visible consumer. Leave unchecked with a note if it fails.
- [ ] 9.4 Confirm the point of the change: the pairwise behaviour-change total across all
      36 page pairs is below today's 650, and spot-check that BBC → Amstrad's survivors
      are real language differences. Confirm against the `porting-guidance` requirement
      "Differences in usage notation are not reported as behaviour changes" that
      placeholder-name variation is still not reported.
- [ ] 9.5 `npx openspec validate --specs` and `npx openspec validate --changes`.
