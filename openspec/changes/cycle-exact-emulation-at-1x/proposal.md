## Why

"1× speed" does not mean real time. The run loop advances exactly one machine
frame per browser animation frame and never consults a clock, so emulation
actually runs at the display's refresh rate divided by the machine's 50 Hz frame
rate — 1.2× on an ordinary 60 Hz screen, 2.4× on a 120 Hz phone or tablet. The
program-execution spec already guarantees the machine advances "at the machine's
native rate", so this is the product failing a promise it makes.

The same mismatch is audible: machines produce a fixed number of samples per
frame while the audio pipeline consumes them at a fixed rate, so on a 60 Hz
display sound is generated 20% faster than it is played and latency climbs until
the buffer saturates and starts discarding.

## What Changes

- Emulation is paced against a wall clock at each machine's own native frame
  rate, instead of once per browser animation frame. A program takes the same
  wall-clock time to run on a 60 Hz, 120 Hz or 144 Hz display, and on a machine
  that cannot keep up the emulation slows down rather than skipping ahead.
- Machines declare their native frame rate rather than the seam assuming 50 Hz
  for everything. The rates genuinely differ (the Spectrum's is 50.08 Hz, the
  C64's 50.125 Hz) and on the Amstrad it changes at runtime when a program
  reprograms the CRTC.
- **BREAKING** (internal seam only, no user-facing behaviour): the speed
  multiplier moves off `MachineEmulator` and into the run loop. `setSpeed` is
  removed from the interface and from every machine; speed now scales how often
  whole frames run rather than how many cycles one frame contains. The user's
  speed setting, its stored value and its Settings control are unchanged.
- Machines that stepped instructions against a per-frame budget carry the
  overshoot into the next frame instead of discarding it, so cycles consumed
  match cycles owed over any run length. The Amstrad gains the most: it
  discarded overshoot once per scanline, roughly 312 times a frame.
- Two per-frame cycle budgets that did not match hardware are corrected (the
  ZX81/ZX80 pair and the VIC-20).
- Machines report the sample rate they actually produce, derived from their
  frame rate, so audio production and consumption match and playback latency
  stops growing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-execution`: the "Emulation runs at authentic speed with sound"
  requirement is tightened from advancing "in display-frame steps at the
  machine's native rate" to advancing at that rate *in real time*, independent
  of the display's refresh rate, with behaviour specified for a machine the host
  cannot keep up with and for audio that must play at the correct pitch without
  accumulating latency.

## Impact

- The `MachineEmulator` seam (`src/dialects/types.ts`): `frameHz` added,
  `setSpeed` removed. Every registered machine under `src/dialects/<name>/emulator/`
  and `src/emulator/<name>/` changes accordingly, so the seam change and all
  machines must land together.
- The run loop in `src/components/EmulatorPane.tsx`, plus a new pure pacing
  module under `src/app/` so the logic is testable without a browser.
- The assistant's run-check fast-forward, which currently batches a fixed number
  of frames per tick, becomes a speed multiplier.
- Audio: the per-frame sample counts are unchanged; only the rate each machine
  reports changes. The worklet already resamples and needs no change.
- Tests: every machine has a relative "slower speed takes more frames" test that
  becomes meaningless once speed leaves the machine; those are replaced by
  direct tests of the pacing module.
- No new dependencies. No user-visible UI changes.

## Non-goals

- Correct-pitch audio at speeds other than 1×. Audio is discarded above and
  below 1× today and stays that way; making fast-forward audible is separate
  work.
- NTSC/60 Hz machine variants. Every registered machine is a PAL variant and
  stays one; this change makes the rate explicit, it does not add new ones.
- A user-visible speed or frame-rate readout in the toolbar or status bar.
- Sub-frame (scanline- or cycle-accurate) rendering, and cycle-exact contention
  or floating-bus emulation. This change is about how much emulated time elapses
  per unit of real time, not about accuracy within a frame.
- Re-tuning the TRS-80 backend, which interprets BASIC statements rather than
  executing cycles and has no cycle budget to be exact about.
