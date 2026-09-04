## Why

Split out of `drive-a-machine-from-the-command-line`, which builds everything a
caller needs to feed input to a running machine outside the browser: a
machine-independent vocabulary of key names, a hook into the headless run loop,
and a script parser shared with the assistant's own driving. That change lets a
run get past a prompt and reach a screen; it does not let anything be asserted
about what that screen holds. This change proposes the assertion on top of it,
once driving exists to assert against.

Today there is no way to check a program's behaviour outside eyeballing its
screen — by hand in the browser, or by reading a headless run's text output and
deciding for yourself whether it looks right. Neither scales to a program with
more than one thing worth checking, and neither gives a script or an agent a
pass/fail it can act on.

## What Changes

- **`basically test <file> --spec <file>`** runs a program against a written
  expectation and passes or fails, reporting which expectation failed and what
  the screen actually held.
- **The drive vocabulary gains an assertion form**: `EXPECT "<text>"`,
  `EXPECT NOT "<text>"`, `EXPECT STOPPED` and `EXPECT RUNNING`, alongside the
  actions `drive-a-machine-from-the-command-line` already added. A spec file is
  that same schedule, with expectations mixed in — not a second format.

## Non-goals

- **Converting between two machines' dialects, or translating a program.**
  Nothing here changes what a program does; it only checks what it does.
- **Several scenarios in one spec file.** A spec is one linear script; a program
  with three things to check has three files.
- **A picture of the screen from `test`.** A test's product is its verdict; a
  caller who wants the picture at a moment runs the same schedule under
  `run --keys --screenshot`.
- **Anything the earlier changes already settled** — the tool's name and grammar,
  the drive vocabulary's actions and their timings, the key-name vocabulary, and
  the run hook are inherited, not revisited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: gains the guarantee that a program's behaviour can be asserted
  against a written expectation and reported as a pass or a failure.

## Impact

**Depends on** `drive-a-machine-from-the-command-line` having landed: the
key-name vocabulary, the runner's drive hook, and the schedule parser it moves
out of the assistant are exactly what a spec file's actions need, and this
change adds nothing to any of them beyond the assertion lines.

**No new dependency.** A spec file is read by the same parser, grown by four more
line shapes; nothing is added to the runtime bundle and there is no licence to
check.
