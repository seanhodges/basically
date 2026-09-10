## 1. Prerequisites

- [x] 1.1 Confirm `hold-a-machine-between-commands` is archived, so `toolchain-daemon` is a baseline capability in `openspec/specs/` and this change's delta applies to it rather than to another change's delta
- [x] 1.2 Confirm `publish-the-toolchain-to-npm` has landed, so the "a port is bound only when a view is asked for" rule is documented in the installable toolchain from its first release rather than introduced to existing installations
- [x] 1.3 Re-run `npx openspec validate watch-the-machine-from-another-app` against the updated baseline and reconcile the `toolchain-daemon` delta if its requirement text moved during archiving

## 2. The operation

- [x] 2.1 Add `ViewProjection` to `src/ops/types.ts` and an optional `view?: ViewProjection` member on `OpContext`, following how `painting` and `roms` are already injected — the operations layer must remain free of node builtins
- [x] 2.2 Declare the `view` operation in `src/ops/view.ts` with `needs: 'session'`, an outcome carrying the address, and `describe`/`failed` renderers; a caller holding no machine gets the existing `WITHOUT_A_MACHINE` answer from `src/server/ops.ts`
- [x] 2.3 Refuse a view of a machine whose display cannot be pictured, saying so, rather than returning an address that shows nothing
- [x] 2.4 Return the existing view when one is already open for that session, rather than opening a second
- [x] 2.5 Register the operation in `src/ops/registry.ts`, appending rather than reordering — the order is load-bearing for the assistant's prompt-cache prefix
- [x] 2.6 Add the assistant exemption to `src/ops/parity.ts` with a reason particular to that caller: the assistant runs in the browser, where the machine is already on screen and there is no host to project from
- [x] 2.7 Colocated `src/ops/view.test.ts` covering the outcome shape, the no-machine answer, the unpicturable-machine refusal, and asking twice
- [x] 2.8 `npx vitest run src/ops/` — `parity.test.ts` accepts the exemption and forces the operation onto the MCP surface; `toolStability.test.ts` still passes

## 3. Frames, without disturbing the machine or its measurements

- [x] 3.1 Add a frame tap over `RunObserver.frame?(machine)` that samples every _N_ th frame, reusing the existing paint-and-encode path rather than a second one
- [x] 3.2 Coalesce samples: drop a sample whose predecessor is still encoding, so a viewer is shown the machine's present rather than an accumulating backlog
- [x] 3.3 Accumulate the tap's cost and exclude it from the run's reported time, following the `renderMs` pattern already inside the loop in `src/dialects/headless/runListing.ts` — the observer fires inside the window that becomes `timings.runMs`, so an unaccounted tap would silently inflate every watched run
- [x] 3.4 Do the same in the second runner, `src/mcp/session.ts`, which holds the machine and has its own copy of the loop
- [x] 3.5 **The measurement crosscheck**: a test that runs and measures the same program with a view attached and without, asserting every machine-time measurement (`profile`, `time`, `variables`) is identical and that the reported run time does not grow for having been watched. This is the guarantee most at risk in the change
- [x] 3.6 Test that a machine being viewed advances no frames while no request is made of it

## 4. The projection

- [x] 4.1 Add `src/server/view/` with a listener over `node:http` bound to the loopback interface on an ephemeral port, started only when a view is asked for — no dependency is added
- [x] 4.2 Generate an unguessable per-view address, never reused once a view has ended; test that a retired address admits nobody
- [x] 4.3 Serve frames as Server-Sent Events, plus a state signal distinguishing an idle machine from one a request is working on, and from no machine at all
- [x] 4.4 Check the `Host` header and reject a mismatch (a page anywhere can aim a request at a loopback address); send no cross-origin headers; suppress the referrer so framing a view does not leak its address
- [x] 4.5 Hang the view off the caller's `HostSession` in `src/server/sessions.ts` — a viewer gets no session, no machine and no operation dispatch, so "one caller's machine is not another's" needs no weakening
- [x] 4.6 Carry sampled frames across the worker boundary in `src/server/machineWorker.ts`, as already-encoded bytes
- [x] 4.7 Follow the session, not the machine: a caller that runs a second program sees its view show the new machine; a caller that releases its machine sees the view report that none is up, with the address still valid
- [x] 4.8 End the view when the caller gives it up, disconnects, disappears, or the host stops, and stop listening — a host nobody has asked a view from binds nothing
- [x] 4.9 Confirm a view does not hold the host open against `src/server/lifetime.ts`'s idle release, which counts connections rather than sessions
- [x] 4.10 Colocated tests for the listener, admission, `Host` rejection, lifetime, and "nothing is bound until asked"

## 5. The page

- [x] 5.1 Write the served page as a standalone hand-written HTML/JS source file — no React, nothing from the IDE — that consumes the event stream, paints the frames, and renders the idle / working / no-machine states
- [x] 5.2 Inline it at build time via the existing `raw-imports` plugin in `scripts/headless/build.mjs`, so nothing is resolved at runtime
- [x] 5.3 Make the page render sensibly in a frame it does not control the size of, since an embedding application chooses that

## 6. The command line

- [x] 6.1 Add `view` to the operation grammar in `src/cli/args.ts` and its help text in `src/cli/usage.ts`
- [x] 6.2 Render the outcome client-side — print the address — alongside the other operations that act on a held machine
- [x] 6.3 Confirm `src/client/thinness.test.ts` still passes: the client gains no emulator, no server module and no meaningful module count
- [x] 6.4 Confirm `src/build/webBoundary.test.ts` still passes: the website reaches nothing under `src/server/`

## 7. Documentation

- [x] 7.1 Update `docs/contributing/architecture.md` §"The toolchain outside the browser" — the host gains a projection beside the three conversations; add the row and amend the diagram only if the mechanism cannot be said in a sentence
- [x] 7.2 Add a user-facing reference page telling an embedding application how to obtain a view and put it in a frame, stating plainly that possession of the address is the only thing protecting it, that it is reachable from that computer only, and that a viewer cannot act on the machine
- [x] 7.3 Do not touch the docs sidebar in `docs/.vitepress/config.ts` without asking

## 8. Quality gates

- [x] 8.1 `npm run typecheck`
- [x] 8.2 `npx vitest run src/ops/ src/server/ src/mcp/ src/client/ src/dialects/headless/ src/build/` — the suites this change reaches
- [x] 8.3 `npm run lint`
- [x] 8.4 `npm run format:check` (or `npm run format`)
- [x] 8.5 `npm run docs:build`
- [x] 8.6 `npx openspec validate watch-the-machine-from-another-app`
- [x] 8.7 No e2e run: this change touches no browser surface, and `src/e2eCapabilityLayout.test.ts` is one-way — a capability whose coverage is unit-level needs no `e2e/` folder. Should any browser-visible behaviour be added during implementation, add `e2e/display-view/` and run `npm run e2e:chromium -- e2e/display-view`
- [x] 8.8 End to end by hand: `basically run prog.bas -m zx81 --hold`, then `basically view`, open the printed address in a browser, then `basically drive 'PRESS A'` and confirm the view follows
