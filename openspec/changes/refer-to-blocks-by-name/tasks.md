## 1. The resolver

- [ ] 1.1 New module holding the scanner and resolver: substitute each `@name`
      with its block's address, returning the substituted source, any errors, and
      the column mapping that takes a position in the substituted text back to
      the position the user typed. Dialect-neutral. Skip string literals and
      comment tails. Errors are `TokenizeError`-shaped (1-based line, 0-based
      column) per the errors-not-throws convention.
- [ ] 1.2 In the same module, the non-fatal check: a plain numeric address in a
      machine-code call position that matches no block's address. Warning
      severity only — it must never block a run.
- [ ] 1.3 Tests, weighted towards the column map because that is where this
      design breaks: several refs on one line, refs of different name lengths,
      a ref at the start and at the end of a line, an unknown name's error
      position, `@` inside a string and inside a comment left untouched, and a
      program with no refs passing through byte-identical.

## 2. One substitution point

- [ ] 2.1 New app-level helper — resolve for a dialect + source + blocks —
      called ahead of every `dialect.tokenize`.
- [ ] 2.2 Route every existing call site through it. **Enumerate them from the
      tree, do not trust this list**, which was accurate when written: run
      (`src/components/EmulatorPane.tsx`), export
      (`src/components/TransferDialog.tsx`), share
      (`src/components/ShareLinkDialog.tsx`), stats
      (`src/app/useProgramStats.ts`), import (`src/app/importProgram.ts`),
      vocabulary (`src/app/programVocabulary.ts`).
- [ ] 2.3 Export needs care: each dialect's `BuildTarget.build` re-tokenizes the
      *source string it is handed*, so the substitution must happen before the
      source reaches `build`, not inside it. Confirm this for a block-aware
      target with a loader, where the source is tokenized more than once.
- [ ] 2.4 A test asserting a document with refs produces identical program bytes
      through run, export and share. This is the assertion that catches a missed
      call site; without it a missed one is invisible until a recipient's copy
      fails.

## 3. Lint and completion

- [ ] 3.1 `src/editor/lintIntegration.ts` — resolve inside the debounced lint
      callback, reading the current blocks imperatively from the store so
      editing a block does not rebuild the editor extension. Remap every
      diagnostic's column back through the resolver's map before display.
- [ ] 3.2 Surface the unmatched-address warnings from 1.2 as non-fatal
      diagnostics alongside the dialect's own.
- [ ] 3.3 Completion in its own compartment: block names after `@`, and block
      names plus addresses after the dialect's machine-code call keyword. Reuse
      `isInsideString` from `src/editor/completions.ts` rather than re-deriving
      it. The info popup shows address, size and comment.
- [ ] 3.4 Determine how a dialect declares its call keyword (`USR`, `SYS`,
      `CALL`, `DEFUSR`). **Check the keyword capability domains added for the
      porting guide first** — they may already carry it, in which case the seam
      needs no new field.
- [ ] 3.5 Tests: the squiggle for an unknown name lands on the `@name` token; a
      run-path test that a program calling a block by name tokenizes clean and
      produces the same bytes as the numeric form.

## 4. Documentation

- [ ] 4.1 `docs/guide/machine-code.md` — naming a block from BASIC, in the
      "Running it" section where the magic numbers currently appear. Show it per
      machine family (`USR` / `SYS` / `CALL`), and say plainly that plain
      addresses keep working. Guide conventions: no `src/` paths, no internal
      symbols.
- [ ] 4.2 Check whether `docs/guide/writing-basic.md` should mention the syntax.
      Probably a cross-link rather than a duplicate explanation — decide, do not
      duplicate.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 5.2 `npm run docs:build` (docs/ changed in group 4).
- [ ] 5.3 `npm run e2e:chromium -- e2e/memory-blocks` and
      `npm run e2e:chromium -- e2e/code-editor` — the second for completion and
      diagnostics. Only check off when both pass; a failure leaves this
      unchecked with a note on what failed.
- [ ] 5.4 Manual: write the Spectrum Kaleidoscope's `RANDOMIZE USR` as a name,
      run it, then move the block in Settings and run again without touching the
      BASIC. That is the whole feature in one gesture.
