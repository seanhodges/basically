## 1. Settle the unknown first

- [ ] 1.1 Spike type declarations: a library-only tsconfig with
      `emitDeclarationOnly` over a stub facade re-exporting `Dialect`,
      `MachineEmulator`, `Operation` and `OpContext`. Record whether it emits
      cleanly; declaration emit rejects an exported type naming one it cannot
      reach, which a build that only checks types never notices
- [ ] 1.2 If it does not hold, choose a declaration bundler, check its licence
      against GPL-3.0-or-later and note it in the design's open questions before
      any other task depends on the answer

## 2. Move the three modules that are named after the wrong thing

- [ ] 2.1 Move `src/cli/roms.ts` (`cliContext`, `locateRoms`) to
      `src/lib/context.ts`; it fills a context from a real filesystem and belongs
      to neither the argument parser nor the agent server
- [ ] 2.2 Move `src/mcp/session.ts` (`createServerMachine`, `ServerMachine`) and
      `src/mcp/context.ts` (`serverContext`) into the library core — they are what
      `src/server/machineWorker.ts` uses to hold a machine between commands, and
      nothing in them speaks the Model Context Protocol
- [ ] 2.3 Update the importers (`src/server/machineWorker.ts`, `src/mcp/tools.ts`,
      `scripts/headless/cli.mts`) and move the colocated tests with their subjects
- [ ] 2.4 Confirm no sideways import is left: nothing under `src/mcp/` imports
      `src/cli/`, and `src/server/` imports no server-shaped folder for its own
      held machine

## 3. The facade

- [ ] 3.1 Write `src/lib/index.ts` exporting the four groups the design names:
      machines and language; the operation registry with a dispatcher and
      `createOpContext({ romRoot })`; running, one-shot and held; serving an editor
      or an agent over supplied streams
- [ ] 3.2 `createOpContext` takes `romRoot` and does not fall back to
      `findRomRoot()`. The upward walk stays in the command line, where a person
      typed a command in a directory
- [ ] 3.3 Keep the two servers behind a dynamic `import()`, so an embedder that
      never serves never loads either protocol library
- [ ] 3.4 Export no module under `src/cli/`, `src/client/`, or
      `src/server/{address,environment,protocol,listener}`

## 4. Move the two servers out of the command-line package

- [ ] 4.1 Move `scripts/headless/lsp.mts` → `src/lsp/serve.ts` and
      `scripts/headless/mcp.mts` → `src/mcp/serve.ts`; `scripts/headless/` is the
      command-line package's directory and neither belongs to it any more
- [ ] 4.2 Move `src/server/servedOverStreams.test.ts` with them. It stops being a
      check on a detail and becomes the only proof either server works
- [ ] 4.3 Remove the `lsp` and `mcp` operations from `src/cli/args.ts`
      (`parseServer` and their `*Args` types) and their entries and help blocks
      from `src/cli/usage.ts`
- [ ] 4.4 Remove the two spawn paths from `scripts/headless/cli.mts`, and the
      `--lsp`/`--mcp` flags and their dynamic imports from
      `scripts/headless/server.mts`
- [ ] 4.5 Collapse `Conversation` in `src/server/protocol.ts` to `'ops'` and
      simplify `src/server/listener.ts` accordingly; update
      `src/server/{protocol,listener}.test.ts`
- [ ] 4.6 Delete `src/server/stdioCompatibility.test.ts`, which spawns the built
      bundles for three commands that no longer exist
- [ ] 4.7 Update `src/cli/args.test.ts` and any usage snapshot for the two removed
      operations

## 5. The second build and package

- [ ] 5.1 Add `scripts/lib/build.mjs`: one esbuild pass over `src/lib/index.ts`
      into its own `outdir`, sharing the `?raw` plugin, the `import.meta.env`
      define and the banner with `scripts/headless/build.mjs`; `minify: false`,
      `keepNames: true`, its own `buildId.txt`
- [ ] 5.2 Factor the shared esbuild options rather than copying them, so a change
      to the define or the banner cannot reach one build and not the other
- [ ] 5.3 Emit type declarations by whichever route task 1 settled on
- [ ] 5.4 Add `scripts/lib/package.json`: `@ba.sical.ly/lib`, `type: module`,
      `engines.node >= 22`, `files: ["dist","LICENSE","README.md"]`,
      `prepack: node build.mjs`, `dependencies: { jsbeeb }` pinned to the root's,
      `exports`/`types` pointing at the bundle and its declarations, no `bin`
- [ ] 5.5 Add `scripts/lib/README.md` and `scripts/lib/LICENSE`; the licence file
      is promised by `files` and the package is GPL-3.0-or-later
- [ ] 5.6 Confirm the command line's own `buildId.txt` is unchanged in scope — it
      hashes its own directory, and the library's bundle is not in it

## 6. Tests that hold the boundaries

- [ ] 6.1 Add `src/lib/surface.test.ts`, read over the real dependency graph in
      the manner of `src/client/thinness.test.ts` so a failure names the import:
      the library reaches nothing under `src/cli/`, `src/client/`,
      `src/server/{address,environment,protocol,listener}`, `src/components/` or
      `src/app/store`, and none of the browser-only packages that test lists
- [ ] 6.2 In the same file, pin the facade's exported names, so widening the
      surface is an edit rather than a side effect
- [ ] 6.3 Strengthen `src/client/thinness.test.ts`: the "carries neither protocol
      library" check moves from the client alone to all three command-line entry
      points. This is the executable form of section 4
- [ ] 6.4 Add `'lib'` to `Caller` in `src/ops/parity.ts` with no exemption, and
      have `parity.test.ts` answer reachability from the facade's own re-exported
      registry and dispatcher rather than from a constant, so a filter would fail
      it. Check that `'mcp'` still carries no exemption
- [ ] 6.5 Add `src/lib/` to the folders `src/build/webBoundary.test.ts` forbids
      `main.tsx` from reaching
- [ ] 6.6 Extend `src/client/packaging.test.ts` (or add a sibling for the library
      manifest): the same pinned `jsbeeb`, the `files` list, the `prepack`, and
      that the two published packages carry equal versions
- [ ] 6.7 Add a test that the library's bundle carries no share-server address —
      the `define` supplies one for the website's build and a library has no use
      for it

## 7. Release

- [ ] 7.1 Extend `.github/workflows/release-cli.mjs` to gate on both build ids:
      if either differs from what is published, raise the version once and publish
      both at it
- [ ] 7.2 Publish the library first, the command line second, the tag last, so the
      packument the gate reads being present implies both are
- [ ] 7.3 Count the next version from the highest published across both packuments,
      not the command line's alone
- [ ] 7.4 Treat a publish refused because that exact version already exists carrying
      that exact build id as success, so a retry after a partial publish completes
      rather than wedging
- [ ] 7.5 Extend `.github/workflows/release-cli.test.ts` for the three cases above:
      one package published and not the other, a retry after a partial publish, and
      a push where neither build id moved
- [ ] 7.6 Do not rename or split the workflow file — the registry matches its
      filename as part of deciding whether to trust it. Add the reason as a comment
      if one is not already there
- [ ] 7.7 Note in the workflow that the first release after this raises the minor,
      pushed as a `cli-v…` tag, because two operations were removed

## 8. Documentation

- [ ] 8.1 Delete `docs/guide/language-server.md` and `docs/reference/mcp-server.md`
- [ ] 8.2 Remove their inbound links from `docs/guide/installing.md`, and rewrite
      its opening sentence, which names serving an editor or an agent as something
      the toolchain does from the command line
- [ ] 8.3 Neither page has a sidebar entry in `docs/.vitepress/config.ts`; leave
      that file untouched
- [ ] 8.4 Add a page on embedding the library: what it offers, how ROMs are named,
      and — plainly — that it is GPL-3.0-or-later and cannot be otherwise, because
      jsbeeb is bundled. A package offered for embedding invites a licence
      violation unless the page says what embedding it obliges
- [ ] 8.5 Update `docs/contributing/architecture.md`: the two packages and how they
      agree, the host row, the claim that `basically lsp` and `basically mcp` hand
      the host their streams, and the two sections describing those commands. Rows
      and tables, not new prose
- [ ] 8.6 Update the command list in `CLAUDE.md`, which still names
      `./scripts/basically lsp --stdio` and `./scripts/basically mcp --stdio`
- [ ] 8.7 Ask whether the embedding page joins the docs sidebar, together with the
      same question still open on the installation page; leave
      `docs/.vitepress/config.ts` untouched unless the answer is yes

## 9. Gates

- [ ] 9.1 `npm run typecheck`
- [ ] 9.2 `npx vitest run src/lib/ src/ops/ src/client/ src/server/ src/cli/ src/lsp/ src/mcp/ src/build/ src/dialects/`
      — the moves in section 2 and the parity caller in 6.4 reach further than one
      folder, so run the full `npm test` if anything outside these imports a moved
      module
- [ ] 9.3 `npm run lint` and `npm run format:check`
- [ ] 9.4 `npm run docs:build` — two pages are deleted, so this is what catches a
      link left pointing at one
- [ ] 9.5 `npm pack` both packages into a scratch directory and install them there:
      prove an embedder can import the facade and boot a machine with no checkout,
      and that `basically --help` no longer offers `lsp` or `mcp`
- [ ] 9.6 No e2e run: nothing here is app-visible — the browser IDE reaches neither
      the command line, the host, the launchers nor either server. If any task above
      turns out to touch the app, run that capability's folder with
      `npm run e2e:chromium -- e2e/<capability>` and leave this unchecked until it
      passes
