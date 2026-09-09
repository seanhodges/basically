## 1. The shared ROM reference

- [x] 1.1 Add `src/dialects/romRef.ts`: `romTail(romUrl)` (the `<dir>/<file>` behind a `romUrl`) and `romsBaseUrl(override)`, which is the share server the build names with `roms/` under it, an override used as a whole base, or nothing where the build named no server. No node and no DOM: each surface passes its own override, and the build value is the one address both are handed.
- [x] 1.2 Replace the four hand-rolled `indexOf('roms/')` slices with `romTail`: `src/dialects/bootHarness.ts` (the fetch stub and `romPath`), `src/dialects/romLayout.test.ts`, `src/dialects/debugCapability.test.ts`. Note that the test copy adds `'roms/'.length` where the harness copies do not — keep the harness behaviour and fix the caller. (There turned out to be seven, not four: also `src/ai/machineObservability.test.ts` ×2, `src/dialects/frameRate.test.ts` and `src/emulator/romNotice.test.ts`.)
- [x] 1.3 Extend `src/dialects/romLayout.test.ts` to assert `romTail` is the one spelling, over every registered machine's `romUrl`, including the declared Acorn and Atari exceptions.

## 2. The cache

- [x] 2.1 Add `src/cli/romCache.ts` with `romCacheHome()`: `BASICALLY_HOME`, else `%LOCALAPPDATA%\basically` on win32, else `${XDG_CACHE_HOME:-~/.cache}/basically`. Images live at `<home>/roms/<tail>` so the home is a valid rom root.
- [x] 2.2 Add `cachedRomRoot()`: the home when `<home>/roms/index.json` is present and every image the manifest lists is there at the right length; `null` otherwise.
- [x] 2.3 Add the manifest type and its fetch: conditional `GET <base>index.json` sending the stored `ETag` as `If-None-Match`, behind an `AbortSignal.timeout`.
- [x] 2.4 Add image acquisition: fetch each listed image that is missing or whose `sha256` no longer matches, verify the digest with `node:crypto`, and write through a temporary name so an interrupted download leaves no partial file. (`ATTRIBUTION.md` was fetched alongside at first and is not fetched at all in the end: a publisher serving the images it was asked for need not serve the notice too, so obtaining it risked a broken link for a file the consent question can name outright.)
- [x] 2.5 Add pruning: delete every cached image the manifest no longer lists, scoped strictly to the tool's own cache directory.
- [x] 2.6 Add `refreshDue()` / `noteChecked()` over `<home>/roms-state.json` (`etag`, `version`, `checkedAt`): due after `REFRESH_INTERVAL_MS` (24 h, a named constant with the publisher's `max-age` as its reason), ~~due immediately when a registered machine's ROM tail is absent from the held manifest~~, and skipped entirely when `BASICALLY_ROM_REFRESH=off`.

  **The immediate trigger was dropped, and the spec delta amended to match.** Knowing which ROM tails the registered machines want means knowing the dialect registry, and `src/client/thinness.test.ts` forbids that in the process this runs in — the client is 44 KB rather than megabytes precisely because the registry is the host's. The trigger was built and tested before that became clear, then removed rather than shipped as a parameter with no caller. A machine added upstream now arrives at the next daily check, or at once via `basically roms fetch`; the "A machine added later" scenario and the `roms` help text both say so.
- [x] 2.7 Make every refresh failure — offline, DNS, 5xx, timeout, bad digest — leave the cache untouched and return quietly, with nothing on stdout. (Writing the tests showed this needed two things the plan did not name: a short `BACKGROUND_TIMEOUT_MS` for a check nobody asked for, distinct from the 15 s a deliberate `roms fetch` may wait; and a recorded `attemptedAt` with `RETRY_AFTER_FAILURE_MS` backoff, since retrying on the next command is a timeout on every invocation — the command being failed by the check in all but name.)
- [x] 2.8 Add `clearRomCache()`.
- [x] 2.9 Add `src/cli/romCache.test.ts`: cache home per platform and under `BASICALLY_HOME`; a digest mismatch is rejected and nothing is written; an interrupted write leaves no partial image; `cachedRomRoot()` is `null` when the set is incomplete.
- [x] 2.10 Add `src/cli/romRefresh.test.ts`: a 304 costs one request and touches nothing; a new version pulls only the changed digests; an image dropped from the manifest is deleted; an unknown machine ROM makes a check due immediately; the interval suppresses a second check; offline, a 500 and a timeout each leave the cache intact and return quietly; `BASICALLY_ROM_REFRESH=off` skips the check and a deliberate fetch ignores the interval.

## 3. Consent

- [x] 3.1 Add `src/cli/romConsent.ts` with `consentFromEnv()` accepting `BASICALLY_ROM_CONSENT` in `yes|y|1|true`, and `recordedConsent()` / `recordConsent()` over `<home>/consent.json` (`acceptedAt`, `romsVersion`, `source`).
- [x] 3.2 Add `askForConsent()` using `node:readline/promises`, guarded on `process.stdin.isTTY && process.stdout.isTTY`; a non-TTY returns false immediately without reading stdin. The prompt names what is obtained, where it is written, and the attribution notice — one address, the repository's own copy, which reads the same whether or not the user has a checkout and whether or not this build has a publisher.
- [x] 3.3 Add `src/cli/romConsent.test.ts`: every accepted spelling of the environment setting; a recorded consent is not asked again; a non-TTY returns false without touching stdin.

## 4. Wiring the cache into ROM discovery

- [x] 4.1 Add the cache as a candidate in `findRomRoot()` (`src/dialects/headless/runListing.ts`), checked before the upward walk, with a comment saying why the order is what it is. Keep it read-only — it never downloads and never prompts.
- [x] 4.2 Confirm by test that the runner, the MCP session and the CLI's `RomProbe` all see an obtained set through that one edit, and that `machines` / `info` report it without touching the network.

## 5. The `roms` command

- [x] 5.1 Add `'roms'` to `OPERATIONS` in `src/cli/args.ts` with the `status | accept | fetch | clear` subcommand grammar, and a help topic in `src/cli/usage.ts`. Update the "Every operation but `run` and `check` works with no ROM present" line with its companion sentence about where ROMs come from.
- [x] 5.2 Add `src/cli/romsReport.ts` in the column style of `src/cli/machines.ts`: the root in use and why it was chosen, the manifest version, the image count, and when it was last checked.
- [x] 5.3 Answer `roms` locally in `scripts/headless/cli.mts`, the way `help` already is — no host, no socket.
- [x] 5.4 In `cli.mts`, before dispatching `run` or `check` and **before** reading the program from stdin: when no `--rom-root` was given and neither the cache nor the installation carries the machine's images, run the consent gate and obtain them. Declining is not an error — fall through to today's behaviour.
- [x] 5.5 In the same place, when consent is recorded and the cache is the root in use, run the refresh first: at most daily, silent, timeout-bounded.
- [x] 5.6 Extend the two refusal strings in `src/ops/run.ts` and `src/ops/check.ts` to name `basically roms accept` and `BASICALLY_ROM_CONSENT`. Message text only — these files keep importing no filesystem.
- [x] 5.7 Extend `src/ops/run.test.ts` and `src/ops/check.test.ts` to pin that the refusal names both escapes.

## 5b. --rom-root reaching the ROM probe

- [x] 5b.1 Widen `RomProbe.present(dialect, romRoot?)` in `src/ops/types.ts`, and pass `input.romRoot` from `src/ops/run.ts` and `src/ops/check.ts`. A host builds its context knowing nothing about the call, so the probe answered from whatever ROMs it found on disk while the run went to `--rom-root` — `check --rom-root /nowhere` reached a verdict about a machine that had drawn its missing-image notice.
- [x] 5b.2 In `src/cli/roms.ts`, let the call's root win over the context's, and always call `configureRomRoot` — including with `null` when nothing was found. The root is a global in the boot harness and a host serves many calls, so a call that named a directory was leaving every later call reading it. Same one-line change in `runListing.ts` and `src/mcp/session.ts`; `configureRomRoot` now takes `string | null`.
- [x] 5b.3 Note in `src/mcp/context.ts` why `serverContext` names no root of its own, so it does not read as an oversight.
- [x] 5b.4 Regression tests in `src/ops/{run,check}.test.ts` built the way a host builds a context (no root of its own) plus a leak guard in `src/cli/romDiscovery.test.ts`. All three confirmed to fail without the fix.

## 6. Docs

- [x] 6.1 Add a line to `public/roms/ATTRIBUTION.md` recording that the set is also published read-only from the share API, and that the command line downloads the images from there and names this notice by its address when it asks.
- [x] 6.2 Update the ROM section of `docs/contributing/architecture.md` with the command line's new source and the client/host split that keeps network and prompting out of the host. Leave the "Four things cross the network" table to the follow-up change, which is what moves the browser's traffic.

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npx vitest run src/cli/ src/dialects/romLayout.test.ts src/dialects/debugCapability.test.ts src/ops/`
- [x] 7.3 `npm run lint`
- [x] 7.4 `npm run format:check` (or `npm run format` to auto-fix)
- [x] 7.5 `npm run docs:build` — `docs/` changes in task 6.2
- [x] 7.6 `npm test` — the ROM-reference change in task 1.2 touches `bootHarness.ts`, which the whole emulator-booting suite runs through, so this one is genuinely cross-cutting rather than scoped. Result: 53 failures in 10 files, all confirmed pre-existing by re-running those same files on a stashed tree (`src/reference/page-structure`, `docs/contributing/{glyph-sources,semigraphics-support,dialect-roadmap}`, `src/dialects/{pmd85,altair8800}/audio/cassette`, `src/dialects/altair8800/samples`, `src/dialects/hb10p/targets`, `src/build/webBoundary`, `src/components/machinePickerBoundary`). Passing count rose 10852 → 10854.

  Worth recording: the run initially failed `src/client/thinness.test.ts`, which walks the client's real module graph and refuses the dialect registry or any emulator in it. Importing `findRomRoot` from `runListing.ts` pulled `bootHarness` → `bbcMachine` → 111 emulator modules into a program that boots no machine. Fixed by lifting `findRomRoot` into its own leaf module (`src/dialects/headless/romRoot.ts`), re-exported from `runListing.ts` so existing callers are untouched. The bundle's own size barely moved (esbuild tree-shakes), which is exactly why that test walks the graph rather than measuring the file.
- [x] 7.7 No e2e run: nothing the browser executes changes in this proposal. State that explicitly rather than leaving it unexplained.
- [x] 7.8 Walk the command line by hand from a home with no cache: `roms fetch` prompts and cites the attribution; `roms status` reports version, count and last check; `BASICALLY_ROM_CONSENT=yes` skips the prompt; a piped program on a fresh home does not hang; a deleted image is refilled silently by the next run; an unreachable base still lists what is held; `roms clear` empties it. In a checkout, confirm `machines` is unchanged and nothing is fetched or asked.
