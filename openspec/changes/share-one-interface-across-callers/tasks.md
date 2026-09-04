## 1. The operation layer

- [x] 1.1 Define the operation declaration in `src/ops/types.ts`: name, summary, input schema, what it needs to run, how the command line reaches it, and a function from input and context to a serialisable outcome. Include the context type and the route type.
- [x] 1.2 Add `src/ops/registry.ts` listing every declared operation, and a lookup by name.
- [x] 1.3 Move `machines`, `info`, `lint` and `build` in as declarations, keeping their outcome types unchanged and leaving their formatters where the command line renders them.
- [x] 1.4 Encode the built program's bytes so every outcome survives being written as JSON, and adjust the command line's shim to decode before writing files.
- [x] 1.5 Reduce `src/cli/{machines,info,lint,build}.ts` to shims over the registry, so the command line's behaviour and output are unchanged.
- [x] 1.6 Have `src/cli/args.ts` produce each operation's input object rather than its own shape, keeping the grammar, options and help text exactly as they are.
- [x] 1.7 Add the lint boundary refusing imports of `node:*`, the DOM and the store from `src/ops/**`, alongside the existing reference-table boundary in `eslint.config.js`.
- [x] 1.8 Colocated `src/ops/*.test.ts` per moved operation, calling `run(input, ctx)` directly, replacing the equivalent `src/cli/*.test.ts` coverage.

## 2. Parity, declared and enforced

- [x] 2.1 Add the exemption table with a reason per entry, seeded with today's asymmetries: running a program on the assistant's side, and stating what a program should produce on the command line's side, the latter noting `test-a-program-from-either-caller` as what closes it.
- [x] 2.2 `src/ops/parity.test.ts`: every declared operation resolves to a real command line route and renders a tool definition, or carries an exemption.
- [x] 2.3 Assert the other direction in the same test: an entry naming an operation that is in fact present on both surfaces fails, so wiring one up forces its exemption out.
- [x] 2.4 Assert that a provider unable to be given tools is read as a property of that provider and not as any operation being absent.
- [x] 2.5 Declare the schedule's action kinds as a list, and assert each is accepted by the parser and named in both callers' descriptions — including how one action is separated from the next.
- [x] 2.6 Assert every operation's outcome survives being written as JSON and read back unchanged, and that every schema accepts the input the command line's parser produces for it.
- [x] 2.7 `src/ops/toolStability.test.ts`: the rendered tool definitions are identical bytes across the turns of a conversation, per provider, in the manner of the existing prompt-stability test.

## 3. The machine session

- [x] 3.1 Generalise the driver into a machine session: what it can already do, plus capturing the display, reporting a run's measurements, its timing, and its variables.
- [x] 3.2 Extract the per-frame folding of a run's measurements out of `EmulatorPane.tsx` into a pure module beside `src/app/runProfile.ts`, keeping the existing sampling and publishing cadences and their reasons.
- [x] 3.3 Colocated tests for that fold, asserting it produces what the pane produced for the same sequence of frames.
- [x] 3.4 Implement the browser session over the live driver, the display capture and the store's readings; have the pane register it in place of the driver.
- [x] 3.5 Implement the headless session over a machine the runner owns, painting the display through the headless canvas and folding measurements with the module from 3.2.
- [x] 3.6 Colocated tests booting a real machine headlessly and reading back a measurement, a timing and a variable.

## 4. The machine operations, and the gaps closed

- [x] 4.1 Declare `drive`, `look`, `screenshot`, `profile` and `time` as operations needing a session.
- [x] 4.2 Derive the assistant's tool definitions from the registry, keeping the set offered fixed for a conversation and deciding availability when a call arrives, as driving already does.
- [x] 4.3 Make the assistant's renderers the operations' own, so what it is told about a measurement, a timing and a screen is unchanged from today.
- [x] 4.4 Give the assistant `lint`, `build` and `info`, with the build reporting target and size and never bytes.
- [x] 4.5 Give the command line routes to the measurements, the timing and the variables, as options on running a program.
- [x] 4.6 Move the schedule's separator handling into the shared parser so a schedule means the same thing whoever wrote it, and describe every accepted action to both callers.
- [x] 4.7 Remove from the exemption table every entry the work above has made untrue, and confirm the parity test fails if any is left behind.

## 5. Documentation

- [x] 5.1 Update the toolchain section of `docs/contributing/architecture.md` and its diagram: one operation layer, two surfaces derived from it, and where the boundary now runs. Keep the vendored-core caveats heading.
- [x] 5.2 Add a row for the operation layer to the layers table, and note the parity test as the registry-driven check that holds both surfaces to one list.

## 6. Quality gates

- [x] 6.1 `npm run typecheck`
- [ ] 6.2 `npx vitest run src/ops/ src/cli/ src/ai/ src/app/` for the touched areas, then `npm test` once, since this change crosses the store, the editor's run path and both callers.
- [x] 6.3 `npm run lint` and `npm run format:check`
- [x] 6.4 `npm run docs:build`
- [ ] 6.5 `npm run e2e:chromium -- e2e/ai-assistant`
- [ ] 6.6 `npm run e2e:chromium -- e2e/profiling`
- [ ] 6.7 `npm run e2e:chromium -- e2e/program-execution`
- [x] 6.8 Compare the command line's output against the same invocations before the change — describing a machine as JSON, checking a program, and a driven run — and confirm each is byte-identical.
