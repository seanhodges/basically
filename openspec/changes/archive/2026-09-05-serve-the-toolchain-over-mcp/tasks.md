## 1. The dependency, proved before anything is built on it

- [x] 1.1 Add `@modelcontextprotocol/sdk` and record the licence check `openspec/config.yaml` requires of every new dependency, noting it is MIT against this project's GPL-3.0-or-later.
- [x] 1.2 Confirm it survives `scripts/headless/build.mjs` before writing anything that depends on it — `vscode-languageserver` needed a `createRequire` banner there, and a CJS dependency reached from ESM output is the same class of problem.

## 2. The third caller

- [x] 2.1 Add the route type and an `mcp?` member to the operation declaration in `src/ops/types.ts`, alongside `cli` and `assistant`.
- [x] 2.2 Add `'mcp'` to `Caller` in `src/ops/parity.ts` and handle it in `reachable()`.
- [x] 2.3 Declare the route on every operation in `src/ops/{machines,info,lint,build,run,check,drive,measure,expect}.ts` — all thirteen, with no exemption, since this caller both boots a machine and holds one.
- [x] 2.4 Extend `src/ops/parity.test.ts`: add `'mcp'` to `CALLERS` and an `mcpRouteExists()` beside `cliRouteExists` and `assistantRouteExists`, checking the operation is really rendered rather than merely declared.
- [x] 2.5 Reword the two exemption reasons in `src/ops/parity.ts` so each is particular to the caller it is claimed of, rather than reading as though there were only two callers.

## 3. The held machine

- [x] 3.1 `src/mcp/session.ts`: the one machine the server holds, built on `bootMachine`, `installNodeRomLoading`, `installCanvasGlobals`, `resolveTokenize` and `createHeadlessSession` — the sequence `src/ops/headlessSession.test.ts` already demonstrates — with a dispose that restores the installs in reverse.
- [x] 3.2 Let a queued load land before a program counts as loaded, as `runListing` does, or the Acorn, Atom and Commodore machines report an empty screen.
- [x] 3.3 Answer a second boot while one is held with the same thing every time, never nesting a second set of process-wide installs and never appearing to succeed while acting on the older machine.
- [x] 3.4 `src/mcp/session.test.ts`: boot and load; the screen reflecting what an earlier call did; frames spent only by calls that ask for them; reading twice with nothing in between giving the same screen; dispose; a second boot while one is held; disposal on disconnect.
- [x] 3.5 Confirm `src/dialects/headless/runListing.ts` and `src/ops/run.ts` are untouched and their tests still pass unedited.

## 4. The surface

- [x] 4.1 `src/mcp/tools.ts`: render the definitions from `OPERATIONS`, separately from `src/ops/tools.ts`, whose byte-stability constraint belongs to the assistant's prompt cache and not here.
- [x] 4.2 Dispatch a call in the same answering-rather-than-throwing manner as `runToolCall`: an unknown name, an input `schemaProblem` rejects, an operation needing a machine before one is up (saying how to get one), `op.failed?.()` reported as a failure, and `RunError` answered rather than thrown.
- [x] 4.3 `src/mcp/content.ts`: an outcome as content — prose from `op.describe`, plus an image where the outcome carries a picture, so `screenshot` and `run` serve the display as a display.
- [x] 4.4 `src/mcp/context.ts`: the `OpContext`, from `cliContext()` with the held session filled in.
- [x] 4.5 Colocated `src/mcp/*.test.ts` for each, including the picture's bytes surviving the round trip.

## 5. The transport

- [x] 5.1 `scripts/headless/mcp.mts`: streams and lifecycle only, mirroring `lsp.mts` — `divertLogging()`, a promise resolving on disconnect, disposal of any held machine on the way out, ending on a clean shutdown and on standard input closing alike.
- [x] 5.2 Add `'mcp'` to `OPERATIONS` in `src/cli/args.ts`, with `--stdio` and an optional `-m`.
- [x] 5.3 An `mcp` topic in `src/cli/usage.ts` saying how a client is expected to start it.
- [x] 5.4 A `case 'mcp'` in `scripts/headless/cli.mts` mirroring `case 'lsp'`: refuse an unregistered machine before anything is served, and report success when the client disconnects.
- [x] 5.5 Extend `src/cli/args.test.ts` for the new grammar.

## 6. Documentation

- [x] 6.1 A `docs/reference/` page for users: what the server offers, how a client is pointed at it, and what holding a machine means for a session. No `src/` paths and no internal symbols — it publishes to the public site.
- [x] 6.2 `docs/contributing/architecture.md`: the operation layer's row gains the third caller, and the folder table gains `src/mcp/`.
- [x] 6.3 The commands block in `CLAUDE.md`, beside the `lsp --stdio` line.
- [x] 6.4 Leave the `sidebar` in `docs/.vitepress/config.ts` untouched — adding a page does not imply an entry in it.

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npx vitest run src/ops/ src/mcp/ src/cli/ src/dialects/headless/`
- [x] 7.3 `npm run lint` and `npm run format:check`
- [x] 7.4 `npm run docs:build`
- [x] 7.5 `npx openspec validate --specs`
- [x] 7.6 Drive the built server by hand over standard input — announce a client, then ask what it offers — and confirm all thirteen operations are named.
- [x] 7.7 In one session against one process: run a program that waits at a prompt, look, act, look again, then ask for a picture. The second look showing what the action did is the assertion that the machine is held.
- [x] 7.8 Confirm the existing callers are unchanged: `./scripts/basically run` on a sample gives byte-identical output, and `src/ops/toolStability.test.ts` still passes.
- [x] 7.9 No e2e run — nothing here is visible in the browser, and this capability has no e2e folder, as `headless-cli` and `language-server` do not.
