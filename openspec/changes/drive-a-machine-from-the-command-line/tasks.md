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
      runs until the program stops, capped at `n` or the wait-for default. Every
      existing script still parses to the same actions - the moved tests are the
      proof.
- [ ] 1.3 Give `MachineControl` (`src/app/machineControl.ts`) the two members
      `WAIT END` needs: `programState()` reading `machine.isProgramRunning()`, and
      `waitForEnd(maxFrames)` which steps until the program has stopped or the cap
      is spent, bounded by `MAX_DRIVE_FRAMES` like every other step. Update the stub
      control in the assistant's tests.
- [ ] 1.4 Extend `runDriveScript` so `WAIT END` calls `waitForEnd`, and extend
      `describe` so it reads as a sentence in the report.
- [ ] 1.5 Write `src/app/driveScript.test.ts` cases for the new lines: comments
      vanish; a chord presses its names together; the wait-for cap is read; `WAIT
      END` parses and runs.
- [ ] 1.6 Add `programState` and `waitForEnd` cases to
      `src/app/machineControl.test.ts` on the real ZX81 ROM: a program that prints
      and stops is seen to stop within the cap; a `GOTO` loop is still running when
      the cap runs out and the step says so.

## 2. Key names that mean the same on every machine

- [ ] 2.1 Create `src/keyboard/keyNames.ts` with `resolveKeyName(layout, name)`
      returning the tokens to press or undefined, and `keyVocabulary(layout)`
      returning the names this layout answers to, sorted. Everything is derived
      from what the layout *declares* - `KeyLabel.editor` through
      `resolveEditorAction`, `KeyDef.modifier`, and `resolveEmits` for the tokens
      (all in `src/keyboard/editorActions.ts`). Nothing strips a `Key`/`Digit`
      prefix off an id and nothing matches a legend glyph; both silently press the
      wrong key, on the PMD 85 and on the `←` keycap respectively. Names come from:
      a base-layer `{ insert }` of one letter or digit (and `' '` as `SPACE`);
      the declared actions `newline` -> `ENTER`, `backspace` -> `DELETE`, and the
      four cursor actions read across layers so the `modeOnly` CURSOR overlay
      counts; `KeyDef.modifier` with the layout's shift role normalised to `SHIFT`;
      a small candidate id/legend table for `ESCAPE` and `BREAK`, which declare
      nothing to key on; and word legends for the rest, each under the name its own
      keycap carries. Aliases (`RETURN`/`NEWLINE`, `BACKSPACE`/`RUBOUT`, `ESC`)
      resolve but are not listed. `DEL` is deliberately NOT an alias of `DELETE` -
      the PMD 85's `Del` is `act('DEL','delete')`, a forward delete. Function keys
      are never renumbered: the BBC and CPCs start at `f0`, the C64 at `f1`. A
      machine's own key id resolves last, as a fallback. Empty tokens count as not
      resolving, not as a press that sends nothing.
- [ ] 2.2 Make `pressKeys` in `src/app/machineControl.ts` resolve each name through
      `resolveKeyName` rather than the raw id index, keeping its failure message
      naming the key, and deduplicate the tokens a chord resolves to (`PRESS
      SHIFT+LEFT` on a Spectrum yields `CapsShift` twice). Delete
      `MachineControl.keyNames()` and its two test stubs while here: it has no
      production caller, and leaving a second "the key names" export beside
      `keyVocabulary` is the drift this change removes.
- [ ] 2.3 Write `src/keyboard/keyNames.test.ts` - pure, no ROMs, fast, and
      registry-driven. For every registered machine the letters, the digits,
      `SPACE`, `ENTER` and `SHIFT` resolve to non-empty tokens, machine and name in
      the message. Every alias reaches the same tokens as its canonical name; an
      unknown name returns undefined rather than a neighbour; every layout id with
      non-empty emits still resolves. `keyVocabulary` equals itself across calls and
      equals its own sort. No keycap name shadows a concept name with different
      tokens, and no concept resolves to two different token lists. Pin the PMD 85
      by name: `Z` resolves to the key that types `Z` (which emits `KeyY`) and
      explicitly not to the id `KeyZ`. For the concepts only some machines have
      (`DELETE`, `ESCAPE`, `CTRL`, the cursor names), carry an excuse table per
      concept in the house shape - `Record<dialectId, reason>` plus a meta-test
      that covered and excused together account for the registry, as
      `cursorKeys.test.ts` does. Fill those tables from the first failing run
      rather than by hand.
- [ ] 2.4 Add a case to `src/app/machineControl.test.ts` driving the ZX81 by
      vocabulary names (`A`, `ENTER`, `SPACE`) rather than ids, so the resolution is
      proved on a ROM and not only on data.
- [ ] 2.5 Add `keys: string[]` to the description in `src/cli/info.ts` from
      `keyVocabulary`, and to the readable form as a single wrapped line. Extend
      the registry-driven table in `src/cli/info.test.ts` to assert every machine
      lists at least the letters, the digits, `SPACE`, `ENTER` and `SHIFT` - the
      part of the vocabulary every registered machine has.
- [ ] 2.6 No `src/dialects/keyNames.test.ts`. `src/ai/machineObservability.test.ts`
      already boots every registered dialect on its real ROM and asserts every name
      the assistant is offered can be pressed and emits something; task 3 repoints
      that list at the vocabulary, which makes this existing test the ROM-level
      proof for both callers. A second battery booting every machine would be among
      the slowest files in the suite for no fact the first does not establish.

## 3. One vocabulary, including for the assistant

- [ ] 3.1 Delete `driveKeyNames` from `src/ai/machineObservability.ts` and have
      `buildDriveRules` call `keyVocabulary(dialect.keyboardLayout)` directly - two
      exported functions that both look like "the key names" is the drift this
      change removes. Its doc comment's substance moves to `keyVocabulary`, minus
      the part explaining why the names are each machine's own, which is what this
      reverses. Every property the prompt depends on is kept: derived from the
      `Dialect` with no emulator booted, sorted with a plain `.sort()`, upper-cased
      with `toUpperCase` rather than its locale-sensitive twin, and so byte-stable
      per dialect for prefix caching. A locale-dependent sort would not be caught
      by the stability test, which composes twice in one process.
- [ ] 3.2 Reword the one bullet of `buildDriveRules` that lists the machine's keys
      so it names the vocabulary. Say that these names mean the same key on every
      machine, and keep the existing promise that nothing outside the list is a key
      here. Leave the rest of the section, the `basic-view` `DRIVE` request and
      every tool description untouched.
- [ ] 3.3 Repoint the every-machine ROM crosscheck in
      `src/ai/machineObservability.test.ts` at `keyVocabulary`, so the test that
      already boots every registered dialect and presses every offered name becomes
      the vocabulary's proof on real ROMs. One line needs care: it reads
      `index.get(name)!.emits.length`, which assumes the name is an id and will
      throw on a vocabulary name - it becomes the resolver's own result. Add an
      `it` asserting every layout id still resolves, which is what guards the
      already-written scripts and the browser spec's `PRESS KeyA`.
- [ ] 3.4 Add the wrong-key proof to `src/dialects/caseKeys.test.ts`, which already
      boots the PMD 85 and echoes a typed letter back off the screen: assert that
      pressing what `Z` resolves to actually types `Z`. This is the assertion an
      id-stripping resolver fails, on a real ROM, and it costs no new boot. The
      resolver test proves the tokens; only this proves the machine agrees.
- [ ] 3.5 Run `src/ai/promptStability.test.ts` and re-record any budget that moved.
      The vocabulary should be shorter than today's token list - twenty-six
      one-character names replacing twenty-six four-character ids dominates - and
      the budgets are ceilings, so this is expected to be a no-op. If a machine's
      prompt grew, find out why before changing a number. Note in the change that
      every cached prefix in the wild is invalidated once when the driving rules
      change, so the one-off cost is not mistaken for a regression later.

## 4. The runner's hook

- [ ] 4.1 Add `drive?: (machine: MachineEmulator, step: () => void) => void` to
      `RunOptions` in `src/dialects/headless/runListing.ts`, called once after
      `loadProgram` and its microtask yield, before the runner's loop, where `step`
      is the runner's frame advance counting into a new `driveFrames` on
      `RunResult`. When `drive` is given, the runner's own loop runs only the
      `frames` the caller asked for and never waits for the program to end; the
      settle frames still run when the program is seen to have stopped.
- [ ] 4.2 Write `src/dialects/headless/runListing.test.ts`: an `INKEY$` program on a
      machine that queues its boot on a microtask (the BBC or the C64) is driven
      past its prompt through the hook using `createMachineControl`, the printed
      text is on the returned screen, `driveFrames` counts what the schedule spent,
      and a run with a hook and no `frames` ends when the hook returns rather than
      at the cap.

## 5. The command line's grammar and operation

- [ ] 5.1 In `src/cli/args.ts`, add `--keys <script>` to `run`, refusing `--keys`
      together with `--max-frames` as a caller's mistake. Document the vocabulary
      in the `run` help block in `src/cli/usage.ts`. Extend `src/cli/args.test.ts`.
- [ ] 5.2 Create `src/cli/drive.ts`: `parseSchedule(text)` splits inline text on
      newlines and on semicolons outside quotes, hands the result to
      `parseDriveScript`, and throws `RunError` naming the first malformed line;
      `driveHook(dialect, actions)` builds the runner's `drive` callback over
      `createMachineControl` (joystick through the dialect's first declared mode
      when it has one, else key-mapped; fire buttons from the dialect), captures
      the `DriveReport` on a returned handle, and releases every key when the
      script ends however it ends. Test both in `src/cli/drive.test.ts`.
- [ ] 5.3 In `scripts/headless/cli.mts`, wire `run --keys`: refuse a ROM-less
      machine as a bad request, pass the hook, report each step on standard
      error, still print the screen, and exit 2 when a step failed; under `--json`
      add the steps and `driveFrames`.

## 6. Documentation

- [ ] 6.1 Update the commands section of `CLAUDE.md`: one `run --keys` example
      that gets past a prompt, and mention that it needs a ROM.
- [ ] 6.2 Update `docs/contributing/architecture.md`: say that `run --keys` and the
      assistant drive the machine through one driver and one script vocabulary
      (`src/app/machineControl.ts`, `src/app/driveScript.ts`), with key names
      resolved from what each layout declares by `src/keyboard/keyNames.ts`, held
      to every machine by `src/keyboard/keyNames.test.ts` and proved on real ROMs
      by the crosscheck in `src/ai/machineObservability.test.ts`. No machine lists,
      no counts.

## 7. Quality gates

- [ ] 7.1 `npx vitest run src/app/ src/keyboard/ src/cli/ src/dialects/headless/ src/ai/`
      - the moved and grown vocabulary, the driver, the resolver, the runner's
      hook, the new operation, and the whole assistant side: the every-machine ROM
      crosscheck that now proves the vocabulary, the prompt's stability budgets,
      and the tests that consume the moved code. `src/ai/` runs whole rather than
      by file because this change reaches its prompt as well as its parser.
- [ ] 7.2 `npm run typecheck && npm run lint && npm run format:check`
- [ ] 7.3 `npm run docs:build`, because `docs/contributing/architecture.md` changes.
- [ ] 7.4 `npx openspec validate --specs`
- [ ] 7.5 `npm run e2e:chromium -- e2e/ai-assistant` - this change now reaches a
      browser capability. `e2e/ai-assistant/driving.spec.ts` drives with
      `PRESS KeyA` and asserts the report says `pressed KeyA`, so a green run is
      also the proof that a machine's own names stay accepted after the assistant
      stops being told them. `headless-cli` still needs no e2e: it has no browser
      surface.
- [ ] 7.6 By hand, with the bundle rebuilt: `./scripts/basically run <an INKEY$
      listing> -m zx81 --keys 'WAIT FOR "PRESS"; PRESS A; WAIT FOR "WENT ON"'`
      prints the screen and exits 0; the same with a wait for text never printed
      exits 2 and still prints the screen; `--keys 'NONSENSE'` exits 1 before any
      boot; the same schedule with `-m commodore64` presses the C64's own keys;
      `basically info zx81 --json` lists `keys`; and with the ROM directory moved
      aside, `run --keys` exits 1 saying the ROM is missing while a plain `run`
      still reports it as a condition.
