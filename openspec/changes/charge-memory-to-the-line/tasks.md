## 1. Attribute at the line boundary

- [x] 1.1 Give `LineCostRecorder` an optional reader of the machine's in-use
      figure, and a per-line bytes map alongside the cycle map.
- [x] 1.2 In `sample`, on a change of executing line, take a reading and charge
      the rise since the previous reading to the line that just ended.
- [x] 1.3 Re-baseline without charging on a null line, on a null reading, on the
      first reading of a run, and on a fall.
- [x] 1.4 Emit the bytes on drained entries only once a real reading has landed,
      so an unattributable machine yields absence rather than zero.
- [x] 1.5 Reset the baseline in `clear`/`setEnabled` along with the maps.
- [x] 1.6 Add `src/emulator/lineCostRecorder.test.ts` cases: one per rule in
      1.2-1.5, plus a recorder constructed without a reader emitting no bytes.
- [x] 1.7 Add the optional bytes field to `LineCost` in `src/dialects/types.ts`,
      documenting that absence means the machine cannot attribute.

## 2. Wire the machines

- [x] 2.1 Pass the reader at each `new LineCostRecorder(...)` site: Commodore 64,
      PET, VIC-20, Amstrad, BBC, ZX80, ZX81, Spectrum, Spectrum 128.
- [x] 2.2 Hide the BBC's memory-figure reads from the memory-activity tap, as its
      line walk already does; this also fixes the existing live-RAM poll.
- [x] 2.3 Extend `src/dialects/lineProfiling.test.ts` with a string-building
      probe over every registered machine: the bytes must land on the line that
      builds and not on the line beside it.
- [x] 2.4 From 2.3, decide per machine whether attribution is honest. Measured
      on the real ROMs: no machine attributes workspace movement as allocation,
      and no machine needs excluding. What varies is the coverage of each
      machine's own in-use figure - the Acorns and Amstrads report a range a
      program's string churn happens outside of, so neither their memory chart
      nor the per-line reading can see it. Recorded as `NO_CHURN_IN_FIGURE` in
      the crosscheck test.
- [x] 2.5 Confirm `src/dialects/profileTransparency.test.ts` still passes, and
      re-measure the recorder's per-machine overhead so its documented figures
      stay true.

## 3. Accumulate and derive

- [x] 3.1 Fold the drained bytes into the run's accumulator in
      `src/app/runProfile.ts`, tracking whether any machine reading attributed.
- [x] 3.2 Add the allocation account to the published run profile, null where the
      machine cannot attribute.
- [x] 3.3 Factor the outline entry-point walk out of `routineShares` so the time
      and memory roll-ups share one implementation.
- [x] 3.4 Add the ranked per-line and per-routine byte derivations and the run's
      total charged bytes.
- [x] 3.5 Cover 3.1-3.4 in `src/app/runProfile.test.ts`, including a machine that
      reports no figures yielding a null account rather than an empty list.

## 4. Report it

- [x] 4.1 Add the memory-by-line section to `src/components/RunProfileDialog.tsx`
      and its stylesheet: bytes per line with a proportional bar, clickable to
      the line, then the routine roll-up.
- [x] 4.2 State the accounting under the list - flat, and gross of anything
      reclaimed afterwards.
- [x] 4.3 Say when the machine reports memory totals but cannot attribute them.
- [x] 4.4 Add the same reading to the assistant's profile description in
      `src/ai/driveTools.ts`, never as an empty list.
- [x] 4.5 Update `docs/guide/testing-programs.md`: what the profile lists, and
      the reclaim-stall paragraph now naming the line.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint`
- [x] 5.4 `npm run format:check`
- [x] 5.5 `npm run docs:build` (docs/ changed in 4.5)
- [x] 5.6 `npm run e2e:chromium -- e2e/profiling`, extending the existing
      heat-and-memory journey rather than adding a cold spec. Leave unchecked
      with a note if the run fails.
