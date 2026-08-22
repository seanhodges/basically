## 1. The loop helper

- [x] 1.1 Add `src/emulator/machineLoop.ts`: `createMachineLoop(contract)`
      returning `{ runFrame, debugStep }`, owning cycle-debt carry-over,
      breakpoint arming, budget walk, and the once-per-slice `onSlice` hook
- [x] 1.2 Colocated `machineLoop.test.ts`: debt carry-over across frames,
      arming from `fromLine`, budget exhaustion mid-instruction, `onSlice`
      fires exactly once per `runFrame` and per `debugStep`, step errors
      surface unchanged

## 2. Migrate the self-contained Z80 family

- [x] 2.1 zx80, zx81, zxspectrum, zxspectrum128 adapters onto the helper,
      deleting their copied loops; full suite green with no tolerance
      changes (`debugEquivalence`, `lineProfiling`, colocated tests)

## 3. Migrate the 8080 pair

- [x] 3.1 pmd85 and altair8800 adapters onto the helper; their colocated
      ROM-booting tests and the registry batteries green

## 4. Migrate the 6502 and wrapped-core machines

- [ ] 4.1 pet, vic20, c64 (tickOnce seam) onto the helper
- [ ] 4.2 cpc onto the helper
- [ ] 4.3 bbc and atom (jsbeeb) onto the helper, or document in the module
      why a wrapped core keeps its own loop if its step unit cannot satisfy
      the contract honestly

## 5. Docs and quality gates

- [ ] 5.1 Update `docs/contributing/architecture.md` to point at the helper
      instead of prescribing "one step function both paths call" in prose
- [ ] 5.2 `npm run typecheck && npm test && npm run lint && npm run format:check`
      (and `npm run docs:build` for the docs edit)
- [ ] 5.3 `npm run e2e:chromium -- e2e/program-execution` (run/debug path is
      app-visible)
