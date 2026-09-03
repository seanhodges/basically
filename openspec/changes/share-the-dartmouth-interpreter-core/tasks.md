## 1. Move the interpreter, changing nothing but paths

- [ ] 1.1 `git mv src/dialects/ge235/interpreter src/emulator/dartmouth`, so the
      rename is recorded and `git log --follow` still reaches the 1965 work.
- [ ] 1.2 Fix the import paths the move breaks — `../../types` becomes
      `../../dialects/types` in `interpreter.ts`, `machine.ts` and
      `terminal.ts`; the four upward imports into `src/dialects/ge235/` become
      the longer relative path for now and are inverted in group 2.
- [ ] 1.3 Update the imports in `src/dialects/ge235/index.ts` and anywhere else
      that names the old path (`grep -rn "ge235/interpreter\|./interpreter/"`).
- [ ] 1.4 `npx vitest run src/dialects/ge235/ src/emulator/dartmouth/` — green,
      with **no test edited** but import paths. Commit this as a pure move
      before touching behaviour.

## 2. Introduce the machine profile

- [ ] 2.1 Add `src/emulator/dartmouth/profile.ts` with a `DartmouthProfile`
      interface. Document each field machine-independently: what it governs,
      its units, and what goes wrong if it is wrong. Members: the keyword
      table, the charset bundle (mapping, `cr`/`eom`/`space` codes,
      `plainChar`, `parseChar`), and the line/`GOSUB`/`DATA`/constant limits.
- [ ] 2.2 Add `src/dialects/ge235/profile.ts` holding the GE-235's values, each
      carrying **verbatim** the citation it has today — the span of `BA-1` it
      came from and the arithmetic. Do not compress a citation to a
      cross-reference.
- [ ] 2.3 Take the profile in the `Interpreter` constructor and thread it to the
      four call sites: `lex.ts` (keyword table), `program.ts` (charset codes and
      limits), `terminal.ts` (charset helpers). Delete the four imports that
      reached into `src/dialects/ge235/`.
- [ ] 2.4 Construct `Ge235InterpreterMachine` with the GE-235 profile, leaving
      it a thin shim in `src/dialects/ge235/machine.ts` implementing the same
      `MachineEmulator` members with the same semantics — including the
      `interpreter` accessor its tests use.
- [ ] 2.5 Confirm `src/emulator/dartmouth/` has no import edge into
      `src/dialects/<name>/` — only into `src/dialects/types.ts`.
      `grep -rn "dialects/ge235" src/emulator/dartmouth/` must be empty.
- [ ] 2.6 Decide where `FRAME_HZ` belongs (design.md leaves this open) and, if
      it stays in the core, say why in a comment so it does not read as an
      oversight.
- [ ] 2.7 `npx vitest run src/dialects/ge235/ src/emulator/dartmouth/` — green,
      still with no test edited beyond import paths. This is the change's
      safety argument; if a test needs its expectations changed, fix the source.

## 3. Name the GE-235's version and family

- [ ] 3.1 In `src/dialects/ge235/index.ts`: set
      `basicDialect: 'Dartmouth BASIC (February 1965)'`, add
      `basicFamily: 'Dartmouth BASIC'`, update `blurb` to
      `'The machine BASIC was born on. Runs Dartmouth BASIC (February 1965).'`
      (68 characters, under the 72 ceiling), and replace the comment that
      currently explains why `basicFamily` is omitted.
- [ ] 3.2 Mirror the version and blurb in the `ge235` entry of
      `src/reference/machines.ts` (it already declares
      `basicFamily: 'Dartmouth BASIC'`).
- [ ] 3.3 Update `basicDialect` in the `ge235` entry of `src/reference/facts.ts`.
- [ ] 3.4 `npx vitest run src/dialects/registry.test.ts src/reference/` — the
      blurb-contains-dialect assertion, the family resolution and the
      machines-crosscheck bijection all hold without editing a test.

## 4. Verify the whole change

- [ ] 4.1 Re-read the diff adversarially against `design.md`'s review test: read
      `src/dialects/ge235/profile.ts` alone and check every number against a
      1965 listing. If you cannot, a citation was lost — restore it.
- [ ] 4.2 `npm run typecheck && npm run lint && npm run format:check`
      (`npm run format` to fix). No `docs/` change, so no `docs:build`.
- [ ] 4.3 `npm test` — this change moves a file every registry-driven battery
      reaches through the `Dialect` seam, and renames a field three of them
      assert on, so the full suite is the right gate here rather than a
      targeted run.
- [ ] 4.4 No e2e run is required: nothing app-visible changes but the machine
      picker's label for one machine, which `registry.test.ts` and
      `machines-crosscheck.test.ts` already pin. Do not add an e2e task to
      claim otherwise.
