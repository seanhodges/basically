## 1. One vocabulary of actions

- [ ] 1.1 Move `parseDriveScript`, `runDriveScript`, `describe`, `DriveAction`,
      `DriveReport`, `DEFAULT_JOY_FRAMES` and `DEFAULT_WAIT_FOR_FRAMES` from
      `src/ai/driveTools.ts` into a new `src/app/driveScript.ts`, and have
      `driveTools.ts` import them from there. Move the parser and runner tests out
      of `src/ai/driveTools.test.ts` into `src/app/driveScript.test.ts` unchanged,
      so the vocabulary the assistant relies on is pinned byte for byte before
      anything grows. The tool definitions, `describeDriving` and every other
      assistant-facing export stay where they are.
- [ ] 1.2 Grow the parser: `#` comment lines are skipped; `PRESS` takes a `+`-joined
      chord (`PRESS SHIFT+P`) as several names pressed together; `WAIT FOR "<text>"
      [n]` takes an optional cap in frames after a quoted needle; `WAIT END [n]`
      runs until the program stops, capped at `n` or the wait-for default;
      `EXPECT "<text>"`, `EXPECT NOT "<text>"`, `EXPECT STOPPED` and
      `EXPECT RUNNING` are expectations. Every existing script still parses to the
      same actions - the moved tests are the proof.
- [ ] 1.3 Give `MachineControl` (`src/app/machineControl.ts`) the two members the
      new lines need: `programState()` reading `machine.isProgramRunning()`, and
      `waitForEnd(maxFrames)` which steps until the program has stopped or the cap
      is spent, bounded by `MAX_DRIVE_FRAMES` like every other step. Update the stub
      control in the assistant's tests.
- [ ] 1.4 Extend `runDriveScript`: an expectation is a step that costs no frames and
      fails the script the way a timed-out wait does - a `screen` expectation
      matches a row at a time with spaces collapsed, exactly as `waitForText`
      does; `WAIT END` calls `waitForEnd`. Extend `describe` so each new action
      reads as a sentence in the report.
- [ ] 1.5 Write `src/app/driveScript.test.ts` cases for the new lines: comments
      vanish; a chord presses its names together; the wait-for cap is read; `WAIT
      END` and each `EXPECT` form parse; a failed expectation stops the script and
      names itself; a passing one costs no frames.
- [ ] 1.6 Add `programState` and `waitForEnd` cases to
      `src/app/machineControl.test.ts` on the real ZX81 ROM: a program that prints
      and stops is seen to stop within the cap; a `GOTO` loop is still running when
      the cap runs out and the step says so.

## 2. Key names that mean the same on every machine

- [ ] 2.1 Create `src/keyboard/keyNames.ts` with `resolveKeyName(layout, name)`
      returning the tokens to press, or undefined: the machine's own key id first;
      then a letter or digit matched case-insensitively against an id stripped of
      its `Key`/`Digit` prefix or against a key's base-layer legend; then the named
      keys (`SPACE`, `ENTER`, `SHIFT`, `DELETE`, `ESCAPE`, `BREAK`, `STOP`, `CTRL`,
      `TAB`, `F0`-`F9`, `UP`/`DOWN`/`LEFT`/`RIGHT`) matched the same way, with an
      alias table for `ENTER`/`RETURN`/`NEWLINE`, `DELETE`/`BACKSPACE`/`RUBOUT` and
      `ESCAPE`/`ESC`. A cursor key resolves through the layout's CURSOR legend
      where one exists, using `resolveEmits` from `src/keyboard/editorActions.ts`
      as `cursorKeys.test.ts` does. Also export `keyVocabulary(layout)`: the
      machine-independent names this layout resolves, sorted.
- [ ] 2.2 Make `pressKeys` in `src/app/machineControl.ts` resolve each name through
      `resolveKeyName` rather than the raw id index, keeping its failure message
      naming the key. `keyNames()` and `driveKeyNames` keep returning the ids.
- [ ] 2.3 Write `src/dialects/keyNames.test.ts` as one registry-driven test: for
      every registered machine, every letter, every digit, `SPACE`, `ENTER` and
      `SHIFT` resolve to non-empty tokens, with the machine and the name in the
      assertion message; and a second `it` asserting that the assistant's own ids
      (`driveKeyNames`) all still resolve. Where the run shows a machine whose
      keyboard genuinely lacks one of these, excuse it by name with the reason,
      the way `caseKeys.test.ts` does - and where it shows a layout declaring too
      little, fix the layout, not the resolver.
- [ ] 2.4 Add a case to `src/app/machineControl.test.ts` driving the ZX81 by
      vocabulary names (`A`, `ENTER`, `SPACE`) rather than ids, so the resolution is
      proved on a ROM and not only on data.
- [ ] 2.5 Add `keys: string[]` to the description in `src/cli/info.ts` -
      `keyVocabulary` first, the layout's own ids after - and to the readable form
      as a single wrapped line. Extend the registry-driven table in
      `src/cli/info.test.ts` to assert every machine lists at least the letters and
      `ENTER`.

## 3. The runner's hook

- [ ] 3.1 Add `drive?: (machine: MachineEmulator, step: () => void) => void` to
      `RunOptions` in `src/dialects/headless/runListing.ts`, called once after
      `loadProgram` and its microtask yield, before the runner's loop, where `step`
      is the runner's frame advance counting into a new `driveFrames` on
      `RunResult`. When `drive` is given, the runner's own loop runs only the
      `frames` the caller asked for and never waits for the program to end; the
      settle frames still run when the program is seen to have stopped.
- [ ] 3.2 Write `src/dialects/headless/runListing.test.ts`: an `INKEY$` program on a
      machine that queues its boot on a microtask (the BBC or the C64) is driven
      past its prompt through the hook using `createMachineControl`, the printed
      text is on the returned screen, `driveFrames` counts what the schedule spent,
      and a run with a hook and no `frames` ends when the hook returns rather than
      at the cap.

## 4. The command line's grammar and operations

- [ ] 4.1 In `src/cli/args.ts`, add `--keys <script>` to `run`, refusing `--keys`
      together with `--max-frames` as a caller's mistake; add the `test` operation:
      `test [file] -m <machine> --spec <path> [--json] [--rom-root <dir>]`, where
      `--spec` is required. Add `test` to `OPERATIONS` and to the per-operation
      help in `src/cli/usage.ts`, documenting the vocabulary in the `run` and
      `test` help blocks (one shared block, referenced from both, rather than two
      copies). Extend `src/cli/args.test.ts` for each.
- [ ] 4.2 Create `src/cli/drive.ts`: `parseSchedule(text)` splits inline text on
      newlines and on semicolons outside quotes, hands the result to
      `parseDriveScript`, and throws `RunError` naming the first malformed line;
      `driveHook(dialect, actions)` builds the runner's `drive` callback over
      `createMachineControl` (joystick through the dialect's first declared mode
      when it has one, else key-mapped; fire buttons from the dialect) and
      captures the `DriveReport`, releasing every key when the script ends
      however it ends. Test both in `src/cli/drive.test.ts`.
- [ ] 4.3 Create `src/cli/test.ts`: `testListing({ machine, source, spec, romRoot })`
      refuses a ROM-less machine with `RunError` before booting, runs the program
      under the schedule through `runListing`, and returns a `TestOutcome`:
      `ok`, every step with its description, frames and outcome, the failing
      step's line and detail when there is one, and the screen lines as they
      stood. Add `formatTestOutcome` for the readable report. Test in
      `src/cli/test.test.ts` on the ZX81: a spec that holds passes; one naming text
      never printed fails at that line with the screen attached; one with an
      unreadable line throws `RunError` without booting.
- [ ] 4.4 In `scripts/headless/cli.mts`, wire `run --keys`: refuse a ROM-less
      machine as a bad request, pass the hook, report each step on standard
      error, still print the screen, and exit 2 when a step failed; under `--json`
      add the steps and `driveFrames`. Wire `test`: read the spec file (an
      unreadable path is a bad request), print the readable report or the JSON on
      standard output, and exit 0 on a pass, 2 on a failure.

## 5. Documentation

- [ ] 5.1 Update the commands section of `CLAUDE.md`: one `run --keys` example
      that gets past a prompt and one `test --spec` example, and mention that both
      need a ROM.
- [ ] 5.2 Update `docs/contributing/architecture.md`: add `test` to the headless
      toolchain diagram's operations, and a sentence saying that `run --keys` and
      `test` drive the machine through the same driver and script vocabulary the
      assistant uses (`src/app/machineControl.ts`, `src/app/driveScript.ts`), with
      key names resolved by `src/keyboard/keyNames.ts` and held to every machine by
      `src/dialects/keyNames.test.ts`. No machine lists, no counts.

## 6. Quality gates

- [ ] 6.1 `npx vitest run src/app/ src/keyboard/ src/cli/ src/dialects/headless/ src/dialects/keyNames.test.ts src/ai/driveTools.test.ts src/ai/driveTurn.test.ts src/ai/aiStore.test.ts`
      - the moved and grown vocabulary, the driver, the resolver and its
      registry-driven table, the runner's hook, the new operations, and the
      assistant tests that consume the moved code.
- [ ] 6.2 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 6.3 `npm run docs:build`, because `docs/contributing/architecture.md` changes.
- [ ] 6.4 `npx openspec validate --specs`
- [ ] 6.5 No e2e run: `headless-cli` has no browser surface, and the assistant's
      driving in the browser is unchanged in behaviour - its tests in 6.1 are the
      gate.
- [ ] 6.6 By hand, with the bundle rebuilt: `./scripts/basically run <an INKEY$
      listing> -m zx81 --keys 'WAIT FOR "PRESS"; PRESS A; WAIT FOR "WENT ON"'`
      prints the screen and exits 0; the same with a wait for text never printed
      exits 2 and still prints the screen; `--keys 'NONSENSE'` exits 1 before any
      boot; the same schedule with `-m commodore64` presses the C64's own keys;
      `./scripts/basically test <listing> -m zx81 --spec <a spec that holds>`
      exits 0 and one that does not exits 2 naming the line; `basically info
      zx81 --json` lists `keys`; and with the ROM directory moved aside, `run
      --keys` and `test` exit 1 saying the ROM is missing while a plain `run`
      still reports it as a condition.
