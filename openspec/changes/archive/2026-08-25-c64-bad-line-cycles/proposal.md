## Why

The Commodore 64's VIC-II takes the bus away from the CPU forty cycles at a
time, twenty-five times a frame, to fetch the row of characters it is about to
draw. Those are the "bad lines", and on real hardware they cost the 6510 about a
thousand of a frame's 19656 cycles. Basically's C64 does not model them: the CPU
gets all 63 cycles of every raster line. The vendored chip emulation says so
itself, in the first lines of its own source — its timing is placeholder, it does
not stun the CPU for bad lines, and raster-stable routines are not going to work.

Two things follow, and both are visible to a user.

**Cycle-counted raster code drifts.** A program that changes a border or
background colour in a timed loop draws bands whose position relative to the
raster depends entirely on how many cycles a frame is worth. Getting that figure
wrong by a thousand cycles does not make the bands slightly wrong; it changes
where they land every frame, so a pattern meant to creep down the screen instead
strobes. This is the whole technique behind a large family of C64 one-liners and
demo effects, and none of them can be right while the figure is.

**BASIC runs about five per cent fast.** Every counting loop, every delay written
as `FOR I=1 TO N`, finishes sooner here than on the machine it is written for.
The IDE publishes a measured loop speed per machine, and tells the assistant to
pick delay counts against it, so the error propagates into advice and into
programs users write.

The fix is small and belongs to the adapter: the IDE already drives the C64's
chips a cycle at a time, so it can decline to tick the CPU on the cycles the
video chip owns.

## What Changes

- The C64's CPU **loses the cycles its video chip spends fetching** the display —
  forty cycles on each of the twenty-five bad lines in a frame, one thousand
  cycles in all.
- A bad line is recognised as the hardware does: only inside the display window,
  only when the display is enabled, and on the raster lines the program's
  vertical scroll register selects.
- **A frame is still a frame.** Its length in cycles, and the machine's frame
  rate, do not change. The CPU simply does less inside one.
- The C64's published loop speed is **re-measured** to match.

## Capabilities

### Modified Capabilities

- `program-execution`: the *Emulation runs at authentic speed with sound*
  requirement gains a paragraph on cycles a machine's CPU never gets, because
  another chip in the machine has the bus.

No other capability is affected. Nothing changes about how a run starts, pauses,
is debugged, or is rendered; `profiling` still charges every cycle of a frame to
the BASIC line executing it, including the cycles the CPU spends waiting.

## Non-goals

- **NTSC.** This is the change most C64 raster programs written for a 60 Hz
  machine actually need, and it is not this change. Basically's C64 is a PAL
  6569 — 63 cycles over 312 lines — and stays one. Modelling a 6567 means new
  line and frame geometry, a different clock, a different visible picture size
  and a way for a user to choose, all of which live inside the vendored chip
  emulation this change deliberately does not touch.
- **Sprite DMA.** The video chip also takes cycles to fetch sprites, by the same
  mechanism and on the same bus. Bad lines are the thousand-cycle case and the
  one every program pays; sprite fetches are smaller, program-dependent, and can
  follow separately.
- **Cycle-exact raster stability.** The vendored chip emulation samples
  interrupts at instruction boundaries rather than per cycle, and carries a list
  of its own acknowledged timing approximations. This change fixes the largest
  single error in the cycle budget; it does not make the C64 cycle-exact, and a
  hand-timed stable raster still will not be.
- **Any change to the vendored core.** Every `.js` file under the vendored C64
  emulator stays byte-identical, so it still diffs cleanly against upstream.

## Impact

- `src/emulator/c64/` — a new module deciding, per cycle, whether the video chip
  has the bus, and the machine adapter's tick path honouring it. The adapter
  already owns the cycle loop, so this is where the decision belongs.
- `src/reference/facts.ts` — the C64's measured loop speed, re-taken.
- `docs/reference/commodore/hardware.md` — that the video chip takes cycles from
  the CPU, and that this machine is PAL.

The `Dialect` / `MachineEmulator` seam is untouched: this is internal to one
machine's emulator, and no other machine, and no caller, sees it.
