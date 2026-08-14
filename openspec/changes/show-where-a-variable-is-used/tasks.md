## 1. Share the occurrence walk

- [x] 1.1 Move `eachOccurrence` and its `Occurrence` interface from
      `src/editor/variableLint.ts` into `src/editor/variables.ts` and export
      them; import them back in the linter. No behaviour change.
- [x] 1.2 Export `enclosingRegion` from `src/editor/variables.ts` so scope can
      be resolved for a clicked token.
- [x] 1.3 Confirm `variableLint.test.ts` and `variables.test.ts` still pass
      unchanged — this step is a pure move.

## 2. `DATA` items follow the machine

Established against the real ROMs: a BBC and a CPC READ `DATA a` as the string
`"a"`, so their `DATA` words are values; a Spectrum evaluates the item (`DATA a`
READs 7, `DATA a*2` READs 14, an undefined word stops with "Variable not
found"), so Sinclair `DATA` words are real usages. A blanket skip would be
wrong.

- [x] 2.1 Add `dataIsVerbatim` to the lexis and carry it into the scanner's
      rules; set it for `bbcmicro`, `bbcmaster`, `cpc464`, `cpc6128` and the
      Microsoft family, and leave it unset for Sinclair.
- [x] 2.2 Gate the `DATA` skip in `forEachVariable` on the flag, and gate the
      existing skip in `forEachVariableCrunched` on it too rather than letting
      it assume crunching implies verbatim items.
- [x] 2.3 Add cases to `src/editor/variables.test.ts`: items skipped on a
      verbatim machine; scanning resumes after the `:`; items scanned on
      Sinclair; a dialect with no `DATA` keyword unchanged.
- [x] 2.4 Add a case to `src/editor/variableLint.test.ts` pinning that Sinclair
      `DATA` names are still checked, so the skip is never widened to them.

## 3. Name significance in the lexis

- [x] 3.1 Give `VARIABLE_LEXIS` in `src/editor/variableLexis.ts` its own value
      type extending `BasicLanguageOptions` with `significantChars?: number`,
      rather than widening `BasicLanguageOptions` itself (the highlighter shares
      it).
- [x] 3.2 Set `significantChars: 2` for `commodore64`, `pet`, `vic20`, `trs80`
      and `altair8800`; leave it unset elsewhere. Do not infer it from
      `crunched`.
- [x] 3.3 Extend `src/editor/variableLexis.test.ts` so every registered machine
      states a significance decision, and assert the two-character machines
      against the ROM behaviour the variable linter already encodes.

## 4. Usage resolution

- [x] 4.1 Add `src/editor/variableUsages.ts`: given document text, a dialect id,
      its keywords and a document offset, resolve the variable token at that
      offset and return its matching occurrences as sorted document offset
      ranges, plus the name to display.
- [x] 4.2 Implement the identity key — name case-folded where the machine folds
      case (the BBC does not, uniquely), truncated to the machine's significant
      characters, type suffix kept. Add `caseSensitive` to the lexis and to the
      pinned per-machine matrix.
- [x] 4.3 Distinguish scalar from array by the character following the token,
      skipping spaces first so `A (5)` is the array on a crunched machine.
- [x] 4.4 Resolve scope via `collectVariables` and `enclosingRegion`: a name that
      is the enclosing procedure's parameter or local matches only inside that
      procedure; otherwise it matches everywhere except procedures that make the
      name local. Compare locals membership by identity key, not raw string.
- [x] 4.5 Add `src/editor/variableUsages.test.ts` covering: case-insensitive
      matching; `A` / `A$` / `A%` distinct; scalar and array distinct; BBC
      parameter and `LOCAL` confined to their procedure; keywords, string
      literals, comments and `DATA` items never counted; on a crunched machine
      `POKEA` counting as a usage of `A` while `TOTAL` does not count as a usage
      of `TOTAL`; and Commodore `SCORE`/`SCOTT` matching as one variable.
- [x] 4.6 Drive the per-machine identity expectations from the dialect registry,
      so a new machine cannot silently skip the matrix.

## 5. Tooltip, highlights and panel

- [x] 5.1 Add `src/editor/variableUsagesView.ts`, building DOM by hand as
      `controlChipWidget.ts` does. Styling goes in an `EditorView.baseTheme`
      with `cm-` classes, which is what the other editor extensions use - there
      are no CSS modules under `src/editor/`.
- [x] 5.2 Resolve a pointer position to a variable token on `mousedown` and
      `touchstart`, returning false so the click still positions the caret;
      ignore a drag-selection, and make repeating the same target a no-op so a
      tap's synthesised mouse event does not re-trigger.
- [x] 5.3 Hold the tooltip target in a `StateField` fed to `showTooltip`;
      suppress it while a completion is open and clear it on any document
      change. Suppression tests `completionStatus === 'active'`, not
      `!== null`: 'pending' is a query in flight that outlives typing and would
      suppress the offer permanently.
- [x] 5.4 Render the tooltip as a single button that, when pressed, dispatches
      the resolved ranges.
- [x] 5.5 Hold the active usages in a `StateField` painting `Decoration.mark`
      over each range, with a distinct class for the current one.
- [x] 5.6 Add the panel via `showPanel`: variable name, usage count, previous /
      next, close. Previous and next move the cursor and scroll the usage into
      view, wrapping at the ends.
- [x] 5.7 Clear the highlights and close the panel on Escape, on close, on a
      document change, and when a different variable is picked.
- [x] 5.8 Style the marks and the panel alongside the editor's existing
      decoration styling. (The app has a single light theme, so there is no
      second palette to carry.)

## 6. Wire into the editor

- [x] 6.1 Add the extension to the extension list in
      `src/components/CodeMirrorHost.tsx`, beside the other dialect-gated
      decorations, passing the active dialect's id and keywords.
- [x] 6.2 Check the new marks against `highlightSelectionMatches()` and leave
      it in place: it paints only on a non-empty selection, so it never fires
      on the click-to-place-caret path this feature uses.

## 7. End-to-end coverage

- [x] 7.1 Extend an existing spec in `e2e/code-editor/` (rather than a cold
      `page.goto('/')`) with the browser-only half: a real click lands on the
      token, the tooltip positions, the marks paint, next scrolls and moves the
      cursor, and dismissing clears. Poll for the decorations; no
      `page.waitForTimeout`.

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npm test`
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check` (or `npm run format` to fix)
- [x] 8.5 `npm run e2e:chromium -- e2e/code-editor`
- [x] 8.6 `npx openspec validate --changes`
