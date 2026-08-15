## 1. Read the token under a position

- [x] 1.1 Add `src/editor/tokenAt.ts`: given editor state and a document position,
      return the token there (text, range, node kind) when its kind is one the caller
      accepts, else null. Resolve from both sides so either edge of a token picks it;
      reject the top node and empty ranges. Ensure the parse to the end of the clicked
      line with a small millisecond budget before resolving, falling back to whatever
      tree exists. Header comment records the two facts a reader cannot infer: that
      stream-language node names are the tokenizer's own tag strings, and why the parse
      is forced rather than trusted.
- [x] 1.2 Add `src/editor/tokenAt.test.ts` on a crunched, an Acorn and a Sinclair
      dialect: a keyword resolves at every offset within it and at both edges; a function
      name resolves; a declared multi-character operator resolves whole; whitespace, a
      line number, a number, a string body, a comment body, a binary-directive line and a
      variable all yield null; on a crunched dialect a glued run resolves the keyword
      part and not the variable part.
- [x] 1.3 Extend that test with the lazy-parse guard: a document of several thousand
      lines still resolves a token near its end. This is the regression guard for the
      forced parse — without it the failure reaches users as an intermittently missing
      menu row.
- [x] 1.4 Extend that test for the assembly tokenizer, per processor: an instruction and
      an assembler directive resolve; a register and a label reference yield null.

## 2. Split the menu mechanism out of the usages view

- [x] 2.1 Add `src/editor/clickMenu.ts` holding the reusable half of
      `src/editor/variableUsagesView.ts`: the tooltip state field and its provider, the
      pointer handlers, the touch + synthesised-mouse de-duplication, the clearing rules
      (any edit; find/replace claiming the foot of the editor; withheld while the
      completion popup is up), and rendering N rows from a list of row sources. A row
      source takes editor *state* and a position so it stays node-testable. Widen the
      de-duplication key to include the row labels. Move the find-panel-just-opened
      helper across with its doc comment intact.
- [x] 2.2 Give the menu its own Escape binding: handled only while a menu is open, and
      never while the completion popup is up. Comment at the assembly call site that
      the completion and search guards degrade safely when those extensions are absent,
      so nobody "fixes" it by adding them.
- [x] 2.3 Reduce `src/editor/variableUsagesView.ts` to the usages half — the usages
      field, the bar, the marks, the theme — plus a row source. Hoist what no longer
      needs the dialect closure to module scope. Closing the bar also drops any open
      menu. Move the "three pieces" paragraph of the header doc to `clickMenu.ts` and
      reword it there for a menu of N rows.
- [x] 2.4 Confirm the refactor is behaviour-preserving: `npm test` and
      `npm run e2e:chromium -- e2e/code-editor` pass with the usages journey untouched.
      Commit this separately from the rest — it is the bisect point if the menu regresses.

## 3. The reference row

- [x] 3.1 Add `src/editor/referenceRow.ts`: a token reader that layers the
      punctuation skip-set over `tokenAt`, and a row source built from an accepted-kind
      list, a topic resolver and an open callback. Withhold the row when the resolver
      returns nothing, so a row is never offered that cannot go anywhere. Label
      "Reference", icon `?`, title naming the token.
- [x] 3.2 Skip single-character tokens drawn from the highlighter's punctuation set —
      including the decimal point, which the operator exception set does not carry. Name
      the operator exception set in the comment so the two sets are visibly related.
      Export the highlighter's set from `src/editor/basicLanguage.ts` rather than
      restating it.
- [x] 3.3 Add `src/editor/referenceRow.test.ts`: each punctuation character is skipped
      while the machine's real operators are still returned; registry-driven, every
      operator spelling the reader returns for a dialect resolves to a reference topic.

## 4. Wire both editors

- [x] 4.1 `src/components/CodeMirrorHost.tsx`: replace the usages extension with the
      menu carrying the usages row and the reference row (opening the dialect's reference
      at the token), plus the usages feature extension. Delete the selection-mirroring
      clause from the update listener.
- [x] 4.2 `src/components/AsmEditor.tsx`: mount the menu with the reference row alone,
      accepting instruction-kind tokens and resolving to the engine's processor page.
      Delete the selection-mirroring block and its now-false comment.

## 5. Unhook the selection path

- [x] 5.1 `src/app/docsTopic.ts`: delete the first-word-of-a-selection helper; the topic
      resolvers now take a keyword. Drop the selection field from the contextual-topic
      state. Reduce the contextual resolver to its tab-driven half — a machine-code block
      tab on a processor-backed dialect yields that processor's page unseeded, anything
      else yields nothing. Reword the doc comments, which currently describe the
      selection.
- [x] 5.2 `src/app/store.ts`: remove the mirrored-selection field, its doc comment, its
      initialiser and its setter. The file contains a NUL byte, so `Grep` reports it
      binary — sweep with `rg -a 'editorSelection|setEditorSelection'` afterwards to
      confirm nothing survives; strict-TS unused checks will not catch a leftover store
      property.
- [x] 5.3 Rewrite the stale comments on the three openers in `src/components/Toolbar.tsx`
      and `src/components/DocsDrawer.tsx`, which assert the deleted behaviour. State what
      they now do: the porting comparison where there is one, else the processor page
      when a machine-code block tab is open, else the docs home. Also fix the two
      comments that were already stale — the store's "detection not implemented yet" and
      the drawer prop's "seam for a future context-aware help feature".
- [x] 5.4 Update `src/app/docsTopic.test.ts`: drop the selection field from every state
      literal and the multi-word-selection case; rewrite the contextual-resolver cases;
      **add** the case pinning a block tab with no comparison to the processor page —
      that nuance is the easiest thing in this change to lose by accident. Keep both
      crosscheck tests (every registered dialect, and every block-capable dialect, maps
      to a page that exists).
- [x] 5.5 Check `src/app/store.test.ts`, `src/app/surfaces.test.ts` and
      `src/app/historyNav.test.ts` for fallout from the removed store field.

## 6. Styling

- [x] 6.1 `src/styles.css`: rename the menu's own classes away from the usages feature
      (tooltip, list, row, icon, label), leaving the bar and mark classes as they are —
      the menu now serves two features, the bar and the marks do not. Keep the shared
      rule that gives the row the completion popup's selected-row highlight.
- [x] 6.2 Replace the hardcoded row glyph with per-row icon modifiers: `⌕` for usages,
      `?` for reference. Note in the comment that the list is built for N rows even
      though only one is ever offered today.

## 7. Documentation

- [x] 7.1 `docs/guide/keyboard-shortcuts.md`: the sentence stating that F1 jumps to the
      selected keyword is now false — replace it with a pointer to the editor menu.
- [x] 7.2 `docs/guide/writing-basic.md`: add the reference gesture beside the existing
      "finding where a variable is used" section. `docs/guide/machine-code.md`: add a
      sentence for the assembly editor's row. Sidebar untouched.

## 8. End-to-end coverage

- [x] 8.1 Extend the existing journey in `e2e/code-editor/variable-usages.spec.ts` with
      staged assertions on the already-typed program: clicking a keyword offers Reference
      and not Usages; clicking a variable offers Usages and not Reference. Do not open
      the drawer here — the iframe load belongs to the docs spec. Widen the file's header
      doc to say the journey now covers both row kinds.
- [x] 8.2 Rewrite the frame-routing test in `e2e/shell/docs-drawer.spec.ts` to drive from
      the menu instead of double-click-plus-toolbar. Keep the no-reload stamp assertion —
      that is the browser-only fact it exists for. The rewrite is simpler than what it
      replaces: no F1 dance, no toolbar-covered-by-drawer workaround.
- [x] 8.3 Extend the existing journey in `e2e/memory-blocks/asm-editor.spec.ts` (its
      block tab is already open, so the setup is free): clicking an instruction offers
      Reference, clicking a register does not, and taking the offer opens the
      documentation. Do not assert the frame's search box here — that would pay a second
      cold iframe load for a fact the docs spec already proves.
- [x] 8.4 Cover the specced porting bypass in
      `e2e/porting-guidance/filter-by-program.spec.ts`, riding the existing `beginPort`
      journey: with a comparison current, taking the Reference row lands on the keyword,
      and reopening without naming a topic lands back on the comparison. Added during
      apply — narrowing that guarantee is the one shipped behaviour this change alters,
      and it had no test.

## 9. Quality gates

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm test`
- [x] 9.3 `npm run lint` and `npm run format:check`
- [x] 9.4 `npm run docs:build` (this change edits `docs/`)
- [x] 9.5 `npm run e2e:chromium -- e2e/code-editor`
- [x] 9.6 `npm run e2e:chromium -- e2e/shell`
- [x] 9.7 `npm run e2e:chromium -- e2e/memory-blocks`
- [x] 9.7b `npm run e2e:chromium -- e2e/porting-guidance`
- [x] 9.8 `npx openspec validate --specs`
- [x] 9.9 Verified end to end. Covered by the suites above: the keyword row seeds the
      drawer, the variable row still works, the menu's Escape does not reach the surface
      behind it, an instruction in a machine-code block opens its processor's page, the
      toolbar opens the docs home, and a pending porting comparison neither hijacks a
      keyword lookup nor is lost by one. Punctuation offering nothing is unit-tested
      rather than driven by hand.

      Two items are **not** verified. A keyword typed short (`P.`, `?`) offers nothing —
      found during apply, now pinned by test and written into the spec delta as a
      scenario, since the reference page's own search still finds those spellings. And
      the menu on a touch viewport is unexercised: the row suppresses focus theft and the
      drawer does not grab focus, so the soft keyboard should be undisturbed, but that is
      reasoning rather than a result.
