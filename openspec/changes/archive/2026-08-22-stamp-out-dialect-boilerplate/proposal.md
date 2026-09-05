## Why

Four per-dialect modules are mostly the same file copied per machine:
`samples.ts` (the five-sample list is identical everywhere; only the
kaleido block address varies), `targets.ts` (the fatal-error guard appears
in twelve files, the filename-plus-Blob wrapping around thirty-five times,
the cassette-WAV target near-verbatim in eight), `aiProfile.ts` (the same
opening comment, section scaffold, and flush-left line-number rule restated
fifteen times — one prompt improvement is currently fifteen edits), and the
Microsoft-BASIC `loadProgram` recipe duplicated by the altair8800, pmd85,
and trs80 adapters. Shared factories shrink each new dialect's surface and
make cross-machine improvements one-file edits.

## What Changes

- `standardSamples()` helper: builds the canonical five-sample list from a
  dialect's sample sources plus an optional kaleido block descriptor;
  per-dialect `samples.ts` drops to the imports, the block constant, and
  the call.
- New `src/dialects/targetHelpers.ts`: `buildImageOrThrow()` (the shared
  fatal-errors and empty-program guard), `fileTarget(id, label, ext, build)`
  owning the `${programName.toLowerCase()}.${ext}` Blob wrapping, and
  `cassetteWavTarget()` for the eight dialects whose WAV target is
  textually identical.
- `composeAiProfile()`: owns the machine-independent scaffold (the OUTPUT
  FORMAT block, flush-left line-number rule, steps-of-10 tip, shared
  section headings); each dialect supplies only its machine notes and
  tricks. Composed prompt text stays byte-identical at migration time so
  `src/ai/promptStability.test.ts` ceilings hold.
- Shared Microsoft-BASIC program loader parameterised by
  `{ programBase, pointers, typeRun }` for the three adapters that repeat
  the write-image → fix pointers → type `RUN\r` recipe.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — pure refactor: same samples, same export targets and bytes, same
composed AI prompts, same program-loading behaviour. No spec deltas.

## Non-goals

- No new samples, targets, or prompt content; byte-for-byte outputs are the
  acceptance bar (existing colocated `samples.test.ts`, `targets` tests,
  and `promptStability.test.ts` are the proof).
- No changes to genuinely per-machine modules (`charset.ts`, `keywords.ts`,
  `tokenizer.ts`, `memoryMap.ts` stay hand-written flat tables by design).
- No merging of the four factories into one framework; they are independent
  helpers adoptable separately.

## Impact

- New helpers in `src/dialects/` (and `src/ai/` for the profile composer),
  each with a colocated test.
- Every `src/dialects/<name>/samples.ts`, `targets.ts`, `aiProfile.ts`
  shrinks; `altair8800`, `pmd85`, `trs80` emulator adapters share the
  loader.
- Guard rails: colocated dialect tests, `src/ai/promptStability.test.ts`,
  the sample-run recipe from `.claude/skills/authoring-dialect-samples/`,
  and the export-target tests.
