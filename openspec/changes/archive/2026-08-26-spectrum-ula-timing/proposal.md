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
- The frame interrupt is **held open for the window the ULA holds it**, rather
  than offered for a single instant. A routine with interrupts briefly off as
  the frame turns over keeps its interrupt, as it does on the machine, instead of
  losing the whole frame's handler — and a frame whose handler never ran is a
  frame a screen effect skipped.
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

- **The +2A/+3.** Their ULA contends on a different pattern from the 128K's, and
  they page through a fourth port and a four-ROM set. Neither is a machine this
  project emulates — the 128K dialect's hardware is a 128K / grey +2, and 128
  BASIC is the same language on all of them. The right response is not to model a
  second pattern but to stop implying the machine is a +3, which the roadmap did.
  A +2A/+3 is a machine's worth of work, and belongs with the target-system
  workflow rather than here.

- **The floating bus.** Reading an unclaimed port still returns 0xFF rather than
  whatever the ULA has in flight, so the floating-bus raster-sync trick remains
  unavailable. This was investigated properly rather than deferred on principle,
  and three things stop it being implementable to a standard worth shipping:

  1. **The phase is not settled across sources.** Contention's origin is
     unambiguous and agreed — the 6,5,4,3,2,1,0,0 pattern starts 14335 T-states
     after the interrupt on a 48K and 14361 on a 128K, and repeats every 224 and
     228. The floating-bus tables are quoted against a different origin: 14347
     and 14368 for the first fetch of the first row. Those are 12 and 7 T-states
     past their machines' contention origins respectively — an inconsistency the
     sources do not resolve, and 12 T-states is three character columns.
  2. **The idle slots are not simply 0xFF.** The four fetch T-states of each
     eight carry bitmap, attribute, bitmap+1, attribute+1; the other four are
     documented as holding the last value read from or written to contended
     memory, not a clean 0xFF. Modelling one without the other gives a program a
     bus that changes in the wrong places.
  3. **Machines themselves disagree.** Published tables note that every figure
     moves by one T-state on "late timing" machines.

  A floating bus built on an unresolved phase is worse than none: a program would
  appear to sync and then paint several columns off, which is a subtler failure
  than not syncing at all. What would unblock it is a single source stating the
  fetch offsets and the contention origin in one convention, plus a decision on
  which timing variant this machine is. The contention module already supplies
  the line-and-column decomposition such an implementation would need.

- **Cycle-exact contention.** The vendored Z80 core reports only an instruction's
  total T-states, so where an access falls *within* an instruction is estimated
  (see design.md). Prefix bytes are charged as data reads rather than second
  opcode fetches, internal cycles are invisible, and memory-refresh contention is
  not modelled. Closing this needs per-M-cycle timing out of the CPU, which means
  forking or replacing `src/emulator/z80/`, and that core is shared with six
  other machines. This models the cycles a frame loses and the phase lock that
  follows from them; it does not make the Spectrum cycle-exact, and a hand-timed
  stable raster still will not be.

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
- `docs/contributing/dialect-roadmap.md` — that the 128K dialect's hardware is a
  128K / grey +2, and that the +2A and +3 are not emulated.
- `src/reference/facts.ts` — both Spectrums' measured loop speeds, re-taken.
- `docs/reference/zxspectrum/hardware.md` — that the display hardware takes time
  from the processor, what it costs a program below 32768, and why multicolour
  effects depend on it.

The `Dialect` / `MachineEmulator` seam is untouched: this is internal to two
machines' emulators, and no caller sees it.
