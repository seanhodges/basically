## 1. Prove the ground before building on it

- [ ] 1.1 Add `src/lsp/headlessEditorState.test.ts`: for a crunched machine, an
      uncrunched one and one with procedures (`commodore64`, `zx81`, `bbcmicro`),
      build an `EditorState` from `dialect.languageSupport()` under Node and
      assert `tokenAt` classifies a keyword, `referenceTokenAt` resolves it, and
      `dialect.completionSource` returns options including that keyword. This is
      the assumption the whole change rests on; it was verified by hand during
      the proposal and belongs in the suite so it cannot quietly stop being true.
- [ ] 1.2 In the same file, assert a reference page loads through `import()` and
      yields a row with `syntax` and `description` for a known keyword.
- [ ] 1.3 Add `vscode-languageserver` and `vscode-languageserver-textdocument`
      to `dependencies` in `package.json`. Both MIT; note the licence check in
      the commit message, per `openspec/config.yaml`.

## 2. The operation

- [ ] 2.1 `src/cli/args.ts`: add `'lsp'` to `OPERATIONS`, an `LspArgs` member to
      the `CliArgs` union, and `parseLsp` accepting `--stdio` and an optional
      `-m`/`--machine`. Unlike every other program-reading operation, a missing
      machine is not a `RunError` here — the editor may name one later.
- [ ] 2.2 `src/cli/usage.ts`: add `OPERATION_USAGE.lsp` (`args.test.ts` loops
      `OPERATIONS` and requires an entry). Say how an editor is expected to
      launch it, since there is no extension to do it for the user.
- [ ] 2.3 Extend `src/cli/args.test.ts`: `--stdio` parses, an unknown option is
      the caller's mistake, an unregistered `-m` is the caller's mistake, and no
      machine at all is accepted.

## 3. Binding a document to a machine

- [ ] 3.1 `src/lsp/binding.ts`: resolve a configured machine through the existing
      `findMachine` from `src/dialects/headless/runListing.ts`, so the server and
      `-m` accept the same spellings.
- [ ] 3.2 Same file: `inferMachine(source)` scoring every registered dialect by
      `fatalErrors(dialect.lint(source)).length`, returning the unique minimum
      and declining on a tie. Never called when a machine is configured.
- [ ] 3.3 Same file: the precedence chain — configured, then
      `initializationOptions`, then inference, then declined — as one pure
      function over (settings, source).
- [ ] 3.4 `src/lsp/binding.test.ts`: registry-driven. Every registered dialect's
      own bundled samples infer to a machine or decline, never to a machine whose
      `lint` reports fatal problems on them; a listing every machine reads
      equally declines; a configured machine always wins over inference.

## 4. Documents and positions

- [ ] 4.1 `src/lsp/documents.ts`: an open-document store keyed by URI, holding
      text, version and bound dialect, and caching an `EditorState` per
      `(version, dialect id)` so a keystroke does not rebuild it twice.
- [ ] 4.2 Same file: `offsetToPosition` / `positionToOffset` over the document
      text, and `errorToRange` folding the two conventions — `TokenizeError` is
      1-based line and 0-based column, the protocol is 0-based in both, and an
      absent `endColumn` runs to the end of the line, as
      `src/editor/lintIntegration.ts` already treats it.
- [ ] 4.3 `src/lsp/documents.test.ts`: round-trip offsets and positions across
      lines including the last line with no trailing newline; an error with no
      `column` and one with no `endColumn` both produce sane ranges.

## 5. Diagnostics

- [ ] 5.1 `src/lsp/diagnostics.ts`: `dialect.lint(source)` plus
      `strictCharacterErrors(source, dialect, false)` from
      `src/app/strictCharacters.ts`, mapped to protocol diagnostics with
      severity from `fatal !== false` — following `src/cli/lint.ts`, not
      `lintIntegration.ts`, which hardcodes `'error'`.
- [ ] 5.2 Same file: the declined-binding diagnostic, at the first line, naming
      the setting to configure.
- [ ] 5.3 `src/lsp/diagnostics.test.ts`: `10 PRINT "HI` on `zx81` is fatal at
      line 1 column 11 (0-based), matching `src/cli/lint.test.ts`;
      `10 LET A=1: PRINT A` on `zx81` is a warning, not an error; a declined
      binding produces exactly one diagnostic.

## 6. Completion

- [ ] 6.1 `src/lsp/completion.ts`: drive `dialect.completionSource` from a
      `CompletionContext` over the document's `EditorState` and translate the
      result — `label`, `detail` from `EditorKeyword.signature`, `documentation`
      from `doc`, a completion-item kind from `kind`.
- [ ] 6.2 Same file: construct templates pass through as snippet insert-text
      unchanged — `src/editor/constructs.ts` already writes `${1:I}` … `${0}`,
      which is the protocol's own syntax.
- [ ] 6.3 Same file: carry the replacement range the source computed, so the
      crunch re-anchoring in `src/editor/completions.ts` survives translation.
- [ ] 6.4 `src/lsp/completion.test.ts`: a keyword prefix offers that machine's
      keywords and no others; a construct inserts as a snippet with ordered
      placeholders; inside a string literal nothing is offered; on a crunched
      machine a completion accepted mid-run replaces the tail, not the whole run.

## 7. Hover

- [ ] 7.1 `src/lsp/hover.ts`: `referenceTokenAt(state, pos, BASIC_REFERENCE_KINDS,
      operatorSpellings(dialect))` then `lookupWord(text,
      keywordSpellingsFor(dialect.id))` to resolve a short spelling to its
      keyword.
- [ ] 7.2 Same file: load the reference page through the existing per-page
      `import()` map in `src/ai/machineReference.ts`, keyed by
      `referencePageOf(dialect)` — export the loader from there rather than
      writing a second map. It must stay an explicit map: a computed specifier
      draws a build-time warning and defeats the chunking the ESLint ban exists
      to protect.
- [ ] 7.3 Same file: compose `syntax` + `description` + `tag` into markup, and
      fall back to the dialect's own `signature`/`doc` where the page has no row.
- [ ] 7.4 `src/lsp/hover.test.ts`: hovering `PRINT` on `commodore64` yields its
      syntax and description; hovering `?` yields the same, resolved to `PRINT`;
      a keyword with no reference row still yields something.

## 8. Jumping, structure and usages

- [ ] 8.1 `src/lsp/definition.ts`: a line reference is an integer literal after
      one of the keywords `src/editor/lineNumbering.ts` already enumerates for
      renumbering, resolved with `findRowForLineNumber`. A procedure or function
      name resolves against `collectVariables(...).procs`.
- [ ] 8.2 `src/lsp/symbols.ts`: `buildOutline(source,
      outlineCapabilities(dialect.keywords))` to document symbols, with ranges
      from `ProcRegion` where there is one.
- [ ] 8.3 `src/lsp/references.ts`: `findVariableUsages` to locations and document
      highlights, converting its document offsets through the document store.
- [ ] 8.4 `src/lsp/definition.test.ts`, `symbols.test.ts`, `references.test.ts`:
      `GOSUB 500` reaches line 500 and a number no line has reaches nowhere;
      `PROCfoo` reaches its definition on `bbcmicro`; the outline names no kind
      of structure the machine lacks; usages honour the machine's identity rules
      and exclude a name in a string, a comment and a keyword position.

## 9. The connection

- [ ] 9.1 `src/lsp/handlers.ts`: one entry point per protocol method, taking the
      document store and the request's parameters and returning the result. No
      `process`, no transport — the same split `src/cli/*.ts` keeps from
      `scripts/headless/cli.mts`.
- [ ] 9.2 `scripts/headless/lsp.mts`: `createConnection`, `TextDocuments`
      synchronisation, configuration pull with a re-publish on change, and the
      wiring to `handlers.ts`. Declare only the capabilities implemented.
- [ ] 9.3 Same file: divert `console.log`/`info`/`debug` to standard error for
      the life of the server, as `divertLogging()` in
      `scripts/headless/cli.mts` already does for a run — one stray write
      corrupts the protocol stream for the rest of the session.
- [ ] 9.4 `scripts/headless/cli.mts`: a `case 'lsp'` in `main()`'s switch. It is
      the one operation whose normal path does not return an exit code.
- [ ] 9.5 Debounce diagnostics at 400 ms, matching the editor's linter.

## 10. Documentation

- [ ] 10.1 `docs/contributing/architecture.md`: add `src/lsp/` to the layers
      table and extend `## The toolchain outside the browser` with the server and
      what it deliberately does not reach (no ROM, no machine, no global
      installation). Keep the mermaid rules — `flowchart TB`, under ~1100px, short
      `<br/>` label lines. No machine lists, no counts.
- [ ] 10.2 `CLAUDE.md`: the commands block gains the operation, with a one-line
      example of an editor launching it.
- [ ] 10.3 Write the user-facing page under `docs/guide/` explaining how to wire
      the server into an editor and how to set the machine. Leave
      `docs/.vitepress/config.ts` untouched — adding a sidebar entry needs the
      maintainer's say-so, which is an open question in `design.md`. Ask before
      checking this off.

## 11. Quality gates

- [ ] 11.1 `npx vitest run src/lsp/ src/cli/ src/editor/ src/dialects/registry.test.ts`
      — the new suites, the arg grammar they extend, and the editor modules that
      now have a second caller.
- [ ] 11.2 `npm run typecheck && npm run lint && npm run format:check`.
- [ ] 11.3 `npm run docs:build`, because `docs/contributing/architecture.md` and
      a `docs/guide/` page change.
- [ ] 11.4 `npx openspec validate --specs`.
- [ ] 11.5 No e2e run. `language-server` has no browser surface, and no existing
      capability's behaviour changes, so no capability folder under `e2e/` is
      added or touched — `src/e2eCapabilityLayout.test.ts` permits a capability
      with no `e2e/` folder.
- [ ] 11.6 By hand, with the bundle rebuilt:
      - `./scripts/basically lsp --help` prints usage and exits 0.
      - `./scripts/basically lsp --stdio` fed a `Content-Length`-framed
        `initialize` → `initialized` → `didOpen` for `10 PRINT "HI` on `zx81`
        publishes one diagnostic at line 0, character 10 (0-based), severity
        error.
      - The same with no machine configured and an ambiguous listing publishes
        the declined-binding diagnostic naming the setting.
      - `./scripts/basically lsp -m nosuchmachine` exits 1 without starting.
      - Wired into a real editor's language-server client: completion, hover,
        go-to-definition and the outline all answer against a bundled sample.
