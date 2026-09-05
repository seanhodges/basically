## 1. The wire and the host's own pieces

- [x] 1.1 Add `src/server/address.ts`: the host's address from the user and the
      toolchain's build version, branching to a Unix domain socket path on
      macOS/Linux and a named pipe on Windows. Colocated tests for each branch,
      for two versions never colliding, and for the address being derivable
      without touching the filesystem.
- [x] 1.2 Add `src/server/protocol.ts`: the handshake and the operations
      conversation as types plus the `Content-Length` framing over a duplex
      stream. Colocated tests for framing round trips, split and coalesced
      chunks, and an oversized frame being refused rather than buffered.
- [x] 1.3 Add `src/server/ops.ts`: one call named by operation with its input,
      validated on arrival with the existing `schemaProblem()` and dispatched
      through `findOperation()`, answered with the outcome or with the error
      class the caller needs to choose an exit code. Colocated tests for an
      unknown operation, an input that does not fit its schema, and an outcome
      surviving a JSON round trip.

## 2. Machines held in a worker

- [x] 2.1 Add `src/server/machineWorker.ts`: a worker thread that owns one
      machine-holding session over the existing `createServerMachine()` and
      `serverContext()`, started only when a machine is first wanted and let go
      with its session. Colocated tests that the stand-ins are installed inside
      the worker and not in the host, and that two workers hold two machines
      without either seeing the other's.
- [x] 2.2 Add `src/server/sessions.ts`: the sessions a host holds, each with at
      most one machine, released on disconnect and on a caller that disappears.
      Colocated tests for release, for a dropped connection releasing, and for a
      request needing a machine when none is held being answered with how to
      start one.

## 3. Listening, routing and lifetime

- [x] 3.1 Add `src/server/listener.ts`: `net.createServer()` on the resolved
      address, the handshake per connection, refusal naming what is served when a
      caller asks for a conversation this host was not started for, and routing a
      connection to the operations, editor or agent handler. Colocated tests for
      each route and for the refusal.
- [x] 3.2 Route the editor's and the agent's conversations by handing the
      connection's socket to the existing shims as their streams
      (`createConnection(input, output)` and `StdioServerTransport(in, out)`).
      `src/lsp/` and `src/mcp/` must not change; a test asserts a socket-served
      client is offered the same tool definitions as a stdio-served one.
- [x] 3.3 Add `src/server/lifetime.ts`: idle-exit when no caller is connected and
      nothing has been asked for a while, explicit shutdown, and releasing every
      held machine on the way out. Colocated tests that a connected caller
      prevents idle-exit and that shutdown releases machines.
- [x] 3.4 Add `scripts/headless/server.mts`: the host's process shell — which
      conversations to serve (any, or all by default), `--stdio` for one caller
      over the process's own streams, and the host's own log going nowhere near a
      caller's channel.

## 4. The client

- [x] 4.1 Add `src/client/connect.ts`: resolve the address, connect, and on
      failure locate a server beside the client then on `PATH`, start it
      detached, and retry with bounded backoff. Recognise and clear the remains
      of a stopped host; treat a lost bind race as "connect to the winner".
      Colocated tests for the race, the stale address, and a host that can be
      neither reached nor started being reported as its own failure.
- [x] 4.2 Add `src/client/call.ts`: the framed client, a bounded timeout per
      call, and the mapping from an answer or an error class to the exit code the
      command line already uses. Colocated tests for each of the three outcomes
      and for the timeout.
- [x] 4.3 Rewrite `scripts/headless/cli.mts` as the client shim: parse with the
      existing `parseArgs`, read the program and expectations, resolve any ROM
      root to an absolute path, call, render with the existing `src/cli/`
      renderers, write `-o` and `--screenshot` from the outcome's base64, and set
      the exit code. Keep the in-process path as the fallback when no host can be
      started.
- [x] 4.4 Add `scripts/basically-server` and `scripts/basically-server.cmd`,
      mirroring the existing pair and sharing the stale-bundle rebuild; extend
      `scripts/headless/build.mjs` to build the second entry point.

## 5. The operations that act on a held machine

- [x] 5.1 Change the command line's declared route for `drive`, `look`,
      `screenshot`, `profile`, `time` and `variables` from an option to an
      operation of its own, keeping the `run` options as the one-shot spelling;
      do the same for `expect` against `check`. Update `src/ops/types.ts`'s
      `CliRoute` documentation, which currently justifies option-routing by the
      command line holding no machine between runs.
- [x] 5.2 Extend `src/cli/args.ts` and `src/cli/usage.ts` with the new
      operations, with the option asking a run to leave its machine up, and with
      `server start` / `server stop` / `server status`. Extend `args.test.ts`
      accordingly.
- [x] 5.3 Confirm `src/ops/parity.ts` gains no `Caller` and no exemption, and
      that `src/ops/parity.test.ts` passes with the new routes — it fails in both
      directions, so this is the check that the change is not half-made.

## 6. End to end

- [x] 6.1 An end-to-end test starting a host on a temporary address, running
      `machines`, `lint` and `build` through the client, and asserting the output
      is byte-identical to the in-process path's.
- [x] 6.2 An end-to-end test of a machine held between commands: run leaving the
      machine up, then press, then look, then release — across separate client
      invocations against one host — asserting the screen is the one the keypress
      left and that a read costs no frames.
- [x] 6.3 An end-to-end test that `--stdio` still serves one editor and one agent
      exactly as today, and that `basically lsp --stdio` and `basically mcp
      --stdio` remain valid spellings.

## 7. Documentation

- [x] 7.1 Update `docs/contributing/architecture.md` §"The toolchain outside the
      browser": the host and client in the layout table, the two mermaid diagrams
      (keep them `flowchart TB` and under ~1100px intrinsic width), the parity
      paragraph now that the command line holds a machine, and a note that the
      stand-ins being process-global is why a machine lives in a worker.
- [x] 7.2 Update `docs/reference/mcp-server.md` and
      `docs/guide/language-server.md` with the shared host as a way to be served,
      keeping the existing stdio instructions as the default. No `src/…`,
      `CLAUDE.md` or `.claude/` references on these published pages.
- [x] 7.3 Do not touch the sidebar in `docs/.vitepress/config.ts`.

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npx vitest run src/server/ src/client/ src/ops/ src/cli/ src/mcp/ src/lsp/`
- [x] 8.3 `npm test` — this change reaches the shared operation layer and every
      caller derived from it, which is the cross-cutting case where the full
      suite is the right gate rather than a targeted run.
- [x] 8.4 `npm run lint`
- [x] 8.5 `npm run format:check` (or `npm run format`)
- [x] 8.6 `npm run docs:build` — required because `docs/` changes in task group 7.
- [x] 8.7 No e2e run is required: nothing in this change is visible in the
      browser. Confirm by checking that no file under `src/app/`,
      `src/components/`, `src/editor/` or `src/player/` was modified; if any was,
      run `npm run e2e:chromium -- e2e/<capability>` for each affected capability
      and leave this task unchecked with a note if it fails.
