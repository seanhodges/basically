## Why

Every memory figure the product reports — the block linter's legal ranges, the
porting guide's free program RAM — describes the machine at boot, with every
optional feature assumed in use. Real machines are more forgiving, in a way
that depends entirely on what the program does:

- The Atom's video RAM holds six kilobytes because the highest graphics mode
  needs six kilobytes. A program that stays in text mode touches only the first
  kilobyte, and Atom programmers used the rest for data and machine code as a
  matter of course. The Atom is also the machine that can least afford to
  ignore this: its free program RAM is under five kilobytes.
- The BBC Micro's bitmap modes reach twenty kilobytes down into RAM, and the
  block linter warns about the whole band under the screen — a warning its own
  reasoning calls unavoidable only because the linter cannot know which mode
  the program selects. A program that stays in the teletext mode never touches
  that band.

Whether the region is free is not a fact about the machine; it is a fact about
the machine *and the program* — the first place the product can honestly use
what a program is supposed to do, because the program's own text proves it.
The screen mode a program selects is written in its `CLEAR` and `MODE`
statements, and the addresses it pokes are already collected.

## What Changes

- **Machines gain conditionally free memory regions**: a range, the condition
  under which the program leaves it untouched, and a note saying what the
  region otherwise does. The first machines are the Atom (video RAM above the
  text screen, free while the program stays in text mode) and the BBC Micro
  and Master (the band below the bitmap screens, free while the program stays
  in the teletext mode). Conditions are only ever ones the program's text can
  prove: the modes it selects with constant arguments, the addresses it
  writes. A computed mode argument, or a write into the region, defeats the
  condition — doubt runs toward not reclaiming, the same direction the fit
  report already runs it.
- **The block linter accepts blocks in a conditionally free region** when the
  open program meets the condition, downgrading today's error to a warning
  that names what the block is leaning on. Where the condition is unmet or
  undecidable, the error stands and now names the condition, so the reader
  learns what would make the placement legal.
- **The porting comparison reports conditionally free memory under fit
  pressure**: when the program is close to or over the target's budget and the
  program's own text meets a region's condition, the fit report says the
  memory is there, what frees it, and poses the decision — move data and
  machine code there, or shorten the program. A program comfortably inside the
  budget hears nothing; a program that fails the condition hears nothing.
- **The vocabulary grows by one field**: the screen modes the program selects
  with the machine's own mode command, and whether any selection is computed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement modified — *Whether the program fits the
  target machine is reported* — to admit target-side measures under fit
  pressure, conditionally free memory first among them.
- `memory-blocks`: one requirement added — *A block may sit in conditionally
  free memory*.

## Non-goals

- **Regions the text cannot prove free.** The Spectrum's space above RAMTOP,
  the VIC-20's expansion areas, and the C64's RAM under ROM stay as they are:
  whether a program uses user-defined graphics or banks ROM out is not
  decidable from its vocabulary, and a condition the engine cannot check is a
  condition this design refuses to author.
- **Moving the screen or changing modes for the user.** The condition describes
  the program as written; nothing advises rewriting the program to free the
  region — that would be advertising the target's additions, which the
  comparison deliberately never does.
- **Redrawing the memory-map pictures.** The maps draw the boot state, which
  remains true; a conditional region kind in the map UI is a possible
  follow-up, not part of this change.
- **Advice when there is no pressure.** Memory the target can free is a target
  addition; only fit pressure turns it into part of the answer to "does it
  fit", which is the only question that makes it the program's business.

## Impact

Affected code:

- `src/dialects/types.ts` — conditionally free ranges and the mode command on
  the memory-blocks support contract, optional, so the other machines are
  untouched.
- `src/dialects/atom/memoryBlocks.ts`, `src/dialects/bbcmicro/memoryBlocks.ts`,
  `src/dialects/bbcmaster/memoryBlocks.ts` + colocated tests — the declared
  regions, against the machines' own address constants.
- `src/app/blockLint.ts` + `blockLint.test.ts` — condition evaluation against
  the open program's vocabulary; the BBC's blanket screen-band warning is
  suppressed exactly when the condition proves the band untouched.
- `src/app/programVocabulary.ts` + its test — the screen-mode field.
- `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts` — the wider payload.
- `src/components/EmulatorPane.tsx` — the run gate hands the linter the
  vocabulary it already computes the program size with.
- `src/reference/types.ts`, `src/reference/facts.ts`,
  `src/reference/facts-crosscheck.test.ts` — the regions restated as reference
  data, pinned byte-for-byte to the dialect declarations.
- `src/reference/compare.ts`, `portDescription.ts` + tests — the condition
  evaluator and the fit-pressure finding with its `Decide:` line.
- `docs/.vitepress/theme/components/DialectCompare.vue` — the finding inside
  the existing fit report.
- `src/ai/portReport.ts` — the finding joins the hand-over, under the same
  gate.
- `e2e/memory-blocks/` — one browser assertion for the conditional placement.

Independent of the sibling proposals; it reuses the posed-decision convention
the number-model change introduces, and the abbreviations proposal reuses the
fit-pressure gate this change words into the fit requirement.

No dependency changes, no storage or share-format changes, and no tokenizer
changes. The block linter's behaviour changes only on machines that declare a
conditional region, and only in the direction of accepting more.
