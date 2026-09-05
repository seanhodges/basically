## 1. Machine inference from binary bytes

- [ ] 1.1 Add `src/dialects/binaryFormatLookup.ts`: given an optional file name,
      return every registered dialect whose `binaryImports` declares a matching
      extension.
- [ ] 1.2 Add a colocated `src/dialects/binaryFormatLookup.test.ts` that iterates
      every dialect declaring `binaryImports` (registry-driven, not one test per
      dialect): an unambiguous extension resolves to exactly that dialect, an
      extension more than one dialect declares returns every candidate, and an
      unrecognized extension returns none.

## 2. The `convert` operation

- [ ] 2.1 Add `src/ops/convert.ts`: `convertOp: Operation<ConvertInput,
      ConvertOutcome>` with `needs: 'nothing'`. Input `{ base64: string;
      fileName?: string; machine?: string }`; decode via `decodeBytes`
      (`src/ops/bytes.ts`). Resolve the machine via `requireMachine` when named,
      otherwise via the binary-format lookup from Section 1, raising a
      `RunError` that names every candidate when more than one matches and when
      none does. Call `importProgram` (`src/app/importProgram.ts`) with the
      resolved dialect and decoded bytes; base64-encode any byte payloads
      (`blocks`, `bootDisc`) in the outcome the same way `src/ops/build.ts`
      encodes its output files. Write `describe()` as prose (machine name,
      source line count, every warning, any recovered blocks/tape files/
      auto-start line); no `failed()`.
- [ ] 2.2 Confirm `importProgram` has no browser/DOM/store dependency that would
      violate `src/ops/`'s import restrictions (checked by `eslint.config.js`);
      relocate or re-export it if it does.
- [ ] 2.3 Add a colocated `src/ops/convert.test.ts`, modeled on
      `src/ops/build.test.ts`: a happy-path conversion with real bytes, refusing
      an unregistered/ambiguous/unmatched machine (`rejects.toThrow(RunError)`),
      and asserting `describe()`'s prose surfaces every warning without leaking
      raw base64 payloads into the model-facing text.
- [ ] 2.4 Register `convertOp` in `src/ops/registry.ts`'s `OPERATIONS` array
      (append, since the array's order is load-bearing for the assistant's
      tool-definition cache).

## 3. Caller parity

- [ ] 3.1 Add the `convert`/`assistant` exemption to `src/ops/parity.ts`'s
      `EXEMPTIONS` table (reason: no path from the model to bytes on the user's
      disk; the browser's Import dialog already covers this inside the IDE).
      Declare `cli: { kind: 'operation', name: 'convert' }` and
      `mcp: { kind: 'tool' }` on `convertOp` (no MCP exemption is permitted).
- [ ] 3.2 Add `convert` entries to `src/ops/parity.test.ts`'s `argv` and
      `inputs` maps (these tests iterate `OPERATIONS` generically and need a
      case for every operation).

## 4. Command-line wiring

- [ ] 4.1 Add `'convert'` to the `OPERATIONS` list and a `ConvertArgs` type in
      `src/cli/args.ts`; add `parseConvert()` (flags: `-m`/`--machine` optional,
      `-o`/`--out` optional — output goes to stdout when omitted) and its arm in
      `parseArgs`'s switch.
- [ ] 4.2 Add the `OPERATION_USAGE.convert` help block and its `SUMMARY` line in
      `src/cli/usage.ts`, pointing to `basically build` for the reverse
      direction.
- [ ] 4.3 Add a binary-safe file reader alongside `readProgram` in
      `scripts/headless/cli.mts` (the existing one is UTF-8-text-only), a
      `convert()` function that calls `convertOp.run`, writes to `-o` or stdout,
      and reports warnings/exit codes (`EXIT_BAD_REQUEST` for an unreadable
      file or an unresolved/ambiguous machine), and its arm in `main()`'s
      switch.
- [ ] 4.4 Add `parseConvert` unit tests alongside the existing `parseBuild`
      coverage for `src/cli/args.ts`.

## 5. Spec sync and quality gates

- [ ] 5.1 Note that `openspec/specs/headless-cli/spec.md` picks up this
      change's `specs/headless-cli/spec.md` delta at archive time
      (`/opsx:sync` or `/opsx:archive`); no action here beyond keeping the delta
      accurate as the implementation lands.
- [ ] 5.2 Run `npm run typecheck`, `npm run lint`, and `npm run format:check`
      (or `npm run format`), plus targeted `npx vitest run` for every file
      touched above (`src/dialects/binaryFormatLookup.test.ts`,
      `src/ops/convert.test.ts`, `src/ops/parity.test.ts`, and whatever file
      covers `src/cli/args.ts`). No e2e task: `headless-cli` has no browser UI
      and no `e2e/headless-cli` folder — it is a Node CLI/MCP surface, covered
      by unit tests.
