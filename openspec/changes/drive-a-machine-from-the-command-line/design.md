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

- One vocabulary of actions, shared by `run --keys` and by the assistant — so a
  script that works in one place works in the other, and there is one parser and
  one runner to test.
- Key names a caller can write without knowing the machine, resolved from what
  each machine's keyboard layout already declares, held to every machine by a
  registry-driven test.
- One vocabulary of *key names* too, not just of actions: the assistant is
  migrated onto it in this change rather than a later one, so two lists of key
  names for the same machine never exist side by side.
- No new runtime dependency, and nothing added to the machine seam.

**Non-Goals:**

- **Typing text.** `TYPE "FRED"` looks like one action but is not: a character on
  a shifted legend needs its modifier, a Sinclair machine in keyword mode turns a
  letter into a keyword, and a program reading `INKEY$` sees a burst of presses
  differently from one reading `INPUT`. A schedule spells a word as `PRESS` lines,
  which is honest about what the machine receives. A resolver that turns a
  character into a chord is a separate change, once there is a schedule that
  needs it.
- **Checking a program against an expectation.** That is
  `test-a-program-from-the-command-line`, proposed on top of what this change
  builds.
- **Recording a session.** A schedule is written, not captured.
- **Symbol keys in the vocabulary.** Every machine has a quote keycap and several
  have `+ - = , .` cells, and the same declared-`insert` rule would reach them.
  It is left out because the grammar cannot yet say them: this change makes `+`
  the chord separator and `#` the comment marker, so `PRESS +` and `PRESS #` are
  ungrammatical, and there is no quoting rule for a key name. Symbols need that
  rule first; the mechanism is otherwise identical and can be added the day the
  grammar can express it.
- **Unifying the assistant's *assertion* vocabulary.** The assistant checks its
  own programs with `SCREEN CONTAINS` and `VAR` in a `basic-expect` block, which
  overlaps in spelling with the `EXPECT` lines
  `test-a-program-from-the-command-line` proposes, but not in meaning: an
  expectation there is latched across a whole run and settled once the program
  ends, where an `EXPECT` line is checked at the one moment its script chose.
  Bringing them together would reach into the run-check latching, a mechanism
  separate from driving. Left alone deliberately.
- **Changing how the assistant asks to drive, or what its tools are.** The
  `basic-view` `DRIVE` request, the tool set and every tool description are
  untouched; only the names of the keys it is offered change.

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

The vocabulary grows by what a written schedule needs that a model improvising one
did not:

| Line                       | Meaning                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `# …`                      | A comment, ignored. A schedule that cannot say why it presses what it presses is not written for anyone but the author. |
| `PRESS <key>[+<key>…] [n]` | Press the named keys together; `+` joins a chord, so a shifted legend is `PRESS SHIFT+P`.        |
| `WAIT FOR "<text>" [n]`    | As today, with an optional cap in frames where the default is not enough for a slow machine.     |
| `WAIT END [n]`             | Run until the program stops, or fail after `n` frames. The moment a program that finishes reaches. |

An action that cannot be carried out ends the schedule there, exactly as it does
today — nothing about the stop-on-first-failure rule changes.

*Alternative rejected: leave the parser in `src/ai/` and import it from the
command line.* It works, but it drags the assistant's profile and timing
formatters — and their imports — into the headless bundle, and it makes the
command line's grammar a fact about the AI module.

### Key names resolve from the layout, in one place, for every caller

A new `src/keyboard/keyNames.ts` resolves a written name to the tokens a machine's
layout says press it. The decision that matters is **what the resolver reads**,
and the answer is neither the id nor the legend text: it is the semantics each
layout already declares.

Every layout says, in data, what each of its keys *means*. `KeyLabel.editor`
carries `{ insert: 'Z' }` for a character key, `{ action: 'newline' }` for enter,
`{ action: 'backspace' }` for the rub-out, `{ action: 'left' }` for a cursor key;
`KeyDef.modifier` names the modifier roles. `resolveEditorAction(layout, key,
layerId)` (`src/keyboard/editorActions.ts`) already reads exactly this, and
`resolveEmits` gives the tokens the same legend presses. So the vocabulary is
derived from declared meaning, and **no rule anywhere strips a `Key`/`Digit`
prefix off an id or matches a legend glyph**. Both of those are silent-wrong-key
generators:

- **Stripping ids** breaks on the PMD 85, a Czechoslovak QWERTZ board whose own
  header notes that its DOM `KeyboardEvent.code` tokens are *positional*: it
  declares `key('KeyY', 'Z', 'z')`, so the key that types `Z` emits `KeyY`.
  `PRESS Z` off the id would press the key that types `Y`. Read as declared
  meaning, `resolveEditorAction` returns `{ insert: 'Z' }` for that key and the
  right cell is found by construction.
- **Matching glyphs** breaks on `←`, which is cursor-left on eighteen machines but
  `{ action: 'backspace' }` on the TRS-80 and the Apple II — where the very same
  arrow is the rub-out key.

Resolution, in order:

1. **The vocabulary**, case-folded. A **character** is a base-layer
   `{ insert }` of a single letter or digit, with `' '` as `SPACE`. A **concept**
   is a declared action: `ENTER` from `newline`, `DELETE` from `backspace`,
   `UP`/`DOWN`/`LEFT`/`RIGHT` from the cursor actions, read across layers so the
   `modeOnly` CURSOR overlay is included. A **modifier** comes from
   `KeyDef.modifier`, with the layout's shift role normalised to `SHIFT` so the
   four spellings — `Shift`, `CapsShift`, `LeftShift`, `ShiftLeft` — are one name.
   A few concepts declare nothing to key on and need a small candidate table of
   ids and legends: `ESCAPE` (the id is `Escape` on all seven machines that have
   one, but the Altair's legend reads `ALT`) and `BREAK`. Everything else with a
   word legend — the function keys, `TAB`, `START`, `STOP`, `RESET` — is offered
   under the name its own keycap carries.
2. **The machine's own key id**, exact, so every name the assistant has been given
   until now keeps working.

Deriving `DELETE` from the declared `backspace` action rather than from the id is
what keeps the PMD 85 correct at the other end too: its `Del` key is
`act('DEL', 'delete')`, a *forward* delete, and so is properly not the rub-out. For
the same reason `DEL` is not an alias of `DELETE` — it would mean rub-out on
twenty-three machines and delete-forward on one.

Function keys are never renumbered. `F1` must not mean "the first function key",
because the BBC and the CPCs start at `f0` where the C64 starts at `f1`; each is
offered under the name printed on it, and `basically info` is how a caller learns
which a machine has.

A name that resolves to nothing is refused naming the machine and the name, never
silently mapped to a neighbour — and a name whose tokens come back empty, which
the CURSOR overlay legitimately produces for the keys it blanks, counts as
resolving to nothing rather than as a press that sends nothing.

`keyVocabulary(layout)` returns the machine-independent names *this* machine
resolves, sorted. Absence is the honest answer: a machine with no escape key does
not list `ESCAPE`. Only part of the vocabulary is universal — every registered
machine has the letters, the digits, `SPACE`, `ENTER` and `SHIFT`, and that is
what a registry-driven assertion can hold them all to. Escape, ctrl, tab, the
cursor keys and the function keys are per machine: eleven machines have no escape,
twelve no ctrl keycap, tab exists on the Ataris alone, five machines have no
cursor keys and the PMD 85 has only three of the four.

Describing a machine gains a `keys` field carrying that vocabulary, so a caller
finds out what it may press from `basically info` rather than by trial.

Aliases are accepted without being listed. `RETURN` and `NEWLINE` reach `ENTER`,
`BACKSPACE` and `RUBOUT` reach `DELETE`, `ESC` reaches `ESCAPE`. Listing every
spelling would triple that line in every system prompt and teach the model three
names for one key; accepting them costs nothing and makes a hand-written schedule
forgiving.

`pressKeys` deduplicates the tokens a chord resolves to. `PRESS SHIFT+LEFT` on a
Spectrum concatenates `['CapsShift']` with `['CapsShift','Digit5']`, and pressing
and releasing one cell twice in a step is bookkeeping nobody needs.

*Alternative rejected: rename every layout's key ids to one convention.* It
touches every machine's keyboard for a naming preference, and it would not help:
the ids are not the problem, reading them as if they were names is.

*Alternative rejected: derive a character from the key's legend text.* Nearly
right, and it does get the PMD 85 right, but it is the same class of mistake one
step further on — the legend is what is *drawn*, and `←` is drawn on both a
cursor key and a rub-out. The declared action is what the layout actually
promises.

### The assistant is told the same vocabulary, so there is one of them

`pressKeys` resolves every caller's names through the resolver, so the moment it
lands the assistant *accepts* vocabulary names. What remains is to stop handing it
the raw tokens: `driveKeyNames` (`src/ai/machineObservability.ts`) is repointed at
`keyVocabulary`, and the one bullet of `buildDriveRules` that lists the machine's
keys names the vocabulary instead. Raw ids stay accepted and stop being
advertised.

Doing this here rather than in a later change is what keeps the vocabulary
singular. The alternative leaves `driveKeyNames` and `keyVocabulary` in the tree
together, each a list of key names for the same machine — the exact drift this
change exists to remove.

It also settles where the vocabulary is proved. `src/ai/machineObservability.test.ts`
already boots every registered dialect on its real ROM and asserts that every name
the assistant is offered can actually be pressed; repointing the function makes
that existing test the ROM-level proof for both callers. So this change adds no
second registry-driven battery of its own — one more file booting every machine
would be among the slowest in the suite for no fact the existing one does not
already establish. What it adds instead is a fast, pure `src/keyboard/keyNames.test.ts`
for the resolution rules themselves, with the PMD 85 pinned by name.

The prompt's own constraints are met rather than worked around. The vocabulary is
derivable from the `Dialect` alone with no emulator booted, and is sorted and
byte-stable, which is what the prefix cache and `src/ai/promptStability.test.ts`
require. That test's budgets are ceilings, so a list that gets shorter cannot
break them. `driveToolDefinitions()` is untouched: its block stays free of machine
specifics, which its own test asserts.

*Alternative rejected: tell the assistant both the vocabulary and every machine
id.* It is the safest for capability and the worst for the goal — the model keeps
writing machine-specific names because they are still in front of it, and the
prompt grows to carry two names for every key.

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

### The command line's new piece stays pure, and the shim stays a shim

`src/cli/drive.ts` turns the text of a `--keys` option into actions — splitting
on newlines and on semicolons outside quotes, then handing it to the shared
parser — and throws `RunError` for a line it cannot read, naming the line, so a
malformed schedule is exit 1 before any machine boots. `driveHook(dialect,
actions)` builds the runner's `drive` callback over `createMachineControl`
(joystick through the dialect's first declared mode when it has one, else
key-mapped; fire buttons from the dialect), captures the `DriveReport` it
produced, and releases every key when the schedule ends however it ends. The
captured report is exposed so a later caller — `test-a-program-from-the-command-
line` — can read it without re-running anything; nothing in this change reads it
besides the shim. Neither function reads a file or touches `process`; the shim
reads the `--keys` text, prints the report and sets the exit code, as it does for
every other operation.

A schedule that fails part-way is the program's failure, not the caller's — the
program did not reach where the schedule expected — so `run --keys` exits 2 on
it, with the screen still reported on standard output so the caller sees what it
got instead. Under `--json`, `run` reports the schedule's steps beside the fields
it already has.

### Driving needs the ROM, and says so before starting

An undriven run on a machine whose ROM is absent draws its missing-image notice
and reports that as a condition of the run, which is useful: the caller learns
the machine boots. A driven run has nothing to drive, so `run --keys` refuses a
ROM-less machine as the caller's mistake, exit 1, before any step is taken, using
the same `hasRom` the machine listing reports.

## Risks / Trade-offs

**The driver's frame loop is synchronous, where the runner yields every twenty
frames for ROM loads that settle on timers** → Every ROM is loaded before
`bootMachine` resolves, and the driver test already runs hundreds of synchronous
frames on a real ROM after load; the yield exists for machines that start loads in
their constructors, which is before the hook runs. The headless runner test for
the hook drives a machine from the family that queues its boot on a microtask
(an Acorn or a Commodore), so the assumption is checked on the machine most
likely to break it.

**A name resolving to the wrong key is silent — it presses something, so nothing
errors** → This is the failure mode worth the most care, and the PMD 85 is the
worked example of it: its QWERTZ ids make `Z` and `Y` each other's positions, so
an id-first resolver would press the wrong one with no complaint. Three things
answer it. The precedence resolves a character by what it types rather than where
it sits; the pure resolver test pins that machine by name; and the every-machine
ROM crosscheck in `machineObservability.test.ts` presses every advertised name on
every registered machine, so a name that resolves to a key that emits nothing, or
to no key at all, fails rather than passing quietly.

**Growing the parser changes what the assistant's `drive` tool accepts** → Only by
addition: every script that parsed before parses the same, and the tool's
description does not mention the new lines. The moved tests pin the old
vocabulary byte for byte.

**A schedule ends the run where an undriven run would have waited for the
program** → Deliberate, and the flag that disagrees with it (`--max-frames`) is
refused rather than ignored, so a caller cannot write a schedule believing the
run will wait afterwards.

**A concept could resolve to two different keys on one machine** → Where both
resolve to the same tokens it is not ambiguity at all, and that is the common
case: the CPCs and the MSX declare their cursor cells twice, once as a
non-rendered `controllerKeys` entry and once as a CURSOR legend, both yielding
`['CursorLeft']`. Comparing resolved tokens rather than keys absorbs it. Where
they genuinely differ, the resolver does not choose — the test fails naming the
machine and the concept, and the layout is fixed.

**Repointing what the assistant is told changes a shipped feature's behaviour** →
It is a spec change, not a quiet one: the `ai-assistant` delta modifies the
requirement that today guarantees machine-specific naming. Its safety property is
kept exactly — the assistant is still told only names this machine has, so it
still cannot ask for a key that does not exist here. Nothing in flight breaks
either, because ids stay accepted; the browser-level driving spec drives with
`PRESS KeyA` and must stay green on that alone.

**A prompt that changes size can silently cost cache writes** →
`promptStability.test.ts` pins per-machine budgets and byte-stability across every
capability combination, and its budgets are ceilings, so a vocabulary shorter than
today's token list cannot breach them. The list stays sorted and derived from the
`Dialect` alone, which is what the stability assertion actually turns on.
