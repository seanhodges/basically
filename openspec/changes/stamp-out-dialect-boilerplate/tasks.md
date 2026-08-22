## 1. Sample kit

- [x] 1.1 Add `standardSamples()` (+ colocated test) building the canonical
      five-sample list from imported sources and an optional kaleido block
      descriptor, with per-sample overrides as the escape hatch
- [x] 1.2 Migrate every non-variant dialect's `samples.ts`; colocated
      `samples.test.ts` files unchanged and green; update the
      `authoring-dialect-samples` skill's samples.ts shape section

## 2. Target helpers

- [ ] 2.1 Add `src/dialects/targetHelpers.ts`: `buildImageOrThrow`,
      `fileTarget`, `cassetteWavTarget`, with a colocated test
- [ ] 2.2 Migrate the twelve `targets.ts` files with the shared guard and
      the eight with the common WAV target; per-dialect target tests pin
      ids, labels, extensions, and output bytes unchanged

## 3. AI profile composer

- [ ] 3.1 Add `composeAiProfile()` in `src/ai/` owning the shared scaffold
      (OUTPUT FORMAT block, flush-left line-number rule, steps-of-10 tip,
      section headings), with a colocated test
- [ ] 3.2 Migrate all fifteen `aiProfile.ts` files with a byte-identical
      assertion against the pre-change composed text (assertion removed
      once migration lands); `src/ai/promptStability.test.ts` ceilings
      unchanged

## 4. Microsoft-BASIC loader

- [ ] 4.1 Add `loadMicrosoftBasicProgram()` in `src/emulator/`
      parameterised by `{ programBase, pointers, typeRun }`, with a
      colocated test
- [ ] 4.2 Migrate the altair8800, pmd85, and trs80 adapters; their
      ROM-booting colocated tests green

## 5. Quality gates

- [ ] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 5.2 `npm run e2e:chromium -- e2e/hardware-transfer` (export targets
      are app-visible) and `npm run e2e:chromium -- e2e/ai-assistant`
      (composed prompts feed the assistant)
