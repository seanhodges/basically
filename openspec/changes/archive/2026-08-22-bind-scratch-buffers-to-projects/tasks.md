## 1. Bundle format

- [x] 1.1 Add `SerializedScratchBuffer` (`{ name: string; file: string }`) and an
      optional `scratch` field to `ProjectMetaV2` in `src/storage/projectFile.ts`,
      documenting on the field that it is additive (no version bump) and that
      entries are ordinal-named because scratch names are not unique
- [x] 1.2 Add a `scratchBuffers` parameter to `serializeProjectZip` (optional,
      defaulting to `[]`, after `bootDisc`), writing one `scratch/<ordinal>.bas`
      entry per buffer and omitting the metadata field when there are none
- [x] 1.3 Add `scratch` to `ParsedProject` and parse it in `parseProjectZip`,
      throwing on a malformed field or a missing referenced entry, in the style
      of the block and tape-file parsers
- [x] 1.4 Update the module header's zip-layout diagram to include `scratch/`
- [x] 1.5 Extend `src/storage/projectFile.test.ts`: round trip with buffers; two
      buffers sharing a name both survive; a bundle with no `scratch` field parses
      to none; a malformed `scratch` field throws

## 2. Autosave storage

- [x] 2.1 Add `mbide.autosave.scratch` to the `KEYS` map in
      `src/storage/settings.ts`
- [x] 2.2 Add a defensive `loadAutosaveScratch()` modelled on
      `loadAutosaveBlocks` (corrupt or non-array value yields `[]`, never throws)
- [x] 2.3 Thread scratch buffers through `loadAutosave`, `saveAutosave` and
      `clearAutosave`
- [x] 2.4 Extend `src/storage/settings.test.ts`: key round trip, corrupt-value
      tolerance, and that `clearAutosave` removes the key

## 3. Store persistence

- [x] 3.1 Include the scratch set in the autosave signature (both the seed from
      the boot document and the `sig` template in `persistAutosave`), with a
      comment noting a scratch-only edit must still trigger a write
- [x] 3.2 Write and clear the scratch key in `persistAutosave` independently of
      the `pristine` document-retention branch, with a comment on why buffers are
      not folded into the `pristine` predicate (it would resurrect a deliberately
      emptied named file)
- [x] 3.3 Hydrate `scratchBuffers` from the autosaved set at boot, re-minting ids
      as `scratch-<ordinal>` and giving each an empty breakpoint set
- [x] 3.4 Update the `ScratchBuffer` doc comment, which currently says
      session-only and never autosaved

## 4. Document lifecycle

- [x] 4.1 `createProject`: clear `scratchBuffers` (needed on top of
      `applyDialectSwitch`, which only clears on an actual dialect change)
- [x] 4.2 `openProject`: install the bundle's buffers, replacing whatever was
      open, so a bundle with none clears them
- [x] 4.3 `replaceDocument`: clear inside the existing `fileName !== undefined`
      branch only, so an in-place assistant apply leaves buffers alone; replace
      the "Scratch buffers survive an Open" comment
- [x] 4.4 `loadUnsavedDocument`: clear (sample and import paths); replace the
      matching "the workbench survives" comment
- [x] 4.5 Confirm `applyDialectSwitch` and the player boot clear are unchanged

## 5. File commands

- [x] 5.1 `saveDocument`: pass the store's scratch buffers to
      `serializeProjectZip`
- [x] 5.2 `installParsedProject`: pass the parsed buffers into `openProject`, and
      discard them in the unknown-dialect fallback (they hold code in a dialect
      the active machine does not speak)
- [x] 5.3 Extend `confirmDiscard` to also prompt when scratch buffers exist, with
      wording that names them
- [x] 5.4 Update `src/app/fileCommands.test.ts` — the "carries no scratch
      buffers" assertion inverts — and add a case for the discard guard firing on
      buffers alone

## 6. Store tests

- [x] 6.1 In `src/app/store.test.ts`'s `scratch buffers` describe, invert the
      autosave-exclusion assertion to prove buffers are autosaved
- [x] 6.2 Add lifecycle cases: new project clears; open project replaces; open
      plain source clears; sample and import clear; assistant apply keeps;
      machine switch still clears
- [x] 6.3 Add a boot-hydration case: autosaved buffers are restored with their
      names and contents and no breakpoints

## 7. Docs

- [x] 7.1 Update the "Scratch buffers" section of `docs/guide/writing-basic.md`:
      buffers now save and reopen with the project and are cleared when a new
      program is started. End-user wording only — no source paths, no internal
      symbols, and leave the VitePress sidebar untouched

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npm test`
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check` (or `npm run format` to fix)
- [x] 8.5 `npm run docs:build` (docs changed in group 7)
- [x] 8.6 `npm run e2e:chromium -- e2e/code-editor` — invert the reload step of
      `scratch-buffers.spec.ts`, which currently proves non-persistence, to prove
      survival
- [x] 8.7 `npm run e2e:chromium -- e2e/persistence` — extend the existing save
      round trip in `files.spec.ts` to cover buffers riding in the `.zip`, reusing
      `saveAsProject` from `e2e/helpers.ts`
- [x] 8.8 `npm run e2e:chromium -- e2e/project-setup` — creating a project now
      clears buffers
