## 1. The bus arbitration, before it is wired to anything

- [x] 1.1 New module under `src/emulator/c64/` deciding, per cycle, whether the
      VIC-II has the bus: a cycle-within-line counter it advances itself, the
      raster line / vertical scroll / display-enable read from the chip once per
      line, the hardware bad-line rule (inside the display window, display
      enabled, low three raster bits matching the scroll), and the forty-cycle
      character-fetch window. Pure — no React, no DOM, no machine boot. State the
      lockstep invariant it depends on, and that sprite DMA is not modelled, in
      the module comment rather than leaving either to be discovered.
- [x] 1.2 Colocated `*.test.ts`: twenty-five bad lines and one thousand stalled
      cycles in a default frame; the stall is forty contiguous cycles in the
      right part of the line; each vertical scroll value 0–7 selects a different
      set of lines; display disabled yields none; the first and last lines of the
      display window are included.

## 2. Wire it into the machine

- [x] 2.1 The C64 adapter's tick path skips both the CPU tick and the KERNAL trap
      check on a stalled cycle, and still ticks the video, CIA, sound and tape
      components and still charges the cycle to the running BASIC line. Reset the
      clock wherever the chip resets.
- [x] 2.2 Declare the VIC's register read on the vendored core's hand-written
      declaration file. Every `.js` file under the vendored directory stays
      byte-identical — check with `git status` that none has been modified.
- [x] 2.3 Colocated test on the machine: one frame advances the chip's raster
      register by a whole frame of lines and reports one thousand stalled cycles.
      This is the lockstep invariant, and the test that fails first if a later
      change ticks the video chip somewhere other than the tick path.
- [x] 2.4 Confirm the boot cycle cap still has margin now that boot needs ~5%
      more cycles, and that run and debug-step remain identical
      (`src/dialects/debugEquivalence.test.ts`).

## 3. The figures this moves

- [x] 3.1 Re-measure the C64's loop speed and update the published fact. The
      loop-speed test's tolerance absorbs the shift in either direction, so
      passing is not evidence the figure is right — take it again.
- [x] 3.2 Check the profiling tests for pinned C64 cycle counts and update any
      that hold one.

## 4. Docs

- [x] 4.1 `docs/reference/commodore/hardware.md`: the video chip takes about a
      thousand cycles a frame from the CPU, so a counting-loop delay runs slower
      than the raw clock suggests; and this C64 is a PAL machine, so raster code
      timed for a 60 Hz one will not look as its author intended. End-user page —
      describe the machine, not the source.
- [x] 4.2 Update the vendored-core note in `docs/contributing/dialect-roadmap.md`
      to record that the missing BA line is now handled adapter-side.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check`
- [x] 5.5 `npm run docs:build` (docs/ changes)
- [ ] 5.6 `npm run e2e:chromium -- e2e/program-execution` — 8 passed, 2 failed:
      `debug.spec.ts` "core flow: breakpoint, run-to-pause, step, continue,
      stop" and "debug session survives an orientation change", both failing at
      `page.goto('/')` before any machine runs. Both reproduce identically with
      this change stashed, so they are pre-existing in this environment and not
      caused by it — but the run did not pass, so this stays unchecked.

## Notes

Measured while implementing, for whoever reads this next:

- A booted C64 surrenders exactly 1000 cycles a frame, and the chip's raster
  register returns to where it started after a frame — the lockstep invariant
  holds on the real machine, not just in the unit tests.
- Boot needs ~2.24M cycles against the 4M cap, so ~44% headroom remains.
- The C64's loop speed fell from 771 to 726 iterations/second (5.8%, as
  predicted). The VIC-20 `extends` the C64 and had been *inheriting* that
  figure, which quietly put its own measurement 22% out and failed its test; it
  now states its own measured 886, as the PET already did.
