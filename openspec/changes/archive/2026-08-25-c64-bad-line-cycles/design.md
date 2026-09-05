## Context

The C64 machine adapter (`src/emulator/c64/c64Machine.ts`) drives the vendored
viciious core itself rather than letting it run its own interval loop: one
`tickOnce()` per cycle, ticking CPU, VIC, CIAs, SID and tape in that order, and
`runFrame` walks 63 × 312 of them through the shared machine loop. See
`docs/contributing/architecture.md` for the seam this sits behind.

That structure is what makes this change small. The bus arbitration a real
VIC-II performs with the BA line is, from the adapter's side, one decision per
cycle: does the CPU get this tick or not. Nothing inside the chip emulation has
to change to answer it.

## Goals / Non-Goals

**Goals.** Charge the CPU the thousand cycles a frame the video chip really
takes. Keep the vendored core byte-identical. Keep the decision pure and
unit-testable without booting a machine.

**Non-goals.** NTSC geometry, sprite DMA, cycle-exact raster stability — see the
proposal.

## Decisions

### The decision lives in the adapter, not the chip

`src/emulator/c64/viciious/` is vendored and must diff cleanly against upstream,
so the BA line is modelled adapter-side. `tickOnce()` asks first and skips
`cpu.tick()` when the answer is yes. The other four components still tick: they
run off the system clock regardless of who holds the bus.

`serviceTrap()` is skipped on the same cycles. It fires at a clean opcode-fetch
boundary, and a CPU off the bus cannot reach one.

The one file touched under the vendored directory is `index.d.ts`, which is this
repo's own hand-written declaration file for the core (its header says so), not
upstream code. It gains the VIC's register-read function on the typed surface.

### Where the raster position comes from

The clock keeps its own cycle-within-line counter, advanced once per tick. It
stays in step with the chip's because `tickOnce` ticks the VIC exactly once per
cycle and nothing else in the app ticks it — a cross-module invariant, so it is
stated in a comment and pinned by a test rather than left to hold by luck.

The raster line, the vertical scroll and the display-enable bit are read from the
chip itself, through its register read, once per raster line. That is 312 reads a
frame rather than 19656, and taking the line number from the chip rather than a
second mirrored counter means the two cannot silently drift apart.

Only `$D011` and `$D012` are read. The VIC's collision and interrupt registers
clear when read, so probing them would corrupt a running program; the two the
clock needs are pure.

### Which lines are bad, and which cycles

The hardware rule, not the vendored core's approximation of it: a bad line is a
raster line within the display window, with the display enabled, whose low three
bits match the vertical scroll register. Twenty-five a frame. The vendored core
tests only the scroll bits, so it believes in about thirty-nine — but a display
fetch it performs on a border line is invisible and costs nothing, and is not a
reason to take cycles from the CPU there.

The cycles taken are the forty on which the chip reads its forty character
columns, positioned to coincide with where the vendored core actually performs
that fetch.

Display-enable is sampled once, at the top of the display window, and held for
the frame — as the chip does, since a program that clears it mid-screen has
already missed the decision.

## Risks / Trade-offs

**Everything on the C64 gets ~5% slower.** That is the point, but it moves
measured figures. The published loop speed is re-measured; the loop-speed test's
20% tolerance absorbs the shift either way, so the test passing is not evidence
the figure is right — it has to be taken again.

**Boot takes ~5% more cycles.** `tickUntilPc` runs against a fixed cap during
`loadProgram`; the margin is checked rather than assumed.

**The lockstep invariant is load-bearing.** If a future change ticks the VIC
somewhere other than `tickOnce`, the clock's idea of the cycle within the line
drifts from the chip's and the stall lands in the wrong place. This is why the
line number comes from the chip and why a test asserts the two agree across a
whole frame: the failure is otherwise silent and looks like a timing bug.
