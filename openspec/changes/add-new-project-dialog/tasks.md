## 1. Dialect metadata

- [ ] 1.1 Add required `manufacturer: string`, `year: number` and `blurb: string` to the `Dialect` interface in `src/dialects/types.ts`, with doc comments explaining they drive the new-project machine picker
- [ ] 1.2 Update the `Dialect.samples` doc comment in `src/dialects/types.ts` to drop "the first is the starter shown for a fresh document"
- [ ] 1.3 Fill in the three fields for every dialect registered in `src/dialects/registry.ts`, deriving each blurb from that machine's `docs/reference/<machine>/hardware.md` page and verifying every year against a primary source (never from memory)
- [ ] 1.4 Update the header comment in each dialect's `samples.ts` that calls `samples[0]` the starter
- [ ] 1.5 Add a colocated test asserting every registered dialect carries a non-empty manufacturer, a plausible year and a non-empty blurb, so a future dialect cannot omit them

## 2. Remove the starter-sample concept

- [ ] 2.1 Simplify `initialDocument()` in `src/app/store.ts` to "restore autosave, else an empty untitled document", dropping its `starterText` and `launchedBefore` parameters and their call site
- [ ] 2.2 Remove the starter load from `setDialect`'s empty-editor branch in `src/app/store.ts` so switching machine with an empty editor just switches
- [ ] 2.3 Change `setDialect`'s pristine-sample branch to fall back to an empty document instead of the new machine's starter when no same-named sample exists
- [ ] 2.4 Remove `getHasLaunched`/`setHasLaunched` and the `hasLaunched` key from `src/storage/settings.ts`, the `setHasLaunched` call and import from `src/App.tsx`, and the covering cases in `src/storage/settings.test.ts`
- [ ] 2.5 Update `initialDocument`'s colocated tests to drop the starter cases and assert an empty document regardless of prior launches
- [ ] 2.6 Add store tests: `setDialect` on an empty editor leaves it empty; a pristine sample with no counterpart on the new machine yields an empty document

## 3. Project creation in the store

- [ ] 3.1 Add `createProject({ dialectId, source, fileName, blocks? })` to `src/app/store.ts`, built on `applyDialectSwitch` and setting `fileName`, `dirty: false` and blocks before `persistAutosave()`
- [ ] 3.2 Add the `newProjectOpen` flag and its setter to the store
- [ ] 3.3 Add the `fileName === UNTITLED_FILE_NAME` conjunct to `persistAutosave`'s pristine test so a named project keeps its name
- [ ] 3.4 Change `newDocument()` in `src/app/fileCommands.ts` to run `confirmDiscard()` and then open the dialog, so the confirm never stacks under a modal
- [ ] 3.5 Add `src/app/newProject.test.ts` covering: creation on a non-active machine switches dialect and installs source, name and `dirty === false`; a named blank survives `persistAutosave` while an unnamed blank still clears it; a sample bundling machine code arrives with its block materialized; creation never sets `pendingDialectId`

## 4. Shared AI credentials helper

- [ ] 4.1 Extract the private `aiCredentials()` helper from `src/components/DocsDrawer.tsx` into `src/ai/credentials.ts`, keeping its behaviour of opening AI settings when no key is set
- [ ] 4.2 Point `DocsDrawer.tsx` at the shared helper

## 5. The New project dialog

- [ ] 5.1 Create `src/components/NewProjectDialog.tsx` and `.module.css` following the existing modal pattern (shared `Dialog.module.css`, self-gating on the store flag), mirroring `WelcomeDialog.tsx` for structure
- [ ] 5.2 Build the machine picker: group registered dialects by `manufacturer`, show each machine's name and year, and show the selected machine's blurb
- [ ] 5.3 Add the project name field, defaulting to empty and yielding an untitled document when left blank
- [ ] 5.4 Add the starting-point control — Blank, Sample (a list of the *selected* machine's samples by title, reset to the first when the machine changes), and Describe it
- [ ] 5.5 Wire Create: call `createProject` once with the chosen machine, source and name, materializing sample blocks via `materializeSampleBlocks` from `src/app/sampleBlocks.ts`
- [ ] 5.6 Wire the Describe-it path: create the project blank, then `showAiPanel()` and `useAiStore.send()` with the dialect's system prompt, following the hand-off in `DocsDrawer.tsx`; when no API key is set, still create the project and open AI settings
- [ ] 5.7 Pre-select the active machine and Blank on open, and support Escape to cancel, Enter to create, and autofocus on the name field
- [ ] 5.8 Mount `<NewProjectDialog />` in `src/App.tsx` alongside the other dialogs

## 6. Retire File ▸ Samples and chain the welcome

- [ ] 6.1 Remove the Samples section, the `loadSample` helper and the now-unused `materializeSampleBlocks` and `SampleFile` imports from `src/components/Toolbar.tsx`
- [ ] 6.2 Change the "Start coding" card in `src/components/WelcomeDialog.tsx` to dismiss and open the New project dialog

## 7. Repair existing tests

- [ ] 7.1 Add a shared `createProjectWithSample(page, machine, title)` helper to `e2e/fixtures.ts` (or `e2e/plan/helpers.ts`) that drives the new dialog
- [ ] 7.2 Rewrite `e2e/plan/section03-emulator.spec.ts` test 3.1 to create a project from a sample per machine, and confirm the canvas-painted assertion still exercises a real program rather than an empty one
- [ ] 7.3 Update `e2e/plan/section01-boot-storage.spec.ts` for a first launch that shows the welcome dialog over an *empty* editor
- [ ] 7.4 Update `loadMazeSample` in `e2e/outline.spec.ts` to use the shared helper
- [ ] 7.5 Update `loadSample` and the pristine-sample comment in `e2e/capture-docs-screenshots.spec.ts` to use the shared helper
- [ ] 7.6 Add `e2e/new-project.spec.ts`: File ▸ New → choose a different machine and a sample → Create → editor holds the sample and the toolbar target reflects the machine; plus `Ctrl+N` then Enter → empty editor, machine unchanged

## 8. Documentation

- [ ] 8.1 Rewrite the opening walkthrough in `docs/guide/getting-started.md` around New project → choose machine → choose sample, replacing the File ▸ Samples ▸ Breakout step, and document naming a project and starting from a description
- [ ] 8.2 Update the File ▸ Samples reference in `docs/guide/machine-code.md`
- [ ] 8.3 Update the File ▸ Samples quick-check in `docs/contributing/contributing.md`
- [ ] 8.4 Add the New project dialog to the dialog inventory in `docs/contributing/architecture.md` and correct its description of the first-launch behaviour
- [ ] 8.5 Regenerate the docs screenshots and review the output for stale UI

## 9. Quality gates

- [ ] 9.1 `npm run typecheck`
- [ ] 9.2 `npm test`
- [ ] 9.3 `npm run lint`
- [ ] 9.4 `npm run format:check` (or `npm run format`)
- [ ] 9.5 `npm run docs:build`
- [ ] 9.6 `npm run e2e`
- [ ] 9.7 `npx openspec validate --specs`
