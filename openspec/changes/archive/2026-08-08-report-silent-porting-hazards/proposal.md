## Why

Every finding the porting guide reports today answers one question: *what will
not tokenize on the target*. The ports that actually hurt are the ones that
tokenize cleanly and then compute the wrong answer. The guide has one bucket for
those — the same-name-different-meaning warnings, five of them — and three larger
classes it could compute and does not:

- **Variable names that collide.** Five machines keep only the first two
  characters of a name (Altair, PET, VIC-20, C64, TRS-80) and two keep only one
  (ZX80, Atom, and the Sinclair machines for strings and arrays). Seven machines
  allow longer names. That is 35 ordered pairs on which `COUNT` and `COLOUR`
  silently become one variable, before the single-letter targets are counted, and
  the guide says nothing about any of them.
- **Targets that truncate every division.** The ZX80 is 16-bit integer and the
  Atom 32-bit integer; both truncate `/`. `numberHandling` says so in prose, and
  nothing asks whether the program divides.
- **A display model that changes under the same commands.** Attribute clash on
  the Spectrum, per-cell colour on the VIC-20, mode-dependent colour on the BBC
  and CPC: a graphics routine ports without a single keyword change and looks
  wrong.

The first two are computable from what the guide already receives about the open
program, once two prose facts are given a structured form. The third is prose
guidance, and belongs with the machine it describes.

## What Changes

- **`PortingFacts` gains structured variable-name significance and number
  handling** beside the prose it already carries: how many characters of a name
  are significant (separately for names the machine restricts further, such as
  the Sinclair machines' single-letter strings and arrays), whether a type suffix
  is part of the name, whether the machine has fractions, and the range an
  integer-only machine holds. The prose stays — it is what the fact rows show.
- **The comparison reports variable names that collide on the target.** Not a
  warning that names *may* collide: the actual pairs from the open program, named
  — "`COUNT` and `COLOUR` both become `CO`".
- **The comparison reports fractional arithmetic into an integer-only target.**
  Where the program divides or carries a fractional literal and the target has no
  fractions, it reports that every such calculation needs rescaling, naming the
  range the target holds.
- **The guidance says how colour attaches to the display**, where the target
  attaches it differently from the source — per pixel, per character cell, or by
  screen mode — because that is a difference no command list can carry.
- **The vocabulary the guide receives grows** to carry the program's variable
  names and whether it uses fractional arithmetic, collected the way the keywords
  already are: never from inside string literals, comments or `#BIN` payloads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: two requirements added — *Variable names that collide on
  the target are reported* and *How colour attaches to the display is reported in
  the guidance* — and one modified, *The language differences report how the
  machine handles numbers*, to narrow it to the program where there is one.

## Non-goals

- **Reproducing the editor's variable lint.** The editor already flags a
  collision on the machine the program is *written for*; this reports collisions
  the program does not have yet and would acquire on the machine it is going
  **to**. Different question, different machine, and neither replaces the other.
- **Renaming anything.** The guide reports; the assistant converts.
- **Type inference or expression evaluation.** "Does this program divide" is
  answered from the program's text, like everything else the vocabulary reports.
  A division that only ever divides exactly is still reported: proving otherwise
  needs to run the program.
- **A display-model diff.** How colour attaches is prose guidance authored per
  machine, not a computed finding; the fact rows already report each machine's
  colour capability side by side.
- **The line-number range.** The third comparable prose fact is carried by the
  change that reports line-number overflow.

## Impact

Affected code:

- `src/reference/types.ts`, `src/reference/facts.ts` — the two structured fields,
  authored per machine beside the prose.
- `src/reference/facts-crosscheck.test.ts` — the structured significance against
  the prose, and against each dialect's own variable lint: a probe program built
  from the authored rule must be flagged, or not flagged, exactly as the rule
  predicts.
- `src/reference/compare.ts` + `compare.test.ts` — the collision finding and the
  truncation finding, pure, over the facts and the vocabulary.
- `src/app/programVocabulary.ts` + its test — variable names (via the editor's
  existing dialect-aware variable walk) and fractional arithmetic.
- `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts` — the wider payload.
- `docs/.vitepress/theme/components/DialectCompare.vue` — the two findings.
- `src/reference/facts.ts` porting notes and `src/reference/porting.ts` pair
  notes — the display-model guidance, within the existing brevity cap that
  `porting-crosscheck.test.ts` enforces.
- `src/ai/portReport.ts` — both findings join what the assistant is handed.
- `e2e/porting-guidance/` — one browser assertion for the collision finding.

Depends on nothing else in flight; the line-number change touches the same two
files (`facts.ts`, `programVocabulary.ts`) in different places.

No dependency changes, no storage or share-format changes, and no change to any
tokenizer or linter's behaviour.
