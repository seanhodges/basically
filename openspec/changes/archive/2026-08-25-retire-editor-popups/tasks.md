# Tasks: retire-editor-popups

## 1. Which surfaces retire the popups

- [x] 1.1 Add the optional `editorInput` flag to `Surface` in
      `src/app/surfaces.ts`, documented like the existing `autoShown`, and set
      it on the `keyboard`, `controller` and `remap` entries
- [x] 1.2 Export `editorPopupsRetired(state, isMobile)` from the same module:
      true when any surface without `editorInput` reads open
- [x] 1.3 Cover it in `src/app/surfaces.test.ts`, driven off `SURFACES` so a
      surface added later is included automatically: every entry opened alone
      retires the popups except the three input overlays

## 2. Retiring them

- [x] 2.1 Add `src/app/useRetireEditorPopups.ts`: given the host's
      `EditorView` ref, call `closeCompletion` and `hideClickMenu` on the
      rising edge of `editorPopupsRetired`
- [x] 2.2 Mount it in `src/components/CodeMirrorHost.tsx`
- [x] 2.3 Mount it in `src/components/AsmEditor.tsx`

## 3. Layering

- [x] 3.1 Declare the overlay scale as custom properties in `src/styles.css`,
      beside the existing `.cm-tooltip` overrides, naming CodeMirror's 500 as
      the floor everything raised over the editor must clear
- [x] 3.2 Move the toolbar, the editor tab context menu, the documentation
      drawer (drawer, handle and hint), the dialog backdrop and the machine
      picker onto the scale, preserving their relative order
- [x] 3.3 Update the prose comments in those files that cite the old numbers

## 4. Browser coverage

- [x] 4.1 Extend a spec in `e2e/shell-navigation/` with one test: a completion
      list is gone after a dialog opens, the token menu is gone after the
      documentation drawer opens, and a token menu raised beside the open
      drawer is drawn behind it

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npm run e2e:chromium -- e2e/shell-navigation`
- [x] 5.3 `npm run e2e:chromium -- e2e/code-editor` (completion and token-menu
      regressions)
- [x] 5.4 `npx openspec validate --specs`
