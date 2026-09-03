## 1. The argument grammar

- [x] 1.1 Create `src/cli/args.ts` holding the whole grammar as a pure function
      over an argv array: the operation name, then per-operation options. It reads
      nothing and writes nothing — no `process`, no filesystem — and throws the
      listing runner's existing `RunError` (`src/dialects/headless/runListing.ts`)
      for anything the caller got wrong, so the shim has one error type to map to
      exit code 1.
- [x] 1.2 Support the five operations and their options: `machines [--json]`;
      `info <machine> [--json]`; `lint <file> -m|--machine <machine> [--json]`;
      `build <file> -m <machine> -o|--out <path> [-t|--target <id>]
      [--program-name <name>]`; `run <file> -m <machine> [--frames n]
      [--max-frames n] [--screen-text] [--screenshot <path>] [--json]
      [--rom-root <dir>]`. A file path of `-` or an absent path means standard
      input. Reuse the existing positive-integer validation rather than writing a
      second one.
- [x] 1.3 Create `src/cli/usage.ts` with the help text: a summary listing every
      operation, and per-operation help. `--help`/`-h` with no operation prints the
      summary; with an operation, that operation's own help.
- [x] 1.4 Write `src/cli/args.test.ts`: every operation parses; `-` and an absent
      path both select stdin; an unknown operation, an unknown option, a missing
      `-m`, a missing `-o` on `build` and a non-numeric `--frames` each throw. Also
      assert the old grammar is gone — a bare machine name as the first argument is
      an unknown operation now, not a run.

## 2. Describing machines

- [x] 2.1 Create `src/cli/machines.ts` returning the registered machines as data:
      identifier, name, description, and whether the ROM is present. Build it on
      the existing `machineList()` and `hasRom()` (`src/dialects/bootHarness.ts`)
      rather than re-walking the registry.
- [x] 2.2 Create `src/cli/info.ts` returning one machine's full description, every
      field read from what the dialect declares: the program memory budget, the
      memory map where one is declared, the BASIC rules (statement separator,
      whether the dialect is crunched, whether it takes binary line records, letter
      case, operators), the keywords with their kind, signature and documentation,
      the declared build targets, the declared binary imports, and ROM presence. It
      must not boot a machine or read a ROM.
- [x] 2.3 Write `src/cli/info.test.ts` as a registry-driven table — one `it` looping
      every registered machine, naming the offending machine in the assertion
      message, per the unit-test conventions in `CLAUDE.md`. Assert every machine
      yields a description with a non-empty name, a positive memory budget, at least
      one keyword and at least one build target; and assert the description is
      derived, not duplicated, by checking a couple of machines' figures against the
      dialect's own declarations.

## 3. Checking a program

- [x] 3.1 Create `src/cli/lint.ts` calling the dialect's `lint()` dry-run and
      returning the problems plus whether any is fatal, using the existing
      `hasFatalErrors()` from `src/dialects/types.ts`. It must not tokenize to an
      image, boot a machine or touch a ROM.
- [x] 3.2 Write `src/cli/lint.test.ts`: a clean listing yields no problems and is
      not fatal; a listing with a real syntax error for its machine yields a problem
      at the right line and column and is fatal; a listing whose only problems are
      advisory (`fatal: false`) is not fatal. Pick machines whose tokenizers already
      have colocated tests establishing what is an error, so this test does not
      become a second source of truth about any dialect.

## 4. Building a program

- [x] 4.1 Create `src/cli/build.ts` returning the produced files as
      `{ fileName, bytes }` plus which target was chosen and the program's byte
      size. Target selection: an explicit target id, else the first target whose
      declared extension matches the requested output path's extension, else the
      dialect's first target. It refuses to build when tokenizing finds a fatal
      problem, and reads the blob's bytes rather than assuming a shape.
- [x] 4.2 Write `src/cli/build.test.ts`: selection by explicit id, selection by
      output extension, and the fallback when neither settles it; a fatal listing
      refuses to build; a built file's bytes are non-empty. `exportImportRoundTrip`
      (`src/dialects/exportRoundTripHarness.ts`) is the precedent for driving a
      build target from node — follow it rather than inventing a second approach.

## 5. The process shim and the entry script

- [x] 5.1 Rewrite `scripts/headless/cli.mts` as a shim over `src/cli/`: read argv,
      read the program from the named file or from standard input, dispatch to the
      operation, write any output files, and exit. Keep `readStdin()` and
      `divertLogging()` (the emulator logs each ROM it loads, and that must never
      reach standard output). Keep the run reporting that exists today, on standard
      error.
- [x] 5.2 Apply the stream rule everywhere: standard output carries only the
      product — screen text, structured data, or the problems a check found —
      and standard error carries every figure, timing, notice and the list of paths
      a build wrote.
- [x] 5.3 Apply the exit-code rule: 0 succeeded; 1 the caller's mistake (the
      `RunError` path); 2 the program is at fault (a fatal problem while checking,
      building or running).
- [x] 5.4 Reshape `run`'s flags: `--screenshot <path>` replaces `--png` and the
      positional `png` mode word, `--screen-text` names what was the default, and
      both may be given in one run — write the picture and report the text from the
      same run. Drop the positional `text|png` mode word entirely.
- [x] 5.5 `git mv scripts/run-listing.sh scripts/basically.sh`, and update the
      progress notice it prints from `[run-listing]` to `[basically]`. The
      build-when-stale mechanism and the source list it watches are unchanged; add
      `src/cli` to the watched sources so an edit there rebuilds the bundle.
- [x] 5.6 Confirm `scripts/headless/build.mjs` still needs no change — it bundles
      the same entry point, and `src/cli/` is reached by import. If the bundle grows
      a new import shape (it should not), fix it there rather than in the shim.

## 6. Documentation

- [x] 6.1 Update the commands section of `CLAUDE.md`: replace the two
      `./scripts/run-listing.sh` examples with the new invocations, keeping one
      piped example so the stdin form stays discoverable, and mention that
      `machines`, `info`, `lint` and `build` need no ROM. This is the only file
      outside `scripts/` that names the old tool.

## 7. Quality gates

- [x] 7.1 `npx vitest run src/cli/ src/dialects/headless/ src/dialects/screenPaints.test.ts`
      — the new tests plus the two existing suites that consume the headless seam
      this change reorganises around.
- [x] 7.2 `npm run typecheck && npm run lint && npm run format:check`
- [x] 7.3 `npx openspec validate --specs`
- [x] 7.4 No e2e run: `headless-cli` has no browser surface, and nothing in the
      browser app changes. The capability therefore has no `e2e/` folder, which
      `src/e2eCapabilityLayout.test.ts` permits — its check is one-way, so a
      capability without browser coverage is legal.
- [x] 7.5 By hand, with the bundle rebuilt from a clean tree, confirm each
      operation end to end and that the streams and exit codes behave:
      `./scripts/basically.sh machines --json`;
      `./scripts/basically.sh info zx81 --json`;
      `./scripts/basically.sh lint <a clean listing> -m zx81` (exit 0) and a listing
      with a real error (exit 2);
      `./scripts/basically.sh build <listing> -m zx81 -o /tmp/prog.p`;
      `printf '10 PRINT "HI"\n' | ./scripts/basically.sh run -m commodore64 --screen-text`;
      `./scripts/basically.sh run <listing> -m bbcmicro --frames 500 --screenshot /tmp/bbc.png --screen-text`;
      and `./scripts/basically.sh nonsense` (exit 1).
- [x] 7.6 By hand, confirm the ROM-less promise: with `machines`, `info`, `lint` and
      `build` run against a checkout whose ROM directory is moved aside, each still
      succeeds. This is what the packaging change depends on, so it is verified here
      rather than assumed there.
