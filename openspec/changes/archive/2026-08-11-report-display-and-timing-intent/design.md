## Context

These four findings share one property: the program's text ports without a
single error and the *behaviour* arrives wrong — the layout off the screen
edge, the game unplayably fast, the meaning that colour carried gone, the
key-read waiting where it sampled. Each needs a fact the guide does not hold
(geometry as numbers, speed as a measurement) or a question it never poses
(what was the colour for). The posed-decision convention and the narrowing
machinery both exist; this change applies them.

`docs/contributing/architecture.md` covers the seam and the reference
boundary. The emulator benchmark follows the registry-driven boot checks the
RAM budgets already use.

## Goals / Non-Goals

**Goals**

- Geometry and speed as pinned facts; positions and empty loops as
  vocabulary; three findings that pose what they cannot decide.
- Honest measurement: the speed is what this product's emulators exhibit,
  labelled as exactly that.

**Non-Goals**

- Layout reflow, loop tuning, or any rewriting.
- Graphics-coordinate spaces.
- Structured wait-semantics for input commands.

## Decisions

### Impact on the Dialect seam: none

Geometry, speed and clock idioms are reference data; positions and loops are
read by the existing app-side scan. The benchmark test drives emulators
through the seam as other emulator tests do, adding nothing to it.

### Geometry is the boot screen's, parsed and pinned

The structured fact is the columns and rows of the text screen the machine
boots into — the mode-dependent machines keep their fuller story in prose,
and the boot mode is the one a ported program lands in, consistent with how
the conditional-memory change reads modes. The crosscheck parses the columns-
by-rows figure the prose already states and requires agreement, so the two
cannot drift.

### Positions come from the same scan as everything else

The vocabulary collects literal arguments of the machine's position syntax —
the row-and-column commands, the single-offset commands, and the position
control codes whose operands the escape scan today throws away — under the
usual rules (constants only; strings, comments and data inert; computed
positions counted but not judged). Row-and-column positions are checked
against the target's geometry directly. A single-offset position is different:
the offset encodes the source's width, so beyond bounds-checking it, the
finding says the offsets must be recomputed for the target's width — a
mechanical rule worth one line, not a table.

One decision echoed from the conditional-memory change: doubt reports
nothing. A computed position is not reported as out of bounds; the finding
covers what the text proves and the posed decision covers the rest.

### Speed is measured, not authored

Each machine's speed fact is a measured figure: the registry-driven benchmark
boots every machine, runs the same empty counting loop, and counts emulated
frames to completion. The authored constants are pinned within a stated
tolerance by that test — facts stay constants at runtime (the docs site
cannot boot emulators), the benchmark is the crosscheck, and a machine whose
emulator changes speed fails the pin loudly. The loop is expressible on every
registered machine's BASIC; where a machine needs its own spelling of the
same loop, the fixture holds it beside the others.

The finding fires when the program has empty counting loops and the measured
ratio between the machines is material (threshold stated in the fixture, not
scattered). It quotes the ratio as "measured in this IDE's emulators" — which
is also the number the user's ported program will actually exhibit here — and
poses the decision: retune the counts, or move the delay onto the target's
own clock, which each machine's facts name in one authored phrase (its frame
pause, its centisecond clock, its jiffy variables). The clock idiom is one
line per machine, pinned to the machine's own reference rows.

### Colour and sound decisions ride the capability accounts

When the program uses colour or sound keywords and the target has no such
capability, the existing lost-capability account for that group gains the
posed decision: where it decorated, drop it; where it told things apart,
re-encode it — and the means are the target's advice already written there
(inverse video, character density, printed labels, a message in place of the
beep). No new section, no new prose register: one `Decide:` line where the
loss is already reported, present only when the program actually uses the
capability, which the narrowing already knows.

The display-model guidance requirement is untouched: its "nothing SHALL be
added" clause governs how colour *attaches* where both machines have colour;
this decision is about colour *lost*, in the section that reports the loss.

### The input rows are data, not machinery

Two authored additions close the named gaps: the file-record meaning of the
key-read word on the machine that has it, and the timed key-read that blocks
on one machine while the same-named read on another cannot wait at all. Both
are rows in the existing same-word-different-meaning table, crosschecked
against reference rows like every other entry. The behaviour-change reporting
deliberately compares shapes and not descriptions; these two are exactly the
cases that rule exists to hand to the authored table.

## Risks / Trade-offs

- **Emulator speed may not match real hardware.** → Stated on the finding
  itself, every time; and the emulator's number is the one a user of this
  product experiences. A machine known cycle-exact can say so in its prose.
- **The benchmark adds emulator boots to the test run.** → One loop per
  machine, in line with the boot checks already paid for; the tolerance keeps
  it stable against timer jitter.
- **A delay threshold invites bikeshedding.** → One constant, stated with the
  fixture, tested at its boundary.
- **Position findings on art-heavy programs could be long.** → The existing
  long-list capping rules apply; positions group by line.
- **The boot-mode geometry understates machines whose programs change mode.**
  → A constant mode selection is visible in the vocabulary; round one keeps
  the finding to the boot screen and says so in the finding when the program
  selects other modes, rather than judging geometry it cannot know.

## Open Questions

- Whether the measured ratio should ever quote real-hardware figures where
  the emulator is documented cycle-exact. Left for the change that would earn
  it; the emulator-measured label is true either way.
