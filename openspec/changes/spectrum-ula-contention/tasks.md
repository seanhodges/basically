## 1. The contention model, before it is wired to anything

- [x] 1.1 New module under `src/dialects/zxspectrum/emulator/`: the ULA's
      eight-T delay pattern, each machine's display geometry, the delay owed by
      an access begun at a given frame T-state, the 48K's contended-address rule,
      and a clock that charges a bus access at a time against a believed CPU
      position. Pure — no React, no DOM, no machine boot. State in the module
      comment why the estimate is enough (the grid the pattern quantises onto)
      and what is deliberately not modelled, rather than leaving either to be
      discovered.
- [x] 1.2 Colocated `*.test.ts`, both machines' geometry: the pattern repeats
      every eight T-states; only the fetched part of a display line is contended;
      the top border and everything past the last display line are free; the
      grid invariant holds for every T-state of the window; the four I/O shapes
      cost what the hardware makes them cost; and the display origin sits one
      T-state after the ULA takes the bus.

## 2. Wire it into the machines

- [x] 2.1 Widen the shared loop's `onSliceStart` to say which cycle position the
      slice opens at, and pin it in `machineLoop.test.ts`. The interrupt
      acknowledgement's stack push is contended, so the clock has to be placed
      before the interrupt is raised.
- [x] 2.2 48K: wrap the four bus callbacks (plus the M1 hook the core already
      offers), place the clock at each instruction boundary, fold the delay owed
      into the T-states the step returns so the frame budget, the scanline chase
      and the profiler all see it, derive `DISPLAY_START_T` from the contention
      window, and reset the clock — and the loop's carried overrun — with the
      machine. Replace the "not modelled" disclaimers with what is now true and
      what still is not.
- [x] 2.3 128K: the same wiring on its own geometry, plus a paging-aware
      contended-address rule on its memory (bank 5 always, the window at 0xC000
      when an odd bank is paged there), pinned in `memory128.test.ts`.
- [x] 2.4 Colocated test on the 48K: a fixed counting loop run for whole frames
      from contended RAM and from above 0x8000, showing the contended one gets
      meaningfully less done; the T-states charged accounting for the difference;
      and nothing charged for the host reading the machine.
- [x] 2.5 Check with `git status` that `src/emulator/z80/z80core.js` is
      unmodified. — clean; the M1 hook was already there.

## 3. The figures this moves

- [x] 3.1 Re-measure both Spectrums' loop speed and update the published facts.
      The loop-speed test's tolerance absorbs the shift in either direction, so
      passing is not evidence the figure is right — take it again.
- [x] 3.2 Check the boot-frame caps still have headroom now that boot needs more
      frames, and that run and debug-step stay identical
      (`src/dialects/debugEquivalence.test.ts`).
- [x] 3.3 Check the profiling batteries for pinned Spectrum figures and update
      any that hold one.

## 4. Docs

- [x] 4.1 `docs/reference/zxspectrum/hardware.md`: a Timing section on each of
      the 48K and 128K — the display hardware shares the lower 16K and holds the
      processor off while it draws, so code and data below 32768 run slower than
      the clock suggests; and that this sharing is what holds a multicolour
      routine in step with the beam. End-user page — describe the machine, not
      the source.
- [x] 4.2 `docs/contributing/dialect-roadmap.md`: a vendoring note for the Z80
      row recording that the core exposes no per-access T-state offset, so
      contention is charged adapter-side and the vendored `.js` stays
      byte-identical; and the two Spectrum status cells.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check`
- [x] 5.5 `npm run docs:build` (docs/ changes)
- [x] 5.7 `npm run e2e:chromium -- e2e/profiling` — 2 passed.
- [ ] 5.6 `npm run e2e:chromium -- e2e/program-execution` — 8 passed, 2 failed:
      `debug.spec.ts` "core flow: breakpoint, run-to-pause, step, continue,
      stop" and "debug session survives an orientation change", both failing at
      `page.goto('/')` before any machine runs. Both reproduce identically with
      this change stashed, so they are pre-existing in this environment and not
      caused by it — but the run did not pass, so this stays unchecked. The same
      two failed for the same reason on the C64 bad-line change.

## Notes

Measured while implementing, for whoever reads this next:

- **The reported listing.** Dominic Robinson's "Rainbow Processor", run headless
  and sampled a frame at a time down the leftmost lit column. Before: the number
  of distinct bands flips between eight and nine frame to frame and the edges
  appear, merge and vanish (`…24,25,26,27,28,29,30,32,33,40` one frame,
  `…22,24,25,26,27,28,29,30,32,40,42` the next) — the jumpiness the user
  reported. After: the band pattern is preserved exactly and translates one
  scanline at a time (`…29,30,32,33,35,43` → `…28,29,31,32,34,42` →
  `…27,28,30,31,33,41`). It creeps.
- A 34 T-state loop gets 1815 iterations a frame from above 0x8000 and 1596 from
  0x7000, and the machine reports 8345 T-states a frame taken by the ULA in the
  second case and none in the first — the ROM's own frame interrupt does touch
  contended system variables, but finishes long before the ULA starts fetching.
- Loop speed fell from 269 to 259 iterations/second on the 48K (3.7%) and from
  188 to 177 on the 128K (5.9%).
- Boot needs 86 frames against the 48K's cap of 200 and 58 against the 128K's
  400, so both keep ample headroom and neither cap moves.
- `lineProfiling.test.ts` needed its reclaim assertion widened from "exactly
  zero at a loop boundary" to "a negligible share of the run's reclaim". The
  reading got finer, not wronger — see design.md.
