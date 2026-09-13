## 1. State the already-taken rule once

- [ ] 1.1 Export a small predicate from `src/editor/lineNumbering.ts` answering whether a source already carries a given line number, built on the existing `parseLines`
- [ ] 1.2 Use it at the browser IDE's existing collision check in `src/components/CodeMirrorHost.tsx`, leaving its behaviour and its wording exactly as they are
- [ ] 1.3 Cover the predicate in `src/editor/lineNumbering.test.ts`, including a source whose only match is inside a `#BIN` record or a line the dialect takes unnumbered

## 2. Answer a renumbering, purely

- [ ] 2.1 Add `src/lsp/renumber.ts` with the result shape from the design — an edit plus the row the cursor belongs on, an unchanged, or a refusal carrying its own sentence — importing no transport and no connection
- [ ] 2.2 Answer a whole-program renumbering through the existing `renumberProgram`, taking the dialect's unnumbered-line predicate from the document's binding, and refusing with the IDE's own wording when the last line would pass the machine's highest number
- [ ] 2.3 Answer a single-line renumbering: no-op on a line the machine takes unnumbered; number an unnumbered line in place through the existing `numberLineInPlace`; otherwise validate the range and the already-taken rule, then renumber through the existing `renumberLine`
- [ ] 2.4 Compute the cursor's row the way the IDE does — by rank among the lines renumbering actually numbers, skipping blanks, binary records and lines the machine takes unnumbered
- [ ] 2.5 Refuse a document that is not open, one whose machine could not be settled, and one whose version has moved on since the request
- [ ] 2.6 Re-export both answers from `src/lsp/handlers.ts`, as every other answer is

## 3. Offer it over the protocol

- [ ] 3.1 Declare `executeCommandProvider` in `scripts/headless/lsp.mts` with `basically.lsp.renumberLine` and `basically.lsp.renumberFile`
- [ ] 3.2 Wire `onExecuteCommand`: call the handler, apply an edit through the connection's workspace, show a refusal through the connection's window, and return the outcome as the command's result
- [ ] 3.3 Pull `basically.lineNumberIncrement` beside the configured machine — defaulting to ten when absent, clamped to the bounds the IDE's own setting uses, with `initializationOptions` as the fallback for a client that cannot pull and a re-pull on configuration change
- [ ] 3.4 Let an explicit increment in the command's arguments override the configured one
- [ ] 3.5 Check no user-facing sentence names `basically.lineNumberIncrement`, since no client contributes it yet

## 4. Tests

- [ ] 4.1 Add `src/lsp/renumber.test.ts`: a whole program renumbered with its references following, including an `ON x GOTO` list; one line renumbered and the program re-sorted; an unnumbered line numbered in place
- [ ] 4.2 Cover the machine-specific cases: a line an Apple 1 listing takes unnumbered left alone while the reference it carries still follows, and a `#BIN` record's text and place preserved
- [ ] 4.3 Cover every refusal with its exact sentence: already taken, out of range, increment too large for the program, stale version, document never opened, machine not settled
- [ ] 4.4 Assert the cursor row each answer reports is the one the IDE would land on
- [ ] 4.5 Extend `src/lsp/handlers.test.ts` with the re-exported answers reached through the store, as the other handlers are
- [ ] 4.6 Extend `src/server/servedOverStreams.test.ts`: the initialize result declares both commands, and executing one produces a `workspace/applyEdit` carrying the renumbered program — the only place the shim's wiring is proved

## 5. Docs

- [ ] 5.1 Add renumbering to "What you get" in `docs/guide/language-server.md`, and document the increment setting beside "Telling it which machine" — written for a user configuring it through whatever client they use, since no client contributes it yet
- [ ] 5.2 Update "Serving an editor: the language server" in `docs/contributing/architecture.md`, which says the server answers questions *about* a program; it can now be asked to change one

## 6. Quality gates

- [ ] 6.1 `npx vitest run src/lsp/ src/editor/lineNumbering.test.ts src/components/ src/server/servedOverStreams.test.ts`
- [ ] 6.2 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 6.3 `npm run docs:build` (docs/ changed)
- [ ] 6.4 `npm run e2e:chromium -- e2e/code-editor` — the browser IDE's renumbering is touched only by task 1.2, and this confirms it is unchanged. Leave unchecked with a note if it fails
- [ ] 6.5 `npx openspec validate --specs`
- [ ] 6.6 Drive the built server by hand — `./scripts/basically lsp --stdio`, then initialize, didOpen and executeCommand — and confirm both commands are declared, that a renumbering comes back as an applied edit with references rewritten, and that an already-taken number changes nothing

## 7. On archiving

- [ ] 7.1 Widen the `language-server` purpose sentence, which enumerates answer-only help, to admit that the server can also be asked to edit a program
