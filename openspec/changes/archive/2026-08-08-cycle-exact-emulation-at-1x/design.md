## Context

The emulation layer and its seam are described in
`docs/contributing/architecture.md`; this document covers only what changes.

Today the run loop advances one machine frame per `requestAnimationFrame`
callback and never reads a clock, while every machine sizes a frame as
`clock_Hz / 50`. Emulated speed is therefore the display's refresh rate divided
by 50: 1.2× at 60 Hz, 2.4× at 120 Hz. Three smaller inaccuracies sit underneath
that and are unmeasurable until it is fixed:

| source                                                     | error    | machines                                |
| ---------------------------------------------------------- | -------- | --------------------------------------- |
| animation-frame pacing                                      | +20…140% | all                                     |
| Amstrad discards scanline overshoot, ~312× per frame         | ~+3%     | cpc464, cpc6128                         |
| ZX81/ZX80 frame budget 65000 T against 312 × 207 = 64584     | +0.64%   | zx81, zx80                              |
| VIC-20 budget rounded from a clock rate rather than 312 × 71 | +0.07%   | vic20                                   |
| instruction overshoot discarded at the frame boundary        | ~+0.01%  | zxspectrum, zxspectrum128, zx81, zx80, altair8800 |

Three groups of machines are already exact and must be left alone. The
cycle-stepped cores (commodore64, pet, vic20) tick one clock at a time and
cannot overrun. The jsbeeb-backed cores (bbcmicro, bbcmaster, atom) accumulate
into a persistent target-cycle counter, so an instruction that overshoots one
frame leaves the next starting in debt — long-run exact by construction. The
registered trs80 backend interprets BASIC statements rather than executing
cycles and has no cycle budget at all.

## Goals / Non-Goals

**Goals.** Emulated time tracks real time at 1× on any display. Each machine's
native frame rate is explicit rather than assumed. Every machine's per-frame
cycle budget is both correct against hardware and fully consumed. Audio
production matches audio consumption.

**Non-Goals.** As listed in the proposal: no correct-pitch fast-forward, no NTSC
variants, no speed readout in the UI, no sub-frame rendering accuracy, no
re-tuning of the statement-budgeted trs80 backend.

## Decisions

### Frame rate belongs on the emulator, not the dialect

**Seam impact:** `MachineEmulator` gains `readonly frameHz: number` and loses
`setSpeed`. This is the whole of the seam change, and because `setSpeed` is
mandatory today, the interface and all machines must land in one commit.

It has to be an instance member rather than a dialect-level constant because the
Amstrad's frame length is driven by CRTC registers and changes when a program
reprograms them; it is a getter there and a constant everywhere else. Reading it
per tick rather than caching it is what lets that work with no extra plumbing.

*Alternative considered:* exposing `cpuHz` and `cyclesPerFrame` separately and
letting the host divide. Rejected — it leaks how a machine budgets its time
across the seam, and the statement-budgeted trs80 backend has neither.

### Pacing lives in a pure module, not in the component

The accumulator goes in its own module under `src/app/` and is driven by a
timestamp the caller passes in, so it can be unit-tested against a fake clock
instead of a real browser. The run loop keeps only the wiring. This is the
load-bearing test for the whole change: everything else is measured through it.

Per tick: accumulate elapsed time, clamp the accumulator to a small number of
frame periods, then run whole frames while the accumulator holds one. Rendering
stays once per tick regardless — on a 120 Hz display a 50 Hz machine yields
ticks that alternate between one frame and none, repainting the same picture,
which is correct.

The clamp is what makes "a host that cannot keep up" behave. Without it a tab
that stalls for a minute would return and replay that minute at whatever speed
the CPU allows. With it, lost time is dropped.

*Alternative considered:* a fixed 50 Hz `setInterval` instead of animation
frames. Rejected — it decouples emulation from repaint (tearing and judder), and
it keeps running in a background tab, where a paused game is exactly what the
user expects to come back to.

### Both run paths have to be paced, because there are two

The loop has a second branch that advances the machine a debug slice at a time
instead of a frame at a time, and it is easy to read that as an exceptional
path. It is not: a debug session opens on *every* Play for any machine that
models line debugging, so on those machines the slice branch is the ordinary run
and the frame branch never executes. Pacing only the frame branch leaves most of
the registered machines running at the display's rate, which is the whole defect.

A slice is a frame's worth of CPU budget by construction, so it takes the same
frame count from the accumulator and runs that many slices, stopping early if one
of them hits a breakpoint. The count is therefore computed before the branch and
shared by both.

This was found by instrumenting the loop in a browser after the end-to-end timing
test failed at exactly 1.2× on a 60 Hz headless Chromium — the frame branch was
running zero times per second.

### Speed scales frame frequency, not frame size

Speed moves from the machines into the loop, expressed as the frame period
divided by the multiplier. Scaling a frame's *cycle budget*, which is what every
machine does today, distorts anything the machine derives from its own frame:
below 1× the Spectrum runs a partial frame and paints most of the screen from
its end-of-frame fallback rather than at raster timing, the PET's retrace
counter free-runs out of phase with the shortened frame, and per-frame effects
such as the Spectrum's FLASH phase do not scale at all. Running whole frames
more or less often has none of those problems and makes 1× correct by
construction rather than by arithmetic.

It also deletes fourteen near-identical `setSpeed` implementations and the
workarounds that grew around them — the Altair booting at a fixed speed
"whatever `setSpeed` says", and the load handshakes in machine tests that had to
apply the multiplier only after booting because boot depends on 1× timing. Boot
is now always 1×.

The assistant's run check, which today batches a fixed number of frames per
tick because nobody is watching it, becomes a speed multiplier fed to the same
accumulator. Its windows stay counted in frames, so no rule moves.

### Overshoot is carried as debt

An instruction-stepped CPU cannot stop exactly on a cycle boundary. The machines
that reset a local counter to zero each frame therefore gain the overshoot every
frame. Carrying it — starting the next frame owing what the last one overran —
makes the long-run cycle count exact, which is the same thing the jsbeeb cores
already do with their target-cycle accumulator.

Two details matter. The Sinclair machines abandon the rest of the budget when
the CPU halts, which is correct (a halted CPU idles until the next frame's
interrupt), but that must zero the debt rather than record a negative one. And
the Amstrad must carry a single debt across scanlines and frames alike, not one
per scanline — per-scanline reset is precisely where its ~3% comes from.

### Machines report the rate they actually produce

Rather than change how many samples a machine emits per frame, each machine
reports its sample rate as the samples it emits per frame multiplied by its
frame rate. A machine emitting 882 samples at 50.08 frames per second is
producing 44170.6 Hz, not the nominal 44100 Hz it claims today. Production then
matches consumption exactly and playback latency stops growing.

*Alternative considered:* keeping the nominal rate and emitting a fractional
number of samples per frame via an accumulator in each audio source. Rejected —
it touches every sound chip to fix something the existing resampler already
handles, and it makes the per-frame sample count non-constant for no benefit.
The worklet takes the source rate as a float and recomputes its ratio on every
message, so a machine whose rate varies with its CRTC is handled for free.

## Risks / Trade-offs

- **Removing a mandatory seam method is a breaking change** → all machines and
  their tests land in the same commit; the type checker finds every site.
- **Everything gets 20% slower in CI**, because headless Chromium ticks at
  60 Hz and every timing-sensitive end-to-end spec currently benefits from the
  overspeed → sweep the whole Chromium suite and look for specs newly close to
  their timeout, not only for failures.
- **A slow device now runs slow instead of fast.** Today a machine that cannot
  keep up still gets a full frame of emulated time per repaint; with pacing it
  falls behind and the clamp discards the difference. This is the correct
  trade — it is what "at the machine's native rate" means — but it makes heavy
  programs on weak hardware visibly worse than the current overspeed masked.
- **Correcting the ZX81/ZX80 budget shifts boot handshakes** by 0.64% → those
  handshakes poll for a condition with a generous frame cap rather than assuming
  a fixed count, so the margin absorbs it; the colocated tests confirm.
- **Frame rates become non-integer** (50.08, 50.125) → the accumulator works in
  floating-point milliseconds and never assumes whole frames per second; the
  fake-clock tests cover a non-integer rate explicitly.

## Migration Plan

No data migration and no persisted format changes: the stored speed setting
keeps its meaning and its values. The seam change is internal, so the ordering
constraint is only within the commit — interface, machines, and the machine
tests that call `setSpeed` must move together, then the loop, then the audio
rates.

## Open Questions

None blocking. Whether to surface actual-versus-real speed in the status bar was
considered and deliberately left out of scope.
