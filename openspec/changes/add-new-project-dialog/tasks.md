## 1. Dialect metadata

- [x] 1.1 Add required `manufacturer: string`, `year: number` and `blurb: string` to the `Dialect` interface in `src/dialects/types.ts`, with doc comments explaining they drive the new-project machine picker
- [x] 1.2 Update the `Dialect.samples` doc comment in `src/dialects/types.ts` to drop "the first is the starter shown for a fresh document"
- [x] 1.3 Fill in the three fields for every dialect registered in `src/dialects/registry.ts`, deriving each blurb from that machine's `docs/reference/<machine>/hardware.md` page and verifying every year against a primary source (never from memory)
- [x] 1.4 Update the header comment in each dialect's `samples.ts` that calls `samples[0]` the starter
- [x] 1.5 Add a colocated test asserting every registered dialect carries a non-empty manufacturer, a plausible year and a non-empty blurb, so a future dialect cannot omit them

## 2. Remove the starter-sample concept

- [x] 2.1 Simplify `initialDocument()` in `src/app/store.ts` to "restore autosave, else an empty untitled document", dropping its `starterText` and `launchedBefore` parameters and their call site
- [x] 2.2 Remove the starter load from `setDialect`'s empty-editor branch in `src/app/store.ts` so switching machine with an empty editor just switches
- [x] 2.3 Change `setDialect`'s pristine-sample branch to fall back to an empty document instead of the new machine's starter when no same-named sample exists
- [x] 2.4 Remove `getHasLaunched`/`setHasLaunched` and the `hasLaunched` key from `src/storage/settings.ts`, the `setHasLaunched` call and import from `src/App.tsx`, and the covering cases in `src/storage/settings.test.ts`
- [x] 2.5 Update `initialDocument`'s colocated tests to drop the starter cases and assert an empty document regardless of prior launches
- [x] 2.6 Add store tests: `setDialect` on an empty editor leaves it empty; a pristine sample with no counterpart on the new machine yields an empty document

## 3. Project creation in the store

- [x] 3.1 Add `createProject({ dialectId, source, fileName, blocks? })` to `src/app/store.ts`, built on `applyDialectSwitch` and setting `fileName`, `dirty: false` and blocks before `persistAutosave()`
- [x] 3.2 Add the `newProjectOpen` flag and its setter to the store
- [x] 3.3 Exclude an *untouched named* document (`fileName !== UNTITLED_FILE_NAME && !dirty`) from `persistAutosave`'s pristine test, so a named project keeps its name while a named file the user deliberately emptied (left dirty by `setSource`) still clears
- [x] 3.4 Change `newDocument()` in `src/app/fileCommands.ts` to run `confirmDiscard()` and then open the dialog, so the confirm never stacks under a modal
- [x] 3.5 Add `src/app/newProject.test.ts` covering: creation on a non-active machine switches dialect and installs source, name and `dirty === false`; a named blank survives `persistAutosave` while an unnamed blank still clears it; a sample bundling machine code arrives with its block materialized; creation never sets `pendingDialectId`

## 4. Shared AI credentials helper

- [x] 4.1 Extract the private `aiCredentials()` helper from `src/components/DocsDrawer.tsx` into `src/ai/credentials.ts`, keeping its behaviour of opening AI settings when no key is set
- [x] 4.2 Point `DocsDrawer.tsx` at the shared helper

## 5. The New project dialog

- [x] 5.1 Create `src/components/NewProjectDialog.tsx` and `.module.css` following the existing modal pattern (shared `Dialog.module.css`, self-gating on the store flag), mirroring `WelcomeDialog.tsx` for structure
- [x] 5.2 Build the machine picker: group registered dialects by `manufacturer`, show each machine's name and year, and show the selected machine's blurb
- [x] 5.3 Add the project name field, defaulting to empty and yielding an untitled document when left blank
- [x] 5.4 Add the starting-point control — Blank, Sample (a list of the *selected* machine's samples by title, reset to the first when the machine changes), and Describe it
- [x] 5.5 Wire Create: call `createProject` once with the chosen machine, source and name, materializing sample blocks via `materializeSampleBlocks` from `src/app/sampleBlocks.ts`
- [x] 5.6 Wire the Describe-it path: create the project blank, then `showAiPanel()` and `useAiStore.send()` with the dialect's system prompt, following the hand-off in `DocsDrawer.tsx`
- [x] 5.7 Disable the Describe-it option when no API key is set, with a plain note (not a link) that the AI assistant must be configured in settings before the option becomes available; read key presence once when the dialog opens, since it cannot change while the dialog is up
- [x] 5.8 Pre-select the active machine and Blank on open, and support Escape to cancel, Enter to create, and autofocus on the name field
- [x] 5.9 Mount `<NewProjectDialog />` in `src/App.tsx` alongside the other dialogs
- [x] 5.10 Add a test covering the gate: with no key the Describe-it option is disabled and carries the note, and the other starting points still work; with a key set it is selectable

## 6. Retire File ▸ Samples and chain the welcome

- [x] 6.1 Remove the Samples section, the `loadSample` helper and the now-unused `materializeSampleBlocks` and `SampleFile` imports from `src/components/Toolbar.tsx`
- [x] 6.2 Change the "Start coding" card in `src/components/WelcomeDialog.tsx` to dismiss and open the New project dialog

## 7. Repair existing tests

- [x] 7.1 Add a shared `createProjectWithSample(page, machine, title)` helper to `e2e/fixtures.ts` (or `e2e/plan/helpers.ts`) that drives the new dialog
- [x] 7.2 Rewrite `e2e/plan/section03-emulator.spec.ts` test 3.1 to create a project from a sample per machine, and confirm the canvas-painted assertion still exercises a real program rather than an empty one
- [x] 7.3 Update `e2e/plan/section01-boot-storage.spec.ts` for a first launch that shows the welcome dialog over an *empty* editor
- [x] 7.4 Update `loadMazeSample` in `e2e/outline.spec.ts` to use the shared helper
- [x] 7.5 Update `loadSample` and the pristine-sample comment in `e2e/capture-docs-screenshots.spec.ts` to use the shared helper
- [x] 7.6 Add `e2e/new-project.spec.ts`: File ▸ New → choose a different machine and a sample → Create → editor holds the sample and the toolbar target reflects the machine; plus `Ctrl+N` then Enter → empty editor, machine unchanged

## 8. Documentation

- [x] 8.1 Rewrite the opening walkthrough in `docs/guide/getting-started.md` around New project → choose machine → choose sample, replacing the File ▸ Samples ▸ Breakout step, and document naming a project and starting from a description
- [x] 8.2 Update the File ▸ Samples reference in `docs/guide/machine-code.md`
- [x] 8.3 Update the File ▸ Samples quick-check in `docs/contributing/contributing.md`
- [x] 8.4 Add the New project dialog to the dialog inventory in `docs/contributing/architecture.md` and correct its description of the first-launch behaviour
- [x] 8.5 Regenerate the docs screenshots and review the output for stale UI

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm test`
- [x] 9.3 `npm run lint`
- [x] 9.4 `npm run format:check` (or `npm run format`)
- [x] 9.5 `npm run docs:build`
- [ ] 9.6 `npm run e2e`
- [x] 9.7 `npx openspec validate --specs`
