## 1. Every token in a range

- [x] 1.1 New module beside `src/editor/tokenAt.ts` answering "every token in
      this range, in document order" from the same stream-language tree that
      module resolves a single position in. Reuse its `EditorToken` shape rather
      than declaring a second one, and factor out the forced-parse fallback so
      the two cannot disagree about what to do when the lazy tree lags.
- [x] 1.2 The parse budget is a named constant with a comment saying why that
      number, measured rather than guessed — `tokenAt.ts` measured its own
      against a ~79KB program and says so.
- [x] 1.3 Colocated tests: a line yielding its runs in order with the right
      tags; a range that starts and ends mid-line; an empty range; a document
      longer than the lazy parse covers still yielding runs for the range asked
      about. Assert tag strings explicitly — they are the contract with
      `basicLanguage.ts`, and a rename must fail here.

## 2. The protocol's shape

- [x] 2.1 New `src/lsp/semanticTokens.ts` translating those runs into the
      protocol's packed encoding, on the pattern `src/lsp/references.ts` uses to
      wrap `findVariableUsages`: no `process`, no connection, a plain function
      of a document and its `EditorState`.
- [x] 2.2 The legend in one exported constant, so the shim declares exactly what
      this module emits. Tags map: `keyword`→keyword, `functionName`→function,
      `operator`→operator, `comment`→comment, `string`→string, `number`→number,
      `variableName`→variable, `meta`→macro, `labelName`→label, `atom`→atom. A
      tag the map does not know is skipped, not guessed at.
- [x] 2.3 Nothing for an unbound document — `DocumentStore.editorState` already
      returns null for one, so this falls out rather than being checked twice.
- [x] 2.4 A token spanning a line break, if the tokenizer can produce one, is
      split per line: the encoding is line-relative and a client cannot render
      one that is not.

## 3. The declaring line

- [x] 3.1 `src/editor/basicLanguage.ts` tags a `#BIN` line as a directive and
      leaves a `#MACHINE` line to be read as the two variable names its text
      resembles. Tag it too, through `isMachineDirective` rather than a second
      regex, so the line the tokenizer colours is the line every other path
      strips.
- [x] 3.2 This is app-visible: run the `code-editor` e2e folder, Chromium only.

## 4. Wiring

- [x] 4.1 `src/lsp/handlers.ts` — one entry point for the whole program and one
      for a range, alongside the existing ones.
- [x] 4.2 `scripts/headless/lsp.mts` — declare the provider with the legend from
      2.2 and both `full` and `range`, and wire the two handlers. Declaring only
      what is answered is this file's stated rule; both are answered.

## 5. Tests

- [x] 5.1 `src/lsp/semanticTokens.test.ts` on the shape of `hover.test.ts`.
      One `it` per behaviour: a keyword, a line number, a string and a comment
      each reported as themselves; the encoding's line/character deltas correct
      across a line break; an unbound document yielding nothing.
- [x] 5.2 The cross-machine case, driven from the registry rather than from a
      hardcoded pair: find a name that is a keyword on one registered machine
      and not on another, and assert it is reported differently on each. If no
      such pair exists the test must say so rather than silently passing.
- [x] 5.3 A range request over a listing longer than one screen, asserting it
      answers about the range and not about the whole.

## 6. Documentation

- [x] 6.1 `docs/guide/language-server.md` — colouring joins the "What you get"
      list, with the two kinds a client may need to style itself named for the
      users of editors that do not ship a mapping.
- [x] 6.2 `docs/contributing/architecture.md` — the language-server section
      names the two new modules in its existing list. No new diagram.

## 7. Gate

- [x] 7.1 `npm run typecheck && npm run lint && npm run format:check`
- [x] 7.2 `npx vitest run src/lsp/ src/editor/`
- [x] 7.3 `npm run docs:build`
- [x] 7.4 Drive the built server end to end — initialize, open a listing, ask
      for its tokens — and confirm the answer against the same listing's colours
      in the IDE. No e2e: nothing app-visible changed.
