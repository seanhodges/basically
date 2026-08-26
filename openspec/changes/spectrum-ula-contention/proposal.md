## Why

The ZX Spectrum's ULA and its Z80 share one bus into the lower 16K of RAM. While
the ULA is fetching the bytes it is about to paint it holds the processor off, so
every CPU access to an address between 0x4000 and 0x7FFF costs up to six extra
T-states — and that 16K is where the screen, the attribute file, the BASIC
program and its variables all live. Basically's Spectrums do not model it. The
source says so in as many words: "Contended-memory timing is still not modelled
(it does not affect the visible result here)."

It does affect the visible result. A user's multicolour listing — an interrupt
handler rewriting the attribute file line by line down the screen, with a BASIC
loop moving the colour table under it — draws bands that jump and tear here
instead of creeping.

**Raster routines lose their lock on the beam.** The delay pattern the ULA
applies repeats every eight T-states and reads 6,5,4,3,2,1,0,0, so a contended
access always finishes at the same two positions in the block whenever it began.
That quantisation is what a multicolour routine is built on: touching contended
memory once a pass pulls the routine back into step with the line it is drawing,
every pass. Take the contention away and the same routine free-runs a few per
cent short of a line, its writes land at a different point of the picture each
frame, and a pattern meant to creep down the screen breaks up instead.

**BASIC runs several per cent fast.** Every counting loop and every delay written
as `FOR n=1 TO 1000` finishes sooner here than on the machine it was written for.
The IDE publishes a measured loop speed per machine and tells the assistant to
pick delay counts against it, so the error propagates into advice and into
programs users write.

The machine already draws each display line at the T-state the ULA would fetch
it, which is why the error shows as visible jitter rather than as nothing at all:
the picture faithfully reports a CPU that is running too fast.

## What Changes

- Both Spectrums **charge the CPU the T-states the ULA takes off it** — on every
  access to a contended address while the picture is being fetched, and on `IN`
  and `OUT`, which the ULA contends in four shapes of its own.
- The 128K contends **whichever RAM bank a program has paged in at 0xC000**, when
  it is an odd-numbered one, as well as the bank it always shares at 0x4000.
- **A frame is still a frame.** Its length in T-states, and the machines' frame
  rates, do not change. The CPU simply does less inside one.
- Time the CPU spends held off the bus is **charged to the BASIC line that
  waited**, as any other cycle is.
- Both machines' published loop speeds are **re-measured** to match.
- Both `reset()` methods now clear the frame loop's carried overrun, which they
  had been leaving behind for the next run to inherit.

## Capabilities

### New Capabilities

None.

- `program-execution`: the *Emulation runs at authentic speed with sound*
  requirement gains a paragraph on machines that share only part of their memory
  with the video hardware, where what a program loses depends on where it sits.

Most of what this change does is conformance rather than a new guarantee. The
requirement already says that "Within a frame, a machine SHALL give its CPU only
the cycles the rest of the machine leaves it… Where a machine's video hardware
takes the bus to fetch what it is about to display, the CPU SHALL lose those
cycles", with the scenarios *The video chip takes cycles from the CPU* and *A
frame is still a whole frame*; the Spectrum's ULA does exactly that and these
machines did not model it. What is genuinely new is the part the C64 has no
equivalent of: its video chip takes the bus from the whole machine, while the
Spectrum's takes it only for one 16K bank, so on a Spectrum the same routine runs
at two different speeds depending on where it was placed. That is user-visible
and worth stating.

`profiling` is unaffected in what it guarantees: every cycle of a frame still
reaches a BASIC line, waiting included.

## Non-goals

- **The +2A/+3 ULA.** Its delay pattern is a rotation of the 48K's and its
  contention starts elsewhere. No registered machine is a +2A or +3, and adding
  one is a machine's worth of work, not a timing fix.
- **The floating bus.** Reading an unclaimed port still returns 0xFF rather than
  the byte the ULA has in flight, so the floating-bus raster-sync trick remains
  unavailable. It needs its own sourcing — the fetch order within a character
  column, a different offset on the 128K, and the fact that a +2A has none.
- **Holding INT for its real window.** The frame interrupt is still raised once,
  at the frame boundary, and dropped if interrupts happen to be disabled at that
  instant; real hardware asserts INT for about 32 T-states and the Z80 takes it
  at the first boundary where interrupts are on. That is interrupt acceptance,
  not bus arbitration, and folding it in here would confound the loop-speed
  re-measurement this change has to take.
- **Cycle-exact contention.** The vendored Z80 core reports only an instruction's
  total T-states, so where an access falls *within* an instruction is estimated,
  not known. This models the cycles a frame loses and the phase lock that follows
  from them; it does not make the Spectrum cycle-exact.
- **Any change to the vendored core.** `src/emulator/z80/z80core.js` stays
  byte-identical.

## Impact

- `src/dialects/zxspectrum/emulator/` — a new module holding the delay table, the
  two machines' display geometry and a clock that charges a bus access at a time;
  the machine's own bus callbacks wrapped so only the CPU's accesses pay it.
- `src/dialects/zxspectrum128/emulator/` — the same wiring, plus the paging-aware
  rule for which addresses its ULA contends.
- `src/emulator/machineLoop.ts` — `onSliceStart` is told the cycle position the
  slice opens at, which a machine timing its interrupt acknowledgement against
  the frame needs and which every other machine ignores.
- `src/reference/facts.ts` — both Spectrums' measured loop speeds, re-taken.
- `docs/reference/zxspectrum/hardware.md` — that the display hardware takes time
  from the processor, what it costs a program below 32768, and why multicolour
  effects depend on it.

The `Dialect` / `MachineEmulator` seam is untouched: this is internal to two
machines' emulators, and no caller sees it.
