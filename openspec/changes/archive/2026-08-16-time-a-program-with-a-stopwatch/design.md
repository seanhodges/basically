## Context

`profile-a-running-program` establishes two things this change depends on
entirely: that every duration the IDE reports is time on the emulated machine
rather than in the browser, and a run-anchored clock counting that time.
`docs/contributing/architecture.md` covers the seam and the run loop those live
in; this design does not restate them.

Two existing pieces settle most of what is left.

**Whether a program has finished is already classified.**
`classifyAiRunFrame` in `src/app/aiRunCheck.ts` decides, per frame, whether a
run has errored, ended, is still going, or never started. It already handles the
machine-capability gradient this change would otherwise have to rediscover: an
error report ends it immediately; `isProgramRunning() === false` means finished;
and a machine that can never answer that question is documented as one whose
runs never end in `ended-ok`. Reading the machines confirms the split —
`isProgramRunning()` is implemented by the BBC, PET, VIC-20, C64, CPC, Altair
and TRS-80 interpreter, and absent on the ZX81, ZX80, both Spectrums, the Atom
and the TRS-80 emulator.

**A debugger pause is already a well-defined event.** `debugStep` reports the
line it paused on, and `DebugStepOptions.fromLine` already threads the pause
origin through every slice so that resuming off a breakpointed line behaves.
Interval timing needs a mark at each pause, not a new notion of where a pause is.

## Goals / Non-Goals

**Goals:**

- Report the duration of a whole program run, in emulated machine time.
- Report the duration between two pauses of a debugged run.
- Say how a timing ended, in terms that are true on every machine.
- Let the assistant take a timing so it can compare two versions by measurement.

**Non-Goals:**

- A clock of this change's own; per-line or per-routine costs; timing below the
  BASIC line; storing timings for comparison; wall-clock timing — all as stated
  in the proposal.

## Decisions

### Read the profiler's clock; add none

A timing is the difference between two readings of the run's elapsed emulated
time that `profile-a-running-program` maintains.

*Why:* two clocks would drift, and would eventually disagree in front of the
user — a profile saying a run took four seconds beside a stopwatch saying it
took four and a half is worse than either alone. It also means the stopwatch
inherits, for free, the properties that clock was designed to have: unaffected
by the speed multiplier, by the display's refresh rate, and by the host.

*Consequence:* this change cannot land before `profile-a-running-program`.
That is an accepted, stated dependency rather than something to engineer around.

### An ending is a `classifyAiRunFrame` outcome, not a new judgement

How a timing ended is taken from the existing run-outcome rules rather than from
a second implementation.

*Why:* the hard part of "did the program finish" is not the happy path, it is
the machines that cannot say — and that is already reasoned about, documented
and tested in `aiRunCheck.ts`. Writing a second answer would mean two places
that could disagree about whether a Spectrum program has ended, and the second
one would be the one written without the original reasoning to hand.

*Alternative rejected:* treating a non-error report (a Sinclair `0 OK`) as an
end signal. The existing classifier deliberately does not, and inventing that
rule here would make the stopwatch's notion of "finished" differ from the
assistant check's on the same machine and the same program.

*Consequence:* on a machine that cannot report whether a program is running, a
whole-program timing does not end by itself. It ends when the user stops the
run or when execution pauses, and the ending says so. A duration that is really
"until you pressed stop" must never be presented as "until it finished".

### Timing is reported with its ending, never bare

Every duration is accompanied by how it ended — finished, errored, stopped by
the user, or paused at a breakpoint.

*Why:* the same number means different things under each. "1.4 seconds" for a
program that ran to completion is a measurement; "1.4 seconds" for a program the
user got bored of is not a fact about the program at all. Separating the two
would leave the user to remember which they were looking at, and would let the
assistant compare two numbers that are not comparable.

### An interval is marked at pauses, not at breakpoints

Interval timing marks the clock when the debugger actually pauses, rather than
when a breakpointed line is reached.

*Why:* they are not the same event. A breakpoint on the line execution resumed
from is deliberately not re-triggered until execution leaves it — the behaviour
`DebugStepOptions.fromLine` exists to produce — so "reached a breakpointed line"
would mark the clock at moments the user does not experience as a pause. The
pause is what the user sees and what they are timing between.

*Consequence:* stepping line by line yields an interval per step, which is a
useful thing to have rather than a side effect to suppress.

### The paused clock does not run

Emulated time does not advance while the debugger is paused, so a user who
examines a breakpoint for a minute does not see that minute in the interval.

*Why:* this falls out of the design rather than needing enforcement — emulated
time only advances when frames are run, and a paused session runs none.
`FrameClock.reset()` is already called whenever the loop stops precisely so that
a pause is not banked and replayed. It is stated here because it is the
behaviour a user would otherwise doubt.

### The assistant gets a tool on the profile tool's terms

A timing tool joins the same fixed set, resolved once per conversation.

*Why:* identical reasoning to the profile tool — a tool set that appears and
disappears invalidates the cached prefix, per `stabilise-the-cached-prefix`.

*What it enables:* the assistant can measure rather than assert. Its natural use
is a before-and-after: time the program, rewrite it, time it again, and report
the difference as a measurement. The tool does not store timings or compare them
— the assistant holds both numbers in its own turn, which keeps the tool a
measurement and not a database.

*Trade-off:* a timing costs a run, and a run costs round trips. The tool should
therefore return the ending alongside the duration in one call, so the assistant
never needs a second call to find out whether the number it got is meaningful.

**Seam impact: none.** This change adds no member to `MachineEmulator` and
changes none. It reads the clock maintained above the seam and the
`isProgramRunning` / `readReport` members that already exist.

## Risks / Trade-offs

- **A timing that ended at a user stop is mistaken for a completion time** →
  Never report a duration without its ending, in the UI and in the tool result
  alike.
- **Machines that cannot observe a finish are the popular ones** (both
  Spectrums, the ZX81) → Whole-program timing is materially weaker there, and
  saying so plainly is the mitigation. Interval timing between pauses works on
  every debuggable machine regardless, so those machines are not left with
  nothing.
- **The dependency on `profile-a-running-program` blocks this change entirely**
  → Accepted and stated. There is no partial version worth building against a
  clock that does not exist.
- **The assistant burns runs on timings** → One call returns duration and
  ending together; the tool description should make the cost of a timing clear
  so it is not taken reflexively.
- **A program that never ends** → The classifier's existing windows already
  yield "still going" rather than waiting forever; the timing reports that
  ending rather than no result.
