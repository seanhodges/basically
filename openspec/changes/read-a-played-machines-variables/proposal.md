## Why

A machine being played advances on its own clock, so the toolchain refuses the
requests that would act on it or measure it and answers the ones that only read
it. Reading the screen is answered; reading the variables is not. But a variable
read spends none of the machine's frames and changes nothing about it — it is a
read of a moving machine in exactly the way the screen is, and the reason given
for refusing it ("the answer would be about a moment already gone") is true of
the screen too, which is answered anyway and says so.

The consequence is that nothing embedding the toolchain can watch a program's
variables while a person is driving it. The IDE watches them the whole time a
program runs, because in the browser it reads the emulator directly and never
asks an operation; an editor, an agent or the command line cannot, and the only
way to see a variable is to stop playing.

## What Changes

- **Reading a played machine's variables is answered rather than refused.**
  `variables` joins the screen reads on the answered side of the line the
  measure/read distinction already draws, and carries the same understanding:
  it has caught a machine that is moving, so two reads may differ and that is
  not a fault.
- **What a caller is told when something *is* refused names the variables among
  what it can still read**, so a caller refused a measurement is told the whole
  truth about what remains available to it.
- Profiling and timing stay refused. They account for a run in frames whoever is
  playing is spending, which is what makes them measurements rather than reads.
- No operation is added, removed or renamed, and nothing changes for a machine
  that is not being played. **Not breaking.**

## Non-goals

- **Writing a variable.** Nothing here makes a variable settable, on a played
  machine or any other. The seam reserves `editable`/`ref` for that and neither
  is implemented.
- **Making the refused operations work while playing.** `profile`, `time`,
  `drive`, and the stepping operations are refused for reasons this does not
  touch.
- **A machine that cannot report its variables.** It still says so, on the terms
  it already says it. This changes when the question may be asked, not which
  machines can answer it.
- **Watching an expression.** The toolchain reports the program's variables and
  has no way to evaluate anything; that is unchanged.
- **The IDE.** It reads the emulator directly and is not a caller of this
  operation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `machine-play`: the requirement governing what a played machine costs the
  requests about it gains the variables on the answered side, alongside the
  screen.

`headless-cli` is deliberately absent. Its rule is already that a command which
only reads the machine spends none of its time, which this satisfies rather than
changes; `basically variables` on a played held machine simply stops being
refused. `program-execution` is absent for the same reason — it governs what the
IDE surfaces from an emulator it holds directly, not what an operation answers.

## Impact

- **`src/ops/measure.ts`** — `variablesOp` declares `answer` where it declared
  `refuse`, and says why.
- **`src/ops/play.ts`** — the sentence naming what is still answered while a
  machine is played names the variables too.
- **`src/ops/play.test.ts`** — `variables` moves out of the refused set and into
  the read set, where the "two reads may differ" assertion covers it.
- **The docs** describing what a played machine still answers.
- **Every surface at once**, because an operation is declared once: the command
  line, the assistant and MCP all gain the same answer, and an editor embedding
  the operations conversation gains it without asking for anything new.
