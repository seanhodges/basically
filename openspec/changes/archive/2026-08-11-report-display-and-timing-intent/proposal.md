## Why

Four ways a program encodes its *behaviour* — where things appear, how fast
things happen, what colour and sound are for, how keys are read — port
cleanly as text and wrongly as a program, and the guide addresses none of
them with the program in hand:

- **Positions are literals aimed at a geometry.** The screens run from 22
  columns to 80. A layout printed at column 35 of a 40-column machine has
  nowhere to be on a 32-column one, and a position given as a single offset
  encodes the width itself — the same number is a different place on a
  different screen. The screen sizes are today one prose string, never
  parsed, and the program's position arguments are collected nowhere.
- **Delay loops are the source machine's speed, written down.** An empty
  count-to-N loop is N of *that* interpreter's iterations; ported verbatim, a
  playable game becomes unplayable in either direction. The product runs
  every machine and could measure this; today no notion of machine speed
  exists anywhere in the comparison.
- **Colour and sound may carry meaning.** The per-target advice for a
  colourless or silent machine is written ("use inverse video", "drop the
  effect or print a message") but nothing asks the question that decides
  between its halves: was the colour decoration, or was it how the player
  told things apart? That is the guide's own decision shape — a fact it
  cannot compute, posed instead of guessed.
- **One keyword, two input models.** A key-read that waits and a key-read
  that samples are opposite program structures under one spelling. The
  same-word warnings cover one spelling on three machines; the timed variant
  that blocks, and the file-reading meaning on another machine, are absent —
  known gaps in authored data, not new machinery.

## What Changes

- **Screen geometry becomes a structured fact** — columns and rows of the
  text screen the machine boots into — beside the prose it is parsed from
  today.
- **The comparison checks the program's positions against the target's
  screen**: literal position arguments and position control codes beyond the
  target's columns or rows are named, single-offset positions are flagged as
  encoding the source's width with the recomputation posed, and the decision
  — reflow the layout or clip — is posed once. Nothing is reported where
  every position fits.
- **Machines gain a measured speed**, benchmarked in the product's own
  emulators by a registry-driven test, and the comparison reports loops that
  only pass time: where the program has empty counting loops and the machines'
  measured speeds differ materially, it says the delays were tuned to the
  source's speed, quotes the measured ratio as the emulators' own, and poses
  the decision — retune the counts, or move the delays onto the target's own
  clock, named per machine.
- **Colour and sound used by the program pose the decoration-or-information
  decision** when the target lacks the capability, riding the existing lost-
  capability accounts that already carry the per-target means.
- **The input-model warnings are completed** with the authored rows the gaps
  name: the file-reading meaning of the key-read word, and the timed key-read
  that blocks on one machine and cannot on another.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: three requirements added — *The program's positions are
  checked against the target's screen*, *Loops that only pass time are
  reported with the machines' measured speeds*, and *Colour and sound the
  program leans on are posed as decisions* — plus authored data completing
  the same-word-different-meaning coverage of the key-read commands.

## Non-goals

- **Reflowing anything.** The comparison names the positions and poses the
  choice; layout is the port's work.
- **Real-hardware speed claims.** The ratio is measured in this product's
  emulators and always said to be; where an emulator is not cycle-faithful
  the honest number is still the one the user's ported program will actually
  exhibit here.
- **Detecting *timed* loops that do work.** A loop with a body is a loop; only
  empty counting loops are called delays. Tuning a game's full main loop is
  beyond any text reading.
- **Graphics-coordinate scaling.** Pixel coordinate spaces differ too, but
  drawing commands differ so much that the missing-command and usage findings
  already own that ground; this change is about the text screen every machine
  shares.
- **A blocking/polling model of input commands.** The two authored rows close
  the known gaps; modelling wait-semantics as structured data is not earned
  by two rows.

## Impact

Affected code:

- `src/reference/types.ts`, `src/reference/facts.ts`,
  `src/reference/facts-crosscheck.test.ts` — structured text-screen geometry
  (pinned to the prose it restates), measured speed (pinned within tolerance
  by an emulator benchmark), and each machine's own clock idiom for delays.
- A registry-driven benchmark test that boots every machine, runs the same
  counting loop, and measures frames — the pattern the RAM-budget checks
  already use.
- `src/app/programVocabulary.ts` + its test — literal position arguments
  (including position control-code operands, today discarded) and empty
  counting loops.
- `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts` — the wider payload.
- `src/reference/compare.ts`, `portDescription.ts` + tests — the positions
  finding, the delays finding, and the colour/sound decisions on the existing
  capability accounts.
- `src/reference/porting.ts` + crosschecks — the two authored input rows.
- `docs/.vitepress/theme/components/DialectCompare.vue` — the findings.
- `src/ai/portReport.ts` — all three join the hand-over.
- `e2e/porting-guidance/` — one browser assertion, extending an existing
  journey.

Reuses the posed-decision convention from the number-model proposal;
independent of the other siblings in code.

No dependency changes, no storage or share-format changes, no tokenizer
changes, and the machine reference the assistant's system prompt carries is
unchanged.
