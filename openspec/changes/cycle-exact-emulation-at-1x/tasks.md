## 1. Pacing module

- [x] 1.1 Add `src/app/frameClock.ts`: an accumulator taking the tick timestamp,
      the machine's frame rate and the speed multiplier, returning how many
      frames to run; clamped to a small number of frame periods; resettable.
- [x] 1.2 Add `src/app/frameClock.test.ts` with a fake clock: 60 Hz ticks against
      a 50 Hz machine yield 50 frames per simulated second (not 60); 120 Hz ticks
      also yield 50; a non-integer rate (50.125 Hz) yields 50 or 51; the speed
      multiplier scales the count linearly; a multi-second stall is clamped;
      reset discards banked time.

## 2. Seam

- [x] 2.1 `src/dialects/types.ts`: add `readonly frameHz` to `MachineEmulator`,
      remove `setSpeed`, and correct the `runFrame` and `readAudio` doc comments
      that hardcode 50 Hz.
- [x] 2.2 Implement `frameHz` on every machine registered in
      `src/dialects/registry.ts` and delete its `setSpeed` method and `speed`
      field, including the speed factor in each `debugStep` budget. The Amstrad's
      is a getter derived from its CRTC line count; the Altair and the TRS-80
      interpreter declare a scheduling convention with a comment saying so.
- [x] 2.3 Drop the workarounds that existed only because speed lived on the
      machine: the Altair's fixed-speed boot, and the deferred `setSpeed` calls
      in the machine tests' load handshakes.
- [x] 2.4 Add a registry-driven `frameHz` test asserting every registered
      dialect's machine reports a finite rate matching its documented hardware
      value.

## 3. Run loop

- [x] 3.1 Drive `src/components/EmulatorPane.tsx`'s tick from the pacing module:
      pass the animation-frame timestamp (and `performance.now()` on the
      hidden-tab path), run the frames it returns, and keep rendering once per
      tick.
- [x] 3.2 Move the audio pump inside the frame loop so it runs once per emulated
      frame rather than once per tick.
- [x] 3.3 Reset the pacing state wherever the loop stops, so a pause does not
      bank elapsed time - including while the assistant holds the machine, where
      the time it is held is not owed either.
- [x] 3.5 Pace the debug-slice branch from the same frame count.

      Not in the original plan, and the reason it was missed is worth recording:
      the slice branch reads as an exceptional path, but a debug session opens on
      every Play for any machine that models line debugging, so on those machines
      it *is* the ordinary run and the frame branch never executes at all. Pacing
      only the frame branch left most of the registered machines running at the
      display's rate. Caught by the end-to-end timing test failing at exactly
      1.2x, then by instrumenting the loop in a browser.
- [x] 3.4 Convert the assistant run-check's frames-per-tick batch in
      `src/app/aiRunCheck.ts` into a speed multiplier fed to the same
      accumulator, leaving its frame-counted windows unchanged.

## 4. Per-machine cycle accuracy

- [x] 4.1 Carry per-frame overshoot as debt in the instruction-stepped machines
      (both Spectrums, ZX81, ZX80, Altair, Amstrad, and the unregistered TRS-80
      Z80 machine), in `runFrame` and `debugStep` alike. Zero the debt on the
      Sinclair halt path rather than recording a negative one; carry the
      Amstrad's across scanlines and frames, not per scanline.
- [x] 4.2 Correct the ZX81 and ZX80 per-frame budget and the VIC-20's, with
      comments naming the derivation, and spot-check the remaining machines'
      budgets against hardware.

      The Sinclair figure is 312 × 208, not 312 × 207: the scanline is 64 µs at
      3.25 MHz, which is exactly 208 T-states, and the machine's own NMI
      constant already said so. The VIC-20's is 312 × 71 as planned.

- [x] 4.3 Add colocated assertions for the machines that gained a debt field.

      Not the planned "assert the debt field is small and non-negative" - that
      passes whether the overrun is carried, discarded, or carried with the sign
      reversed, because the field stays small and positive in all three. What
      distinguishes them is the work done per frame, so both tests count
      iterations of a loop whose cost does not divide the frame budget evenly:
      the Amstrad reaches 173 iterations in a frame where discarding gives 178
      and reversing the sign 181, and the Altair 64445 over 29 frames against
      64453 and 64466. The halt rule is still asserted on the debt field, where
      the alternative is a whole frame's worth and unmistakable.

## 5. Audio

- [x] 5.1 Report each machine's `audioSampleRate` as the samples it emits per
      frame times its frame rate, leaving the per-frame sample counts alone.

      The Acorn pair needed no change: jsbeeb's sound chip generates samples off
      the CPU cycle count rather than a fixed count per frame, so its rate was
      already the rate it emits at - what was wrong there was only how often the
      host called it, which task 3 fixes.

- [x] 5.2 Update the colocated audio tests that assert a nominal rate.

## 6. Documentation

- [x] 6.1 Update the emulation-layer section of
      `docs/contributing/architecture.md`, which describes `runFrame()` as one
      50 Hz frame and lists `setSpeed()` on the seam.

## 7. Quality gates

- [x] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`.
- [x] 7.2 Add one end-to-end spec under `e2e/program-execution/` that times a
      program against a machine's own clock over a few real seconds, with a
      comment recording that only a real browser exercises animation-frame
      pacing at an actual refresh rate. Assert the lower bound tightly (the bug
      under repair makes emulation run fast) and the upper bound loosely.

      It times the mean of five intervals rather than one. A single interval is
      measured between two poll hits, and a poll delayed by the other worker
      starting a page moves one endpoint by most of a second - which was enough
      to read a correctly-paced run as a fast one, and did, until the same run
      measured alone came back at 5.03s for 5 emulated seconds.

- [x] 7.3 `npm run e2e:chromium -- e2e/program-execution`.
- [x] 7.4 Sweep the rest of the suite with `npm run e2e:chromium`, checking for
      specs that newly approach their timeout now that emulation no longer runs
      20% fast — not only for outright failures.

      143 passed, none flaky, 4.1 minutes. Nothing came close to a timeout: the
      specs that drive a machine wait on what the screen shows rather than on a
      frame count, so a fifth less emulated time per second costs them a fifth
      of a short wait, not a whole budget.
