## Context

The command line already runs a program and reads its screen, and the browser
already drives a running machine. What is missing is the join between them.

Three pieces exist, and none of them was written for the other two:

- **The headless runner** (`src/dialects/headless/runListing.ts`) boots a machine,
  loads the program, runs frames until the program ends or a predicate holds, and
  reads the screen. It has no way to act on the machine between frames; the
  `until` predicate can only look.
- **The machine driver** (`createMachineControl` in `src/app/machineControl.ts`)
  presses keys, works the joystick, advances frames and waits for text on screen.
  It takes a machine and its keyboard layout rather than reaching for them, and
  `src/app/machineControl.test.ts` proves its timings against the real ZX81 ROM
  with nothing but `machine.runFrame()` as its clock — which is exactly the
  clock the headless runner has.
- **The drive-script vocabulary** (`parseDriveScript` and `runDriveScript` in
  `src/ai/driveTools.ts`) reads `PRESS`, `JOY`, `WAIT` and `WAIT FOR` one action
  per line, never throws, and runs a script against the driver, stopping at the
  first action that fails. It lives in the assistant's module because the
  assistant is its only caller; nothing in it is about the assistant.

The one genuinely new thing is key names. `MachineEmulator.setKey` takes an opaque
machine-defined token, and `driveKeyNames` in `src/ai/machineObservability.ts`
already says why no list of them can be written by hand: one machine's `KeyA` is
another's bare `A`, and two machines use raw matrix positions. The assistant is
told each machine's own names in its system prompt. A caller on the command line
is not reading a prompt, and a schedule written for one machine should press the
same letter on the next.

`docs/contributing/architecture.md` describes the seam, the headless toolchain and
the driver; this document only says where the new parts go and why.

## Goals / Non-Goals

**Goals:**

- One vocabulary of actions, shared by `run --keys`, by a spec file and by the
  assistant — so a script that works in one place works in the others, and there
  is one parser and one runner to test.
- Key names a caller can write without knowing the machine, resolved from what
  each machine's keyboard layout already declares, with a registry-driven test
  holding every machine to it.
- A `test` operation whose verdict is trustworthy: a failure names the expectation
  that failed, by its line, and shows the screen as it stood.
- No new runtime dependency, and nothing added to the machine seam.

**Non-Goals:**

- **Typing text.** `TYPE "FRED"` looks like one action but is not: a character on
  a shifted legend needs its modifier, a Sinclair machine in keyword mode turns a
  letter into a keyword, and a program reading `INKEY$` sees a burst of presses
  differently from one reading `INPUT`. A schedule spells a word as `PRESS` lines,
  which is honest about what the machine receives. A resolver that turns a
  character into a chord is a separate change, once there is a schedule that
  needs it.
- **Several scenarios in one spec file.** A spec is one linear script; a program
  with three things to check has three files. The command line is a loop away
  from running them all.
- **Pictures from `test`.** A test's product is its verdict; a caller who wants
  the picture at a moment runs the same schedule under `run --keys --screenshot`.
- **Recording a session, or anything the assistant's driving does on its side of
  the join.** The assistant's tool description does not change and no
  `ai-assistant` spec delta is written.

## Decisions

### Impact on the Dialect / MachineEmulator seam

None. Every member driving touches already exists and already has a caller in
the browser: `setKey`, `releaseAllKeys`, the optional `setJoystick`,
`readScreenText`, `isProgramRunning`, and the dialect's `keyboardLayout` and
`joystickModes`. No member is added, widened or reinterpreted, and no
machine-specific code is written. If a machine turns out to declare too little
in its layout for a key to resolve, the answer is to fix that layout — the same
data the on-screen keyboard is drawn from — never to special-case the machine in
the command line.

### The drive vocabulary moves out of the assistant and grows

`parseDriveScript`, `runDriveScript`, `DriveAction` and `DriveReport` move from
`src/ai/driveTools.ts` to their own module beside the driver, `src/app/driveScript.ts`;
`driveTools.ts` imports them from there. This is a move, not a rewrite: the
assistant's tool definitions, its wording and its behaviour are untouched, and its
existing tests move with the code.

The vocabulary grows by what a written script needs that a model improvising one
did not:

| Line                          | Meaning                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `# …`                         | A comment, ignored. A spec file that cannot say why it presses what it presses is not a spec.         |
| `PRESS <key>[+<key>…] [n]`    | Press the named keys together; `+` joins a chord, so a shifted legend is `PRESS SHIFT+P`.             |
| `WAIT FOR "<text>" [n]`       | As today, with an optional cap in frames where the default is not enough for a slow machine.           |
| `WAIT END [n]`                | Run until the program stops, or fail after `n` frames. The moment a program that finishes reaches.    |
| `EXPECT "<text>"`             | Fails unless the text is on screen now — matched a row at a time, spaces collapsed, as `WAIT FOR` is. |
| `EXPECT NOT "<text>"`         | Fails if the text is on screen now.                                                                    |
| `EXPECT STOPPED` / `RUNNING`  | Fails unless the program has stopped / is still running.                                               |

An expectation is a step that costs no frames and fails like a wait that timed
out, so the runner's one rule — stop at the first failure, because everything
after it was written for a screen that never arrived — covers it without a second
loop. The driver gains the two members these need, `programState()` reading
`isProgramRunning` and `waitForEnd(maxFrames)`, proved on the ZX81 ROM beside the
others.

*Alternative rejected: a structured spec file (YAML or JSON) with the steps as
data.* The structure it would carry — which program, which machine — is already
on the command line, so it would buy a second parser, a second vocabulary for the
assistant to be taught, and for YAML a dependency, in exchange for nothing a `#`
comment does not give.

*Alternative rejected: leave the parser in `src/ai/` and import it from the
command line.* It works, but it drags the assistant's profile and timing
formatters — and their imports — into the headless bundle, and it makes the
command line's grammar a fact about the AI module.

### Key names resolve from the layout, in one place, for every caller

A new `src/keyboard/keyNames.ts` resolves a written name to the tokens a machine's
layout says press it:

1. **The machine's own key id**, exactly as today, so everything the assistant is
   told still works.
2. **A letter or digit**, matched case-insensitively against a key id with its
   `Key`/`Digit` prefix stripped, or against the base-layer legend of a key.
3. **A named key** — `SPACE`, `ENTER`, `SHIFT`, `DELETE`, `ESCAPE`, `BREAK`,
   `STOP`, `CTRL`, `TAB`, the function keys `F0`–`F9`, and the cursor keys
   `UP`/`DOWN`/`LEFT`/`RIGHT` — matched against ids and base legends the same
   way, with a small alias table for the keys machines genuinely name differently
   (`ENTER`/`RETURN`/`NEWLINE`, `DELETE`/`BACKSPACE`/`RUBOUT`, `ESCAPE`/`ESC`).
   A cursor key resolves to the layout's CURSOR legend where it has one, which is
   what `src/dialects/cursorKeys.test.ts` already proves presses the right cell.

The driver's `pressKeys` resolves through this rather than through the raw id
index, so the assistant and the command line press keys the same way, and
`driveKeyNames` stays what it is — the ids, for the prompt. A name that resolves to
nothing is refused naming the machine and the name, never silently mapped to a
neighbour.

The vocabulary is a fact about every registered machine, so it gets one
registry-driven test, `src/dialects/keyNames.test.ts`: every machine resolves the
letters, the digits, `SPACE`, `ENTER` and `SHIFT` to non-empty tokens, naming the
offending machine and name in the assertion. A machine whose keyboard truly lacks
one of these — the test is what will say — is excused by name against its
declared facts, as `caseKeys.test.ts` does, rather than given a key it does not
have.

Describing a machine gains a `keys` field: the names it answers to, machine-
independent first and its own ids after, so a caller finds out what it may press
from `basically info` rather than by trial.

*Alternative rejected: rename every layout's key ids to one convention.* It
touches every machine's keyboard for a naming preference, and two machines' ids
are matrix positions that have no natural name to be renamed to.

### The runner gains one hook, and the schedule is the run

`RunOptions` gains `drive?: (machine: MachineEmulator, step: () => void) => void`,
called once after the program is loaded and its boot microtask has landed, before
the runner's own loop. `step` is the runner's own frame advance, so the frames a
schedule spends are counted and reported as `driveFrames` beside the run's own.
The runner does not know what a schedule is; it hands over the machine and a
clock, which keeps `src/dialects/headless/` free of `src/app/` and keeps the
runner's promise of touching nothing but ROMs.

When a schedule is given, the run ends when the schedule ends: its `WAIT`,
`WAIT FOR` and `WAIT END` lines already say how long to let the program run, and
the screen a caller wants is the one the last action left. `--frames n` runs `n`
more frames after it, for the game that needs a moment to draw after the key.
`--max-frames` has no meaning alongside a schedule — a schedule that wants to see
the program end says `WAIT END` — so giving both is the caller's mistake.

*Alternative rejected: run the schedule and then continue as an undriven run
would, waiting for the program to end.* A game never ends, so every driven run of
one would pay the whole cap after its last action — several seconds of a C64's
time — and read the screen at an arbitrary later moment rather than the one the
schedule reached.

### The command line's two new pieces stay pure, and the shim stays a shim

`src/cli/drive.ts` turns the text of a `--keys` option or a spec file into actions
— splitting inline text on newlines and on semicolons outside quotes, then
handing it to the shared parser — and throws `RunError` for a line it cannot
read, naming the line, so a malformed schedule is exit 1 before any machine
boots. `src/cli/test.ts` runs a program under a spec and returns a `TestOutcome`:
every step and how it went, the failing step's line and detail if there was one,
and the screen as it stood then. Neither reads a file or touches `process`; the
shim reads the spec file, prints the report and sets the exit code, as it does
for every other operation.

A schedule that fails part-way is the program's failure, not the caller's — the
program did not reach where the schedule expected — so `run --keys` and `test`
both exit 2 on it, with the screen still reported on standard output so the
caller sees what it got instead. Under `--json`, `run` reports the schedule's
steps beside the fields it already has.

### Driving needs the ROM, and says so before starting

An undriven run on a machine whose ROM is absent draws its missing-image notice
and reports that as a condition of the run, which is useful: the caller learns
the machine boots. A driven run has nothing to drive, and a test verdict from a
machine that ran nothing would be a lie in either direction. So `run --keys` and
`test` refuse a ROM-less machine as the caller's mistake, exit 1, before any step
is taken, using the same `hasRom` the machine listing reports.

## Risks / Trade-offs

**The driver's frame loop is synchronous, where the runner yields every twenty
frames for ROM loads that settle on timers** → Every ROM is loaded before
`bootMachine` resolves, and the driver test already runs hundreds of synchronous
frames on a real ROM after load; the yield exists for machines that start loads in
their constructors, which is before the hook runs. The headless runner test for
the hook drives a machine from the family that queues its boot on a microtask
(an Acorn or a Commodore), so the assumption is checked on the machine most
likely to break it.

**Resolving names from legends can match the wrong key on a layout whose base
legend is not the character it types** → The resolver prefers ids to legends and
the registry-driven test names the resolved tokens per machine, so a machine
whose `A` resolves to something other than its A key fails the test rather than
pressing quietly. The ROM-level proof stays where it is: one machine driven by
vocabulary names in `machineControl.test.ts`, on top of the tokens
`caseKeys.test.ts` already proves.

**Growing the parser changes what the assistant's `drive` tool accepts** → Only by
addition: every script that parsed before parses the same, and the tool's
description does not mention the new lines. A model that writes `EXPECT` gets a
check rather than a "could not understand", which is the better of the two
outcomes. The moved tests pin the old vocabulary byte for byte.

**A schedule ends the run where an undriven run would have waited for the
program** → Deliberate, and the two flags that disagree with it (`--max-frames`)
are refused rather than ignored, so a caller cannot write a schedule believing
the run will wait afterwards.

**Two machines' key tokens are raw matrix positions, with no id a name can be
derived from** → Those layouts still carry legends, which is the second route
the resolver takes; the registry-driven test is what says whether legends are
enough, and a machine they are not enough for gets a layout fix, not a
command-line exception.
