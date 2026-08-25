## Why

Real Apple I Integer BASIC listings carry lines with no line number - most often
a preamble that sizes the workspace before the program (`SCR`, `LOMEM=768`,
`HIMEM=4096`), and often a bare `RUN` at the end. The IDE reports every such
line as a missing line number, and because that error is fatal the whole
listing refuses to build. A user cannot paste, edit or run an authentic Apple I
program, and cannot ask for a workspace larger than the stock 2048 bytes even
though the machine and the image format both support it.

## What Changes

- The Apple I toolchain accepts an unnumbered source line that holds one of the
  machine's direct-mode commands (`AUTO`, `CLR`, `DEL`, `HIMEM=`, `LIST`,
  `LOMEM=`, `OFF`, `RUN`, `SCR`), anywhere in the program. Any other unnumbered
  line still reports a missing line number, and all nine stay refused *inside* a
  numbered line, exactly as the interpreter refuses them.
- `LOMEM=` and `HIMEM=` are honoured: they set the workspace the program is
  built into and loaded with, so a program that asks for a larger workspace gets
  one and its RAM budget is measured against it. Out-of-range or inverted bounds
  are reported at their line and column.
- The remaining commands are accepted and preserved but change nothing about the
  built program, and nothing is reported against them. Reporting each would be
  worse than silence: the run gate refuses a program with any error against it,
  fatal or not, so a listing would stop being runnable because it ends the way
  listings end. The language reference says what each one does instead.
- A cassette export records the declared workspace with the program, importing
  one restates it, and the monitor range the Transfer dialog tells the user to
  type follows the program's own bounds - a fixed range there does not merely
  read vaguely, it loads the wrong bytes.
- Line-number management (renumbering, automatic numbering while typing) leaves
  these lines alone instead of forcing a number onto them.
- An AI merge preserves them in place instead of dropping them - today a partial
  merge would silently delete a user's preamble.
- The Apple I's cassette instructions and language reference describe what an
  unnumbered line does on this machine.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialect-toolchain`: tokenization currently guarantees only numbered program
  lines. It gains a requirement that a dialect may accept lines its machine
  takes without a line number, that such lines are reported when malformed
  rather than dropped, and that a workspace those lines declare is carried into
  the loadable image and the program's size budget.
- `code-editor`: "Line-number management" gains a requirement that renumbering
  and automatic numbering leave a dialect's unnumbered lines untouched and in
  place.
- `ai-assistant`: the merge requirement gains a guarantee that a partial reply
  cannot remove or duplicate a line the program holds without a line number.
- `memory-blocks`: the run gate judges blocks against the workspace the open
  program asks for, so a block its own workspace would cover is refused.

## Non-goals

- No other dialect changes behaviour. Every registered machine that requires a
  line number keeps reporting a missing one, including for these same words.
- The nine commands are not made executable inside a numbered line.
- No change to the `MachineEmulator` seam: the Apple I machine already reads the
  workspace bounds out of the image it is given.
- Breakpoints, the program outline, profiling heat and the POKE/address scan are
  not extended to unnumbered lines; they are keyed by line number and continue
  to skip them.
- `Dialect.programRamBytes` stays the machine's static figure, so the RAM gauge
  reads a program against the stock workspace until it runs, at which point the
  machine's own arithmetic takes over.

## Impact

- `src/dialects/apple1/`: `tokenizer.ts` (accepts and interprets the lines,
  returns the declared workspace), `index.ts` and `audio/aciEncoder.ts` (carry
  the workspace into the image), `keywords.ts` (the shared command table),
  `samples/hello.bas`, and the colocated tests.
- `src/dialects/types.ts`: one new optional `Dialect` member so a dialect can
  say a physical line is a legal unnumbered line, absent on every other machine;
  `MemoryBlocksSupport.programArea` takes the program text optionally; and
  `audio.loadInstructions` may be a function of it.
- `src/app/blockLint.ts`, `src/components/EmulatorPane.tsx` and
  `src/components/TransferDialog.tsx`: pass the open program through.
- `src/editor/lineNumbering.ts` and `src/components/CodeMirrorHost.tsx`: the
  renumber and auto-number paths consult it, alongside the existing `#BIN`
  directive guard.
- `src/ai/codeExtractor.ts` and `src/ai/aiProfileComposer.ts`: merge
  preservation and the Apple I's line-number wording. The shared
  `RETURNING_CODE_RULES` prompt text is deliberately untouched, so the prompt
  cache prefix is unchanged.
- `docs/reference/apple1.md` and `src/reference/apple1.ts`.
