## Why

The BASIC language reference tables describe their arguments in two incompatible
notations, and no page tells the reader how to read either. Eight of the nine dialect
tables use `<angle>` placeholders — with 29 distinct names and heavy synonym drift
(`<expr>`/`<expression>`/`<cond>`, `<file>`/`<channel>`/`<handle>`/`<lf>`,
`<int>`/`<number>`) — while `cpc.ts`, the largest table at 192 rows, uses none at all
and writes bare lowercase role names (`n`, `x`, `y`, `ink`, `pen`, `stream`). The two
assembly references each carry an operand-notation legend; the nine BASIC pages carry
nothing.

Beyond being harder to read, this actively degrades the porting comparison.
`syntaxShape()` in `src/reference/compare.ts` exists purely to launder the
inconsistency before diffing — its own doc comment records that comparing the raw text
reported "72 behaviour changes" between the BBC and the Amstrad, "nearly all of them
editorial". Laundering only suppresses rows: the comparison still renders both syntax
strings verbatim under "Different arguments", so the surviving rows make the reader
decode two notations and bury the real difference. Ported to the current data,
BBC → Amstrad still reports 36 argument differences, with genuine ones such as
`SAVE <string>` → `SAVE "name"[,addr]` sitting next to pure notation noise such as
`LET <var> = <number> | <string>` → `LET v=expr`.

## What Changes

- Introduce a **closed placeholder glossary** (`src/reference/placeholders.ts`) whose
  entries may be type-words or role-words but are **always angle-bracketed**:
  `ABS(<number>)`, `PLOT <x>, <y>`,
  `SOUND <channel>, <amplitude>, <pitch>, <duration>`. Angle brackets remain the
  machine-checkable "this is a placeholder" marker.
- **Normalise all nine dialect tables** onto that glossary and onto one set of
  structural rules (optional-group nesting, ellipsis placement, alternation and
  comma spacing, `#`-channel binding, how fragment keywords and assignable
  pseudo-variables are shown, no prose inside a syntax string). Roughly 280–320 of
  877 rows change; `cpc.ts` is the bulk.
- **Enforce it with a conformance test**, mirroring the existing
  `KEYWORD_DOMAINS` check in `reference-data.test.ts` ("used in full across the BASIC
  tables, and nothing beyond it").
- **Give the reader a legend**: the universal structural notation as a section on
  `docs/reference/index.md`, linked from each dialect page; the per-page vocabulary
  generated from the data inside `ReferenceTable.vue`, so it cannot drift.
- **Sweep the hardware-page prose** (~17 argument code spans across five
  `docs/reference/*/hardware.md` pages) onto the same notation, so `GCOL mode,n` and
  `PLOT k,x,y` stop naming the same class of argument two ways on one page.
- **Add an "arguments and their order" theme to `docs/reference/porting-basics.md`** —
  argument count, a leading mode/action argument on some machines only, reordered
  arguments (`SOUND` differs in the order of its first three on BBC vs Amstrad), and
  parenthesisation. Today the primer's five themes omit this entirely.
- **Drop the dead laundering** from `syntaxShape()`: with no bare placeholders left in
  the data, its lowercase-word rule is unreachable, and the conformance test guards
  what it used to paper over. What the comparison tells the reader is unchanged.

Not breaking: no public API, no file format, no stored user data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialect-toolchain`: adds a requirement that the language reference describes
  arguments in one documented notation and that each page states what its
  placeholders mean. This capability already owns the reference-documentation
  guarantee — its "BASIC dialect variants are honoured per machine" requirement
  carries the scenario "Reference documentation marks version-only keywords".

`porting-guidance` is deliberately **not** modified, and its existing requirements are
the reason:

- Its requirement *"Differences in usage notation are not reported as behaviour
  changes"* already guarantees that two references "differing only in how each names
  its placeholders" are not reported as a behaviour change, while a difference in
  argument count, parenthesisation or keyword category still is. This change keeps that
  guarantee exactly — the diff still discards the name inside `<…>` — so the
  requirement is unchanged and becomes the thing to verify against.
- Its requirement *"Guidance covers both the general and the machine-specific"* already
  requires that what any port involves be given its own page and given "in full". The
  new argument-shape theme fulfils that existing requirement rather than adding one.

## Non-goals

- **Changing what the comparison reports.** The diff stays shape-based, discarding the
  name inside `<…>`. Making it compare placeholder *types* — so
  `INSTR(<string>, <string>)` versus `INSTR(<number>, <string>, <string>)` reports a
  type difference — is a separate, user-visible change needing its own
  `porting-guidance` delta.
- **Escape-code notation.** The escape tables have their own placeholder family
  (`{INK n}`, `{$xx}`, `0x10 n`) and their own legend at
  `docs/reference/file-formats.md#escape-notation`. Only one inconsistency there is in
  scope: a single sentence that mixes `NN` and `xx`.
- **Assembly operand notation.** `z80-assembly.ts` and `m6502-assembly.ts` use the
  conventional per-CPU assembler spellings (`n`, `nn`, `$nn`, `#n`, `r`, `cc`) and
  already document them. They keep their own convention.
- **Correcting keyword facts.** This normalises how arguments are *written*. Where the
  sweep exposes a wrong arity or a missing argument, that is fixed as a factual
  correction against primary sources — but hunting for such errors is not the goal.
- **Rewriting descriptions.** Only where a syntax string currently smuggles prose
  (`ENT n,…(up to 5 sections)`) does that prose move into `description`.

## Impact

- **Data**: `src/reference/placeholders.ts` (new); all nine
  `src/reference/<dialect>.ts` tables; the `syntax` doc comment in
  `src/reference/types.ts`.
- **Code**: `src/reference/compare.ts` (`syntaxShape`), and three fixtures in
  `compare.test.ts` re-pointed from bare-placeholder inputs to glossary-name variation
  — after which they assert the stronger invariant (naming inside `<…>` is not a
  difference; arity is).
- **Tests**: `src/reference/reference-data.test.ts` gains the conformance checks.
  `perMachineCompare.test.ts`, `portDescription.test.ts`, `keyword-crosscheck.test.ts`
  and `src/ai/portReport.test.ts` consume the tables and must stay green. No e2e spec
  asserts on syntax text.
- **Docs**: `docs/.vitepress/theme/components/ReferenceTable.vue` (generated legend);
  `docs/reference/index.md`; the nine dialect pages (one legend link each); five
  `hardware.md` pages; `porting-basics.md`; one line of `file-formats.md`.
- **Downstream benefit, no code change**: `portDescription.ts` and
  `machineDescription.ts` hand these strings to the AI porting assistant, which gets a
  uniform notation for free.
