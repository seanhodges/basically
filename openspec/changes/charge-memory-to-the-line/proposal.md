## Why

A run's time is reported against the line that spent it, but a run's memory is
reported only as a whole: one series of BASIC RAM in use across the run and the
peak it reached. So a user can see memory climbing and see the stall when BASIC
reclaims it, and still have no reading of which line built what was reclaimed —
on a program of any size that is the question they actually asked, and the only
way to answer it today is to bisect the program by hand.

## What Changes

- A run charges the growth in BASIC RAM to the line that was executing when the
  machine's own memory figures rose, in the same flat accounting the time side
  already uses: a line is charged what it itself allocated, and a line that
  calls a routine is not charged what the routine allocates.
- The run profile reports those bytes per line, ranked, and summed over each
  named routine and jump destination the outline can identify — the same
  roll-up the time side offers.
- The figure is gross: rises are summed and falls are not subtracted, so a line
  that builds strings and lets BASIC reclaim them reads as the churn it is
  rather than as nothing. This is what makes the reclaim stall attributable.
- The accounting is disclosed where the bytes are shown, as the per-line time
  costs already disclose theirs.
- Charging memory to a line means observing the program leave it, which a loop
  written on one line never does. Where memory rose and none of it could be
  charged, an approximate breakdown is offered instead - each rise spread over
  the lines running at the time, by their share of the run's time - and is
  marked as approximate. It is never mixed with charged figures in one reading.
- A run in which no memory figure was ever read is distinguished from one in
  which figures were read and no memory was taken. The first is the absence of a
  measurement; the second is a measurement.
- The assistant is given the same reading, so it and the user cannot disagree
  about where the memory went.

## Non-goals

- **Inclusive (call-graph) attribution.** A `GOSUB` is not charged what its
  callee allocates. BASIC exposes no call graph to read, and the routine
  roll-up already answers "what did this routine cost" without one.
- **A breakdown by memory area.** This change does not report program vs
  variables vs arrays vs string heap; the machines' `used` figure stays one
  number.
- **Marking allocating lines in the editor gutter.** That column already
  carries heat, breakpoints and lint markers.
- **Reporting reclaims per line.** Where memory was given back is not
  attributed; only where it was taken.
- **Extending measurement to machines that cannot report their executing
  line.** The Atom, Altair and TRS-80 stay outside the profile entirely.
- **Reconciling the two accounts.** Where memory was charged to lines but the
  run's total moved by more than the sum of it, the difference is not made up
  with approximations. A machine's figure moves for reasons that belong to no
  line of the program, and pricing that difference would invent attribution
  rather than report it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `profiling`: adds a requirement that memory is charged to the line that
  allocated it — per line, summed per routine, gross rather than net, covering
  exactly what the run's own memory account covers, disclosed where shown, and
  falling back to a marked approximation where nothing could be charged. No
  existing requirement changes.

## Impact

- `src/emulator/lineCostRecorder.ts` — the shared per-line recorder gains an
  optional reader of the machine's in-use figure and attributes growth at BASIC
  line boundaries.
- `src/dialects/types.ts` — `LineCost` gains an optional bytes field. No new
  seam method; `drainProfile()` already carries `LineCost[]`.
- The nine machine adapters that own a `LineCostRecorder` (Commodore 64, PET,
  VIC-20, Amstrad, BBC, ZX80, ZX81, Spectrum, Spectrum 128) pass the reader.
  The BBC additionally hides its pointer reads from the memory-activity tap, as
  its line walk already does.
- `src/app/runProfile.ts` — accumulation, the approximate fallback, and the
  ranked/rolled-up derivations.
- `src/components/RunProfileDialog.tsx` — the new section.
- `src/ai/driveTools.ts` — `describeProfile()`.
- `docs/guide/testing-programs.md` — the profile's description of what it lists.
- No new dependencies.
