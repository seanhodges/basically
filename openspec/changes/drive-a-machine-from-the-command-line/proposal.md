## Why

Split out of `use-the-toolchain-from-the-command-line`, which reshaped the headless
tool into `basically` and added the operations whose machinery already existed on
the machine seam. Driving a running machine did not exist outside the browser at
all, so it is proposed on its own rather than folded into that change or into
`test-a-program-from-the-command-line`, which needs everything built here before it
can propose an assertion on top of it.

Today the headless runner boots a machine, runs frames and reads the screen; it has
no way to type at the machine. That makes everything interactive unreachable
outside the browser: a game's title screen is as far as a headless run gets. The
browser already solves this — pressing keys, working the joystick, waiting for
text — for the assistant's own driving of a program, and the same one-action-per-
line vocabulary it uses there is the natural shape for a caller who wants to say
what a headless run should do.

## What Changes

- **`basically run` learns `--keys`**, a schedule of what to press and when, so a
  run can get past a prompt, start a game, and reach the screen that was the point
  of running it.
- **The drive vocabulary grows** two things a schedule needs that the assistant's
  own driving has never needed spelled out: a `PRESS` chord (`PRESS SHIFT+P`) and
  `WAIT END`, which runs until the program stops. Comments (`# …`) are allowed. It
  is read by the same parser the assistant already drives with, not a second one.
- **Key names become a machine-independent vocabulary.** A caller writes `SPACE`
  or `P`, and each machine resolves it to whatever its own keyboard calls it.
  Describing a machine lists the names it answers to, so a caller can find out
  what it may press without opening the IDE.

## Non-goals

- **Checking a program's behaviour against a written expectation.** That needs
  everything this change builds — the vocabulary, the key names, the hook into the
  run loop — plus an assertion form this change does not add. It is proposed on
  top of this one in `test-a-program-from-the-command-line`.
- **Replacing the browser as the place to play a program.** This is for scripts and
  agents driving behaviour, not for playing.
- **Recording input from a real session.** A schedule is written, not captured.
- **Typing text as words.** A schedule spells a word as `PRESS` lines; see the
  design's non-goals for why a `TYPE` action is not this change's to add.
- **Anything the earlier change already settled** — the tool's name, its grammar,
  its streams and its exit codes are inherited, not revisited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: gains what a run can be told to type, and a machine-independent
  vocabulary of key names every registered machine resolves.

## Impact

**Depends on** `use-the-toolchain-from-the-command-line` having landed: it assumes
the subcommand grammar, the pure-operation-plus-shim split, and the exit-code rule
a driven run that fails slots into.

**The run loop.** The headless runner needs a hook for acting on the machine
between frames. The pieces exist and were built for exactly this: the app's machine
control is already free of the DOM and offers pressing keys, waiting for text on
screen and advancing frames; the assistant's drive-script parser already reads a
`PRESS`/`WAIT`/`WAIT FOR` vocabulary. The work is wiring them to the headless path
and growing the vocabulary by what a written schedule needs, not writing them from
nothing.

**Every registered machine.** Key names have to resolve for all of them, from what
each declares about its keyboard — which is the part most likely to surface machines
that declare less than the rest, and so wants a registry-driven test from the start.

**No new dependency.** The schedule is the line-per-action script the parser
already reads, so nothing is added to the runtime bundle and there is no licence
to check.
