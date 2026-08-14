## 1. Share the occurrence walk

- [ ] 1.1 Move `eachOccurrence` and its `Occurrence` interface from
      `src/editor/variableLint.ts` into `src/editor/variables.ts` and export
      them; import them back in the linter. No behaviour change.
- [ ] 1.2 Export `enclosingRegion` from `src/editor/variables.ts` so scope can
      be resolved for a clicked token.
- [ ] 1.3 Confirm `variableLint.test.ts` and `variables.test.ts` still pass
      unchanged — this step is a pure move.

## 2. `DATA` items are not variables

- [ ] 2.1 In `forEachVariable` (the non-crunched path), skip a `DATA`
      statement's items to the next `:`, mirroring what
      `forEachVariableCrunched` already does. Guard on the dialect having a
      `DATA` keyword, so dialects without one are unaffected.
- [ ] 2.2 Add cases to `src/editor/variables.test.ts`: unquoted `DATA` words are
      not variables; a statement after the `:` following a `DATA` is scanned
      normally; a dialect with no `DATA` keyword is unchanged.
- [ ] 2.3 Add a case to `src/editor/variableLint.test.ts` covering a `DATA` item
      that would previously have been diagnosed as a variable.

## 3. Name significance in the lexis

- [ ] 3.1 Give `VARIABLE_LEXIS` in `src/editor/variableLexis.ts` its own value
      type extending `BasicLanguageOptions` with `significantChars?: number`,
      rather than widening `BasicLanguageOptions` itself (the highlighter shares
      it).
- [ ] 3.2 Set `significantChars: 2` for `commodore64`, `pet`, `vic20`, `trs80`
      and `altair8800`; leave it unset elsewhere. Do not infer it from
      `crunched`.
- [ ] 3.3 Extend `src/editor/variableLexis.test.ts` so every registered machine
      states a significance decision, and assert the two-character machines
      against the ROM behaviour the variable linter already encodes.

## 4. Usage resolution

- [ ] 4.1 Add `src/editor/variableUsages.ts`: given document text, a dialect id,
      its keywords and a document offset, resolve the variable token at that
      offset and return its matching occurrences as sorted document offset
      ranges, plus the name to display.
- [ ] 4.2 Implement the identity key — uppercased name, truncated to the
      machine's significant characters, type suffix kept.
- [ ] 4.3 Distinguish scalar from array by the character following the token,
      skipping spaces first so `A (5)` is the array on a crunched machine.
- [ ] 4.4 Resolve scope via `collectVariables` and `enclosingRegion`: a name that
      is the enclosing procedure's parameter or local matches only inside that
      procedure; otherwise it matches everywhere except procedures that make the
      name local. Compare locals membership by identity key, not raw string.
- [ ] 4.5 Add `src/editor/variableUsages.test.ts` covering: case-insensitive
      matching; `A` / `A$` / `A%` distinct; scalar and array distinct; BBC
      parameter and `LOCAL` confined to their procedure; keywords, string
      literals, comments and `DATA` items never counted; on a crunched machine
      `POKEA` counting as a usage of `A` while `TOTAL` does not count as a usage
      of `TOTAL`; and Commodore `SCORE`/`SCOTT` matching as one variable.
- [ ] 4.6 Drive the per-machine identity expectations from the dialect registry,
      so a new machine cannot silently skip the matrix.

## 5. Tooltip, highlights and panel

- [ ] 5.1 Add `src/editor/variableUsagesView.ts` with a colocated
      `*.module.css`, building DOM by hand as `controlChipWidget.ts` does.
- [ ] 5.2 Resolve a pointer position to a variable token on `mousedown` and
      `touchstart`, returning false so the click still positions the caret;
      ignore a drag-selection, and make repeating the same target a no-op so a
      tap's synthesised mouse event does not re-trigger.
- [ ] 5.3 Hold the tooltip target in a `StateField` fed to `showTooltip`;
      suppress it while a completion is open and clear it on any document
      change.
- [ ] 5.4 Render the tooltip as a single button that, when pressed, dispatches
      the resolved ranges.
- [ ] 5.5 Hold the active usages in a `StateField` painting `Decoration.mark`
      over each range, with a distinct class for the current one.
- [ ] 5.6 Add the panel via `showPanel`: variable name, usage count, previous /
      next, close. Previous and next move the cursor and scroll the usage into
      view, wrapping at the ends.
- [ ] 5.7 Clear the highlights and close the panel on Escape, on close, on a
      document change, and when a different variable is picked.
- [ ] 5.8 Style the marks and the panel to read in both themes, alongside the
      editor's existing decoration styling.

## 6. Wire into the editor

- [ ] 6.1 Add the extension to the extension list in
      `src/components/CodeMirrorHost.tsx`, beside the other dialect-gated
      decorations, passing the active dialect's id and keywords.
- [ ] 6.2 Check the new marks against `highlightSelectionMatches()` in the
      running app and leave it in place unless the two read as one muddle.

## 7. End-to-end coverage

- [ ] 7.1 Extend an existing spec in `e2e/code-editor/` (rather than a cold
      `page.goto('/')`) with the browser-only half: a real click lands on the
      token, the tooltip positions, the marks paint, next scrolls and moves the
      cursor, and dismissing clears. Poll for the decorations; no
      `page.waitForTimeout`.

## 8. Quality gates

- [ ] 8.1 `npm run typecheck`
- [ ] 8.2 `npm test`
- [ ] 8.3 `npm run lint`
- [ ] 8.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 8.5 `npm run e2e:chromium -- e2e/code-editor`
- [ ] 8.6 `npx openspec validate --changes`
