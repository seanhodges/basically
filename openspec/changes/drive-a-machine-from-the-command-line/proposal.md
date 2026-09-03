## Why

Split out of `use-the-toolchain-from-the-command-line`, which reshaped the headless
tool into `basically` and added the operations whose machinery already existed on
the machine seam. Two requested operations did not: pressing keys at a running
machine, and checking a program's behaviour against a written expectation. Both
need the same thing first — a way to feed input to a machine while it runs — so
they are proposed together rather than as one operation that has to invent it and
another that inherits it.

Today the headless runner boots a machine, runs frames and reads the screen; it has
no way to type at the machine. That makes everything interactive unreachable
outside the browser: a game's title screen is as far as a headless run gets, and
nothing can assert what a program does in response to a keypress.

## What Changes

- **`basically run` learns `--keys`**, a schedule of what to press and when, so a
  run can get past a prompt, start a game, and reach the screen that was the point
  of running it.
- **`basically test <file> --spec <file>`** runs a program against a written
  expectation — what to press, how long to wait, what the screen must then show —
  and passes or fails, reporting which expectation failed and what the screen
  actually held.
- **A spec file format and its assertion vocabulary.** A spec is the same
  one-action-per-line script the assistant already drives with, grown with
  expectations about the screen and about whether the program is still running —
  so `--keys`, a spec file and the assistant share one vocabulary, and no new
  dependency is needed to read any of them.
- **Key names become a machine-independent vocabulary.** A caller writes `SPACE`
  or `P`, and each machine resolves it to whatever its own keyboard calls it.
  Describing a machine lists the names it answers to, so a caller can find out
  what it may press without opening the IDE.

## Non-goals

- **Replacing the browser as the place to play a program.** This is for scripts and
  agents checking behaviour, not for playing.
- **Recording input from a real session.** A schedule is written, not captured.
- **Anything the earlier change already settled** — the tool's name, its grammar,
  its streams and its exit codes are inherited, not revisited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: gains what a run can be told to type, and the guarantee that a
  program's behaviour can be asserted against a written expectation and reported as
  a pass or a failure.

## Impact

**Depends on** `use-the-toolchain-from-the-command-line` having landed: it assumes
the subcommand grammar, the pure-operation-plus-shim split, and the exit-code rule
that a failed expectation slots into.

**The run loop.** The headless runner needs a hook for acting on the machine
between frames. The pieces exist and were built for exactly this: the app's machine
control is already free of the DOM and offers pressing keys, waiting for text on
screen and advancing frames; the assistant's drive-script parser already reads a
`PRESS`/`WAIT`/`WAIT FOR` vocabulary. The work is wiring them to the headless path,
not writing them.

**Every registered machine.** Key names have to resolve for all of them, from what
each declares about its keyboard — which is the part most likely to surface machines
that declare less than the rest, and so wants a registry-driven test from the start.

**No new dependency.** The spec format is a line-per-action script read by the
parser the assistant already has, so nothing is added to the runtime bundle and
there is no licence to check.
