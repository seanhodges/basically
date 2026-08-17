# Tasks

## 1. Measure the fall

- [x] 1.1 Add `reclaimed?: number` to `LineCost` beside `allocated`, present and
      absent with it, and say why the pair is reported rather than a signed total.
- [x] 1.2 Charge falls in `LineCostRecorder.chargeMemory` to the line that was
      executing, into their own map; drain and clear it with the rest.
- [x] 1.3 Update the colocated `lineCostRecorder.test.ts`: invert the test that
      asserted reclaims are dropped, cover a reclaim outside any BASIC line, and
      extend the two absence tests to both fields.

## 2. Account for it

- [x] 2.1 `LineAllocation` carries `bytes` and `reclaimed`; `AllocationShare` and
      `RoutineAllocation` carry both plus the net.
- [x] 2.2 Replace `totalAllocated` with `allocationTotals`, returning taken,
      reclaimed and net.
- [x] 2.3 Rank `lineAllocations` and `routineAllocations` by the absolute net,
      scale the share against the largest, and list a line that moved memory in
      either direction.
- [x] 2.4 Accumulate reclaims in `RunProfiler.frame`, spread falls in
      `spreadOverWindow`, and let `allocationAccount` treat a reclaim-only run as
      measured rather than falling through to the spread.
- [x] 2.5 Cover the above in the colocated `runProfile.test.ts`.

## 3. Report it

- [x] 3.1 Show the net per line and per routine in the profiler's Memory tab,
      drawing a reclaim in its own colour.
- [x] 3.2 Replace the prose disclosure with the three figures.
- [x] 3.3 Report the net and the pair it came from in the assistant's profile
      digest, keeping the flat-accounting sentence, and update its tests.

## 4. Say what it means

- [x] 4.1 Rewrite the memory paragraphs of `docs/guide/testing-programs.md`: the
      net rule, why both figures are shown, and falls in the approximate fallback.
- [x] 4.2 Record in `lineProfiling.test.ts` which line each ROM actually reclaims
      on, and assert only what holds on every machine.

## 5. Quality gates

- [x] 5.1 `npm run typecheck`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run lint` and `npm run format:check`
- [x] 5.4 `npm run docs:build`
- [x] 5.5 `npm run e2e:chromium -- e2e/profiling`
