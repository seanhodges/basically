## 1. The reader

- [x] 1.1 Add `src/dialects/machineDirective.ts` as a leaf module in the shape of
      `src/dialects/binaryDirective.ts`: importing nothing but a type, matching
      `#MACHINE` (any case) at the start of a physical line after optional indent,
      as a whole word. Export `isMachineDirective(lineText)` and
      `parseMachineDirective(lineText)` returning the named machine, or an error
      message with a 0-based column, or null when the line is not a directive.
- [x] 1.2 Same file: `readMachineDirective(source)` returning the declared name,
      the source with the declaration removed, the problems found (unregistered
      name is not its business — that needs the registry, see 2.2), and what is
      needed to map a position in the stripped source back to the source the user
      typed. At most one declaration; a second is a problem at its own line.
- [x] 1.3 `src/dialects/machineDirective.test.ts`: recognition with and without
      indent and in mixed case; a missing name; a second declaration; a line that
      merely starts with `#`; the position mapping across a declaration on the
      first line and in the middle of a program.

## 2. Honouring it above the seam

- [x] 2.1 Read `openspec/changes/refer-to-blocks-by-name/design.md` first. That
      change builds the same above-the-seam pass for `@name` substitution and
      carries the same column-mapping obligation. If it has landed, extend its
      single point rather than adding a second; if it has not, build this one so
      it can. Note in the commit which way round it went.
      — `refer-to-blocks-by-name` had not landed (no `@name` resolver exists in
      `src/`), so this change builds the single point:
      `src/dialects/resolveListing.ts`, on top of `src/dialects/machineLookup.ts`
      (split out of `headless/runListing.ts` to avoid a circular import).
- [x] 2.2 Add the helper every caller uses: takes a source and a dialect (or no
      dialect, when the declaration is what chooses one), returns the source to
      tokenize, the resolved dialect, and problems positioned against what the
      user typed. Resolve the declared name with `findMachine` from
      `src/dialects/headless/runListing.ts`, so the declaration and `-m` accept
      the same spellings; an unregistered name is a problem here.
- [x] 2.3 Route every path that turns text into bytes through it. Working from
      the call sites of `dialect.tokenize` / `dialect.lint`: `src/editor/
      lintIntegration.ts`, `src/app/useProgramStats.ts`, `src/app/importProgram.ts`,
      `src/app/programVocabulary.ts`, `src/app/listingBlocks.ts`,
      `src/share/compatibility.ts`, `src/ai/aiStore.ts`, `src/cli/lint.ts`,
      `src/cli/build.ts`, and the round-trip harnesses under `src/dialects/`.
      Grep for both members afterwards and account for every remaining hit.
      — also routed `src/dialects/headless/runListing.ts` (the run path, named
      explicitly in the design's Impact section), `src/components/EmulatorPane.tsx`,
      `TransferDialog.tsx` (including its `target.build`/`audio.buildSamples`
      calls, which re-tokenize internally) and `ShareLinkDialog.tsx`.
- [x] 2.4 A test that fails if a path is missed: for every registered machine and
      every one of its bundled samples, tokenizing the sample with a declaration
      prepended produces bytes identical to tokenizing it without, and the byte
      size reported is the same.
- [x] 2.5 A test that a problem on a line after a declaration is reported at the
      line the user sees it on, on every registered machine.

## 3. The command line

- [x] 3.1 `src/cli/args.ts`: `-m`/`--machine` stops being required for the
      operations that read a program. Naming no machine is no longer the caller's
      mistake at parse time — it becomes one only if the program turns out to
      declare nothing.
      — scoped to `lint`/`build`, per the spec's own scenarios; `run` keeps `-m`
      required.
- [x] 3.2 `src/cli/lint.ts` and `src/cli/build.ts`: take the machine from the
      declaration when the caller named none, and from the caller when they did.
      An unregistered name from either is the caller's mistake.
- [x] 3.3 `src/cli/usage.ts`: say that a program declaring its machine need not be
      given one.
- [x] 3.4 `src/cli/lint.test.ts`, `build.test.ts`, `args.test.ts`: a declaring
      program with no `-m` works; `-m` overrides a declaration; neither present is
      the caller's mistake with a message that mentions both ways of saying.

## 4. The IDE

- [x] 4.1 Opening a document that declares a machine makes it the active target.
- [x] 4.2 Switching the active target rewrites an existing declaration, and adds
      none where the document has none. This rides on the existing switch
      conversation rather than adding one.
- [x] 4.3 Colocated tests for both, including that a document with no declaration
      still has none after a switch.

## 5. Documentation

- [x] 5.1 `docs/reference/file-formats.md`: the declaration alongside `#BIN`,
      described as an end-user page — no source paths, no internal symbols.
- [x] 5.2 `docs/contributing/architecture.md`: the above-the-seam pass, in the
      section covering the language toolchain. If `refer-to-blocks-by-name` has
      landed, this extends the paragraph it added rather than adding a second.
      No machine lists, no counts.
- [x] 5.3 `CLAUDE.md`: the commands block, where `-m` is shown, notes it is
      optional for a declaring program.

## 6. Quality gates

- [x] 6.1 `npx vitest run src/dialects/ src/cli/ src/editor/ src/app/ src/share/`
      — the reader, the registry-driven byte-identity and position tests, and
      every caller rerouted in 2.3.
- [x] 6.2 `npm run typecheck && npm run lint && npm run format:check`.
- [x] 6.3 `npm run docs:build`, because `docs/reference/file-formats.md` and
      `docs/contributing/architecture.md` change.
- [x] 6.4 `npx openspec validate --specs`.
- [x] 6.5 `npm run e2e:chromium -- e2e/code-editor e2e/project-setup` — this
      change reaches the browser: opening a declaring document and switching the
      target are both app-visible. Leave unchecked with a note if the run fails.
      — 25/25 passed.
- [x] 6.6 By hand, with the bundle rebuilt:
      - `printf '#MACHINE zx81\n10 PRINT "HI"\n' | ./scripts/basically lint`
        succeeds with no machine named.
      - The same piped to `./scripts/basically lint -m commodore64` is read as a
        C64 program.
      - `printf '#MACHINE nosuch\n10 PRINT\n' | ./scripts/basically lint` fails as
        the caller's mistake, naming the line and column.
      - A declaring program built with and without `-m` naming the same machine
        produces byte-identical output.
