## Context

`drive-a-machine-from-the-command-line` lands the whole join between the
headless runner and a running machine: the runner's `drive` hook, the
`src/app/driveScript.ts` parser (`PRESS`, `JOY`, `WAIT`, `WAIT FOR`, `WAIT END`,
comments), and `src/keyboard/keyNames.ts` resolving a machine-independent key
name for every registered machine. `run --keys` is that change's caller of all
three.

What that change does not build is a way to say what the screen ought to hold.
This change adds exactly that — four more line shapes the same parser reads —
and one new operation, `test`, that runs a program under a schedule of actions
and expectations and reports a verdict rather than a screen.

See `docs/contributing/architecture.md` for the seam and the headless toolchain,
and this change's dependency's own design document for the driver, the hook and
the key-name resolver; this document only covers what is new here.

## Goals / Non-Goals

**Goals:**

- A `test` operation whose verdict is trustworthy: a failure names the
  expectation that failed, by its line, and shows the screen as it stood.
- One vocabulary: a spec file is the schedule `run --keys` already reads, with
  expectations mixed in, so nothing already proposed is duplicated or
  reinterpreted.
- No new runtime dependency, and nothing added to the machine seam.

**Non-Goals:**

- **Several scenarios in one spec file.** A spec is one linear script; a program
  with three things to check has three files. The command line is a loop away
  from running them all.
- **Pictures from `test`.** A test's product is its verdict; a caller who wants
  the picture at a moment runs the same schedule under `run --keys --screenshot`.
- **Anything `drive-a-machine-from-the-command-line` already settled** — the
  action lines, their timings, the key-name vocabulary, and the runner's hook are
  used as they stand.

## Decisions

### Impact on the Dialect / MachineEmulator seam

None. `test` reads exactly the members `run --keys` already reads —
`readScreenText` and `isProgramRunning` through the driver `programState`
already exposes — and adds no member of its own.

### The drive vocabulary gains an assertion form

Four line shapes join the parser `drive-a-machine-from-the-command-line` moved to
`src/app/driveScript.ts`:

| Line                  | Meaning                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `EXPECT "<text>"`     | Fails unless the text is on screen now — matched a row at a time, spaces collapsed, as `WAIT FOR` is. |
| `EXPECT NOT "<text>"` | Fails if the text is on screen now.                                                           |
| `EXPECT STOPPED`      | Fails unless the program has stopped.                                                        |
| `EXPECT RUNNING`      | Fails unless the program is still running.                                                   |

An expectation is a step that costs no frames and fails the script the way a
timed-out wait does, so `runDriveScript`'s one rule — stop at the first failure,
because everything after it was written for a screen that never arrived — covers
it without a second loop or a second report shape. `EXPECT STOPPED` and
`EXPECT RUNNING` read `programState()`, which the dependency change already adds
to `MachineControl` for `WAIT END`.

*Alternative rejected: a structured spec file (YAML or JSON) with the steps and
expectations as data.* The structure it would carry — which program, which
machine — is already on the command line, so it would buy a second parser, a
second vocabulary for the assistant to be taught, and for YAML a dependency, in
exchange for nothing a `#` comment does not give.

### `test` stays pure, and the shim stays a shim

`src/cli/test.ts` reuses `parseSchedule` and `driveHook` from
`src/cli/drive.ts` unchanged: `testListing({ machine, source, spec, romRoot })`
refuses a ROM-less machine with `RunError` before booting, runs the program
through `runListing` with the spec's actions as the drive hook, and returns a
`TestOutcome` built from the captured `DriveReport` — `ok`, every step with its
description and outcome, the failing step's line and detail when there is one,
and the screen lines as they stood when the script ended. `formatTestOutcome`
renders it as a readable report. Neither function reads a file or touches
`process`; the shim reads the spec file, prints the report and sets the exit
code, as it does for every other operation.

A failing expectation is the program's failure, not the caller's — the program
did not do what the spec said it would — so `test` exits 2 on it, distinct from
an unreadable spec file or a spec line the parser cannot read, both of which are
the caller's mistake and exit 1 before any machine boots.

### Testing needs the ROM, and says so before starting

A verdict from a machine that ran nothing would say nothing about the program, so
`test` refuses a machine whose ROM is absent as the caller's mistake, exit 1,
before any action is taken — the same `hasRom` `run --keys` already refuses
against.

## Risks / Trade-offs

**Growing the parser again changes what the assistant's `drive` tool accepts** →
Only by addition, as the first growth was: every script that parsed before
parses the same, and the tool's description does not mention `EXPECT`. A model
that writes one gets a check rather than a "could not understand", which is the
better of the two outcomes. `src/app/driveScript.test.ts` pins the vocabulary
this change extends, alongside its own new cases.

**A spec file mixing actions and expectations can be misread as an assertion
language distinct from what `run --keys` takes** → It is exactly the same
parser and the same file shape; a `--keys` schedule that happens to contain an
`EXPECT` line is not an error, it is a schedule with a check in it. Nothing
about `run --keys` refuses an `EXPECT` line — it simply also fails the run if the
expectation does not hold, which is the same everything-else-in-the-schedule
behaviour.
