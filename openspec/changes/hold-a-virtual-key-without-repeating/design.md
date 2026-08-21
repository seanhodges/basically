## Context

The virtual keyboard's press logic lives in one machine-agnostic engine, fed by
per-machine layout data (see `docs/contributing/architecture.md` for the
keyboard's place in the app). The engine already counts a press in *emulated*
frames rather than wall-clock ones, because the machine's clock is the only one
that matters to a key matrix and it stops when the emulator does. That counter
is what a ceiling can be stated in.

The existing per-layout `minHoldFrames` is the same idea from the other end: a
floor, so a press too brief for the ROM's scan still registers. What was missing
was the ceiling.

## Decisions

**The ceiling is layout data, not a constant.** How long a press can rest before
the machine starts repeating is a fact about that machine's ROM, measurable by
booting it: on the PMD 85 the second character arrives 38 frames after the
first. A number in the shared engine would be a guess that is wrong for every
machine at once. A layout that declares nothing keeps today's behaviour, so this
changes only the machine that asks for it.

**Frames, not milliseconds.** The floor is already in frames and both ends have
to be comparable — a ceiling below the floor would otherwise cut a press short
of the scan that reads it. Frames also mean the ceiling follows the emulator's
speed control: at 4x the ROM's repeat delay arrives in a quarter of the real
time, and so does the ceiling.

**The press ends; it does not pulse.** At the ceiling the key is released
exactly as a lift releases it — the same sticky-modifier consumption, the same
minimum hold. Re-pressing while the finger is down would be an IDE-invented
auto-repeat, and releasing without the rest of the bookkeeping would leave a
sticky SHIFT held. The key also stops drawing as pressed, which is the only
feedback the user gets that the press is spent.

**Function keys and modifiers are exempt.** `virtual-input` already requires
that a function key held without moving stays held, because the machines that
read function keys read them as held state — on the PMD 85 those are the only
keys `INKEY` can see, and they are what the bundled games read. A modifier has
to outlast the key it modifies for a chord to reach the machine at all. Both
therefore ignore the ceiling; it applies to the keys of the board itself, which
are the ones a ROM auto-repeats.

**The controller is a separate engine and keeps its own timing.** It reads
`minHoldFrames` from the same layout for its own floor, and a held d-pad
direction is held state a game reads. Nothing here touches it.

## Seam impact

None. The `Dialect` / `MachineEmulator` contract is untouched: the machine still
sees `setKey(token, down)` and its own matrix decides everything else. The
change is in the virtual keyboard's press logic and in one layout's data.

## Risks

- Hold-to-repeat through the on-screen keyboard is lost on a machine that
  declares a ceiling: holding DELETE no longer eats a line. Tapping does, and a
  host keyboard still repeats at the machine's own rate. This is the trade the
  change is: the repeat that a resting finger reaches by accident is the same
  repeat a deliberate hold asks for, and there is nothing in a pointer event
  that tells the two apart.
- A ceiling set too near the ROM's repeat delay would let a slow frame or two
  through. The PMD 85's is pinned against the ROM by a test that boots it and
  measures where the repeat actually starts, so a change in either number fails
  loudly rather than drifting.
