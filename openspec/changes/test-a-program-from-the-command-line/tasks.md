## 1. The assertion vocabulary

- [ ] 1.1 Extend the parser in `src/app/driveScript.ts` (from
      `drive-a-machine-from-the-command-line`) with four expectation forms:
      `EXPECT "<text>"`, `EXPECT NOT "<text>"`, `EXPECT STOPPED`,
      `EXPECT RUNNING`. Give `DriveAction` an `expect` variant carrying which form
      and, for the text forms, the needle.
- [ ] 1.2 Extend `runDriveScript` so an expectation costs no frames, matches the
      screen a row at a time with spaces collapsed exactly as `waitForText` does
      for the text forms, and reads `control.programState()` for `STOPPED`/
      `RUNNING`; a failed expectation stops the script and is reported the same
      way a failed action is. Extend `describe` so each expectation reads as a
      sentence in the report.
- [ ] 1.3 Write `src/app/driveScript.test.ts` cases: each `EXPECT` form parses;
      a passing expectation costs no frames and the script continues; a failing
      one stops the script and names itself; `EXPECT STOPPED`/`RUNNING` read the
      control's program state.

## 2. The `test` operation

- [ ] 2.1 In `src/cli/args.ts`, add the `test` operation:
      `test [file] -m <machine> --spec <path> [--json] [--rom-root <dir>]`, where
      `--spec` is required. Add `test` to `OPERATIONS` and its help block in
      `src/cli/usage.ts`, referencing the same vocabulary table `run --keys`
      documents rather than repeating it, and documenting the four `EXPECT`
      forms. Extend `src/cli/args.test.ts`.
- [ ] 2.2 Create `src/cli/test.ts`: `testListing({ machine, source, spec, romRoot
      })` refuses a ROM-less machine with `RunError` before booting, parses the
      spec with `parseSchedule` from `src/cli/drive.ts`, runs the program under it
      through `runListing` using `driveHook`, and returns a `TestOutcome`: `ok`,
      every step with its description, frames and outcome, the failing step's
      line and detail when there is one, and the screen lines as they stood. Add
      `formatTestOutcome` for the readable report. Test in `src/cli/test.test.ts`
      on the ZX81: a spec that holds passes; one naming text never printed fails
      at that line with the screen attached; one with an unreadable line throws
      `RunError` without booting; one with a failing `EXPECT NOT`/`STOPPED`/
      `RUNNING` fails at that line.
- [ ] 2.3 In `scripts/headless/cli.mts`, wire `test`: read the spec file (an
      unreadable path is a bad request), print the readable report or the JSON on
      standard output, and exit 0 on a pass, 2 on a failure.

## 3. Documentation

- [ ] 3.1 Update the commands section of `CLAUDE.md`: one `test --spec` example,
      and mention that it needs a ROM.
- [ ] 3.2 Update `docs/contributing/architecture.md`: add `test` to the headless
      toolchain diagram's operations, and extend the sentence
      `drive-a-machine-from-the-command-line` added about driving through the
      shared module to say `test` uses the same vocabulary. No machine lists, no
      counts.

## 4. Quality gates

- [ ] 4.1 `npx vitest run src/app/driveScript.test.ts src/cli/ src/ai/driveTools.test.ts`
      - the grown vocabulary, the new operation, and the assistant tests that
      consume the shared parser.
- [ ] 4.2 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 4.3 `npm run docs:build`, because `docs/contributing/architecture.md`
      changes.
- [ ] 4.4 `npx openspec validate --specs`
- [ ] 4.5 No e2e run: `headless-cli` has no browser surface.
- [ ] 4.6 By hand, with the bundle rebuilt: a spec file whose actions and
      expectations all hold makes `./scripts/basically test <listing> -m zx81
      --spec <path>` exit 0; a spec naming text never printed exits 2, naming the
      failing line; a spec with a bad line exits 1 before any boot; `--json`
      reports the same verdict as data; and with the ROM directory moved aside,
      `test` exits 1 saying the ROM is missing.
