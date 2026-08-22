## Context

Four per-dialect modules are near-clones across the registry:

- `samples.ts`: every dialect ships the same five samples with the same
  names and titles; the only real data is the optional kaleido
  machine-code block's address/entry.
- `targets.ts`: the fatal-error guard (`fatalErrors(errors)` + throw +
  empty-program check) appears in twelve files; the
  `${programName.toLowerCase()}.<ext>` Blob wrapping ~35 times; the
  cassette-WAV target near-verbatim in eight.
- `aiProfile.ts`: fifteen files open with the same comment, use the same
  section scaffold, and restate the same machine-independent instructions
  (OUTPUT FORMAT, flush-left line numbers, steps of 10) — a prompt
  improvement is fifteen edits, and drift between copies has already
  produced contradictory guidance once (the PAUSE-unit episode).
- The Microsoft-BASIC program-load recipe (write image at the program
  base → fix the interpreter's pointers → type `RUN\r`) is duplicated by
  the altair8800, pmd85, and trs80 adapters.

## Goals / Non-Goals

**Goals:**

- Each of the four becomes a parameterised helper plus per-dialect data;
  cross-machine improvements become one-file edits.
- Byte-identical outputs at migration time: same sample lists, same export
  bytes and filenames, same composed prompts, same load behaviour.

**Non-Goals:**

- No change to the Dialect/MachineEmulator seam: `samples`, `buildTargets`,
  and `aiProfile` keep their existing types on `Dialect`; the helpers build
  the same values inside the dialect folders. The MS-BASIC loader is
  internal to the three adapters.
- No content changes (new samples, new targets, prompt rewrites) riding
  along; those are separate changes once the seams exist.
- No umbrella framework tying the four helpers together — they are
  independently adoptable, and a dialect with a genuinely different shape
  (e.g. zx81's kaleido riding in a `#BIN` REM instead of a block) uses the
  helper's escape hatch or skips it.

## Decisions

- **`standardSamples()` in `src/dialects/sampleKit.ts`** (name final at
  implementation): takes the five imported `.bas` sources plus an optional
  kaleido block descriptor, returns the `Dialect.samples` array. Dialects
  with a sample-set deviation keep hand-building that entry; the helper
  accepts per-sample overrides rather than growing flags. The
  `authoring-dialect-samples` skill is updated to describe the helper.
- **`src/dialects/targetHelpers.ts`**: `buildImageOrThrow(tokenized)` for
  the shared guard, `fileTarget(id, label, ext, build)` owning filename +
  Blob, `cassetteWavTarget(buildSamples, sampleRate)` for the common WAV
  shape. Existing per-dialect target tests pin ids, labels, extensions, and
  output bytes, so migration is mechanical and proven.
- **`composeAiProfile()` in `src/ai/`**: owns the shared scaffold and
  section order; a dialect passes its machine notes and performance tricks.
  The migration bar is byte-identical composed prompt text per dialect
  (assert once during migration against the pre-change composition), so
  `src/ai/promptStability.test.ts` ceilings and the prompt-caching prefix
  behaviour are provably untouched. After migration, shared-text
  improvements are made deliberately, in one place, with the ceilings as
  the guard. Alternative considered: leaving aiProfile alone because prompt
  text is sensitive — rejected; the byte-identical bar makes the refactor
  inert, and the fifteen-way drift is itself the demonstrated risk.
- **`loadMicrosoftBasicProgram()` shared by the three MS-BASIC adapters**,
  parameterised by `{ programBase, pointers, typeRun }`. It lives in
  `src/emulator/` beside the other shared machine plumbing
  (`memoryActivityBuffer.ts` et al.). Each adapter's colocated boot/run
  tests (real ROMs) prove the swap.

## Risks / Trade-offs

- [A "same-looking" copy hides a real per-machine difference] → Migrate one
  dialect per commit per helper; colocated tests pin outputs, and any
  needed helper flag is a signal to leave that dialect hand-written
  instead.
- [Prompt-text regressions are invisible to eyeballs] → The byte-identical
  assertion during migration plus `promptStability.test.ts` make drift a
  test failure, not a review judgement.
- [Helper APIs ossify a shape a future machine won't fit] → Helpers are
  escape-hatch-first: a dialect can always hand-write the module; the
  helpers exist to make the common case cheap, not to be mandatory.

## Migration Plan

Helpers land with their own tests first, then adoption dialect-by-dialect
(each commit green on the full quality gate). The four helpers are
independent; partial adoption is an acceptable end state for any of them.
