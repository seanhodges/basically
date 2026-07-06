# Standalone Player — Multi-Stage Implementation Plan

## Status

| Stage                                      | State                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1 — Routing foundation & shell split       | ✅ Implemented (this branch)                                                                    |
| 2 — Share API client module                | ✅ Implemented (this branch)                                                                    |
| 3 — Standalone player UI + auto-start      | ✅ Implemented (this branch)                                                                    |
| 4 — AWS backend (CDK)                      | ✅ Implemented ([basically-share-server](https://github.com/seanhodges/basically-share-server)) |
| 5 — IDE "Share link" flow                  | ✅ Implemented (this branch)                                                                    |
| 6 — Open-in-IDE handover                   | ✅ Implemented (this branch)                                                                    |
| 7 — Hosting, PWA hardening, full test pass | ⬜ Not started                                                                                  |

Update this table as stages land.

## Context

Basically began as a single-view SPA: `src/main.tsx` rendered `<App/>`, which always shows the full IDE — no router, no URL handling, and no backend of any kind. The goal is a **standalone player** - a cut-down, fully responsive UI (emulator screen + virtual keyboard + virtual gamepad, no editor/docs/menus) opened by short URLs like `/run/abc123`, where the path verb picks the machine and the six-character share ID resolves, via an API → AWS Lambda → DynamoDB, to a shared BASIC program that loads and auto-runs. A round green Play button restarts the program; an "See the Code" button hands the program over to the main UI. Since nothing today can _create_ share IDs, the plan also covers the write path (a "Share link" action in the IDE) and the AWS infrastructure.

**Decisions baked in:**

1. **Unique verb per dialect** - the path deterministically dictates the emulator.
2. **Full-stack scope** - infra-as-code, read+write API, and an IDE Share flow to mint links.
3. **Hosting is GitHub Pages** (`.github/workflows/deploy.yml` builds app + docs into one Pages artifact; the site is served at the domain root). GitHub Pages has no rewrite support, so cold deep links use the **`404.html` fallback**: copy `dist/index.html` → `dist/404.html` at build time — Pages serves the root `404.html` for any unknown path, the SPA boots and parses the pathname. The service worker's navigateFallback covers the installed-PWA case. The API is necessarily cross-origin (no same-origin proxy on Pages), so prod uses CORS + a build-time `VITE_SHARE_API_URL`.
4. **See the Code** - opens the main UI with the program pre-loaded and the right dialect selected, via `/?open=<id>` re-fetch (refresh-safe, shareable, no sessionStorage handoff fragility).

## Verb table (route → dialect)

One verb per registered dialect. Every verb is a real keyword in that dialect's BASIC (no invented suffixes), chosen to evoke loading/running code; where the iconic command collides across machines, the dialect gets another authentic keyword from its own vocabulary:

| Path         | Dialect       | Authentic keyword                                  |
| ------------ | ------------- | -------------------------------------------------- |
| `/load/:id`  | zx81          | `LOAD` - the iconic ZX81 tape command              |
| `/goto/:id`  | zx80          | `GO TO` - ZX80 4K BASIC keyword                    |
| `/gosub/:id` | zxspectrum    | `GO SUB` - Spectrum BASIC keyword                  |
| `/play/:id`  | zxspectrum128 | `PLAY` - 128K-exclusive keyword (apt for a player) |
| `/chain/:id` | bbcmicro      | `CHAIN ""` - BBC BASIC load-and-run                |
| `/old/:id`   | bbcmaster     | `OLD` - BBC BASIC "recover the program"            |
| `/run/:id`   | commodore64   | `RUN` (after `LOAD`)                               |
| `/link/:id`  | atom          | `LINK` - Atom BASIC "execute machine code"         |
| `/cload/:id` | trs80         | `CLOAD` - Level II BASIC tape load                 |

Exact assignments are easy to swap in `SHARE_VERBS` (`src/player/routes.ts`); a unit test asserts a bijection between this table and `src/dialects/registry.ts`, so a future dialect can't ship without a verb.

## Headline design choices

- **No router library.** One `location.pathname` parse in `src/main.tsx` before React renders, backed by a route table in `src/player/routes.ts`. Two `React.lazy` shells (`App` = IDE, `PlayerApp` = player) so the player never loads CodeMirror or the AI SDKs.
- **`vite.config.ts` `base: './'` → `'/'`.** With the relative base, a document at `/run/abc123` resolves `import.meta.env.BASE_URL + 'roms/...'` to `/run/roms/...` (404). Absolute base fixes every ROM-URL site at once (`EmulatorPane.tsx` fetchRom, `src/emulator/bbc/bbcMachine.ts`, `src/emulator/c64/c64Machine.ts`, atom machine). Hand-written relative hrefs in `index.html` and `public/manifest.webmanifest` (`start_url`, `scope`, icons) go absolute too — Vite rewrites bundled asset tags but not those.
- **Reuse the existing Zustand store, not a second one** - `EmulatorPane`, `VirtualKeyboard`, and `GameController` are already store-driven and Workspace-independent. New `playerBoot` action deliberately bypasses `setDialect` (confirm-dialog path, `store.ts:491`) and `replaceDocument` (mobile side effect at `store.ts:554`: flips `mobileTab` to `'editor'` and bumps `stopRequest`).
- **Auto-start with audio-unlock pill.** Browsers block AudioContext without a gesture, so the program runs immediately (video is fine), and a "tap for sound" pill + a one-time root `pointerdown` calls a new `resumeAudio()`. Users tap the virtual keyboard anyway. Fallback if iOS misbehaves: tap-to-play overlay, identical plumbing.
- **The DynamoDB record stores the authoring `dialectId` plus a `compatibleDialects` list.** The verb deterministically picks the machine; the record's compatibility list is used for program–machine incompatibility checking. At share time the IDE computes `compatibleDialects` by running every registered dialect's `tokenize(source)` and keeping the ids with zero errors — cheap, client-side, reuses the existing tokenizers. On open, if the verb's dialect isn't in `compatibleDialects`, the player shows an incompatibility notice with a one-tap link to the program's canonical URL (`playerPathFor(record.dialectId, id)`) instead of booting a machine that can't run it.
- **IaC: AWS CDK (TypeScript)** in the separate [basically-share-server](https://github.com/seanhodges/basically-share-server) repo — same language/toolchain as this repo; its `NodejsFunction` (esbuild) bundles the verb/dialect table straight from this repo's `src/player/routes.ts` (that repo requires a `../basically` sibling checkout), one source of truth for valid dialect IDs. **The dependency is strictly one-way**: this repo never reads code, tests, or config from basically-share-server. The only thing that crosses back is a _value_ — the deployed API URL — duplicated by hand into this repo's `.env.local` (dev) and the `SHARE_API_URL` repository variable (prod).
- **Share IDs**: 6 chars from the unambiguous lowercase alphabet `23456789abcdefghjkmnpqrstuvwxyz` (~887M IDs; no 0/O/1/l/i), server-generated with `crypto.randomInt`, `ConditionExpression: attribute_not_exists(id)`, retry ×5.

## API contract (frozen in Stage 2, implemented in Stage 4)

- `GET {API}/share/{id}` → `200 { id, dialectId, compatibleDialects, name, source, createdAt }` | `404 { error: 'not_found' }` | `410 { error: 'expired' }`
- `POST {API}/share` body `{ dialectId, compatibleDialects, name, source }` → `201 { id }` | `400 { error: 'invalid_dialect' | 'too_large' | 'bad_request' }` | `429`
- `compatibleDialects: string[]` - dialect ids the program tokenizes cleanly on, computed client-side at share time (see Stage 5); the server validates it is a non-empty subset of known dialect ids and contains `dialectId`.
- Limits: `source` ≤ 64 KiB, `name` ≤ 128 chars (client pre-checks, server enforces).
- The API lives on its own origin (API Gateway URL, optionally a custom `api.` subdomain later). CORS `allowOrigins`: the production Pages origin + `http://localhost:5173`. The client reads `VITE_SHARE_API_URL` (required — no same-origin default is possible on GitHub Pages); the deploy workflow injects it as a repo variable at build time.

---

## Stage 1 — Routing foundation & shell split ✅

Shippable alone: IDE unchanged at `/`; `/run/xxxxxx` renders a player placeholder. No backend needed.

**New files**

- `src/player/routes.ts` - dependency-free (no registry import, so the Lambda can bundle it): `SHARE_VERBS`, `SHARE_ID_RE`, `parsePlayerPath(pathname)`, `playerPathFor(dialectId, id)`.
- `src/player/routes.test.ts` - parse/reject cases + registry-bijection test.
- `src/player/PlayerApp.tsx` - Stage-1 placeholder, props `{ dialectId, shareId }`.

**Modified**

- `src/main.tsx` - `./storage/safeStorage` import kept first; `parsePlayerPath(location.pathname)`; lazy-load `App` or `PlayerApp` inside `<Suspense>`; StrictMode retained.
- `vite.config.ts` - `base: '/'` (site is served at the domain root; a `<user>.github.io/<repo>/` sub-path deployment would need the repo name in `base` instead). `navigateFallbackDenylist` keeps `/docs`; the API is a different origin so no `/api` entry is needed.
- `index.html`, `public/manifest.webmanifest` - absolute hrefs, `start_url: "/"`, `scope: "/"`.
- `.github/workflows/deploy.yml` - build step after `npm run docs:build`: `cp dist/index.html dist/404.html` (caveats: deep links carry a 404 status — functionally fine for an SPA; link unfurlers see a 404; missing `/docs/*` pages land on the app shell too, since Pages only honours the root 404.html).

**Verify:** `npm run typecheck && npm test && npm run lint && npm run format:check`; dev server: `/` = IDE, `/run/abc234` = placeholder, `/run/bad!` = IDE; `npm run build && vite preview` - spot-check ROM requests hit `/roms/...`.

## Stage 2 — Share API client module ✅

Shippable alone: pure client code with tests; Stages 3 and 4 build against it in parallel.

**New files**

- `src/share/shareClient.ts` - `SharedProgram` / `CreateShareRequest` types (incl. `compatibleDialects: string[]`), `ShareApiError` with `kind: 'unconfigured' | 'invalid-id' | 'not-found' | 'expired' | 'too-large' | 'rate-limited' | 'network' | 'server'`, `fetchSharedProgram(id)`, `createShare(req)`, and the `SOURCE_LIMIT_BYTES` / `NAME_LIMIT_CHARS` constants. The base URL is read from `import.meta.env.VITE_SHARE_API_URL` at call time — required (no same-origin fallback exists on GitHub Pages); when unset, both functions reject with `'unconfigured'` so dev without a deployed backend degrades gracefully. Env typing lives in `src/vite-env.d.ts`.
- `src/share/shareClient.test.ts` - mocked `fetch`: happy paths, 404/410/429/400 mapping, invalid ID and unconfigured API short-circuit without a network call, size/name caps, malformed-response rejection.

## Stage 3 — Standalone player UI + auto-start flow

Shippable end-to-end in dev/e2e with a stubbed API (Playwright `page.route`); against prod once Stage 4 deploys.

**Store changes (`src/app/store.ts`)**

- `playerBoot({ dialectId, source, fileName })` - `getDialect(id)` directly, **without** `persistDialectId` (the player must not overwrite the IDE's remembered machine — note `applyDialectSwitch` at `store.ts:384` persists at line 389, so don't reuse it here); sets `source` + `docOverride` bump + `fileName`, `dirty: false`, `controllerBindings` for the dialect, breakpoints cleared, `emulatorStatus: 'stopped'`, and **`mobileTab: 'preview'`** (critical: `useInputOverlays` and EmulatorPane's landscape ⌨ toggle key off it).
- Ephemeral (non-persisting) variants of the ⌨/🎮 toggles — the existing `setKeyboardEnabled`/`setControllerEnabled` (`store.ts:589–596`) persist to localStorage shared with the IDE; playing a game must not rewire IDE settings.

**EmulatorPane decoupling (minimal, additive)** - `src/components/EmulatorPane.tsx`

- Extend `MachineApi` with `resumeAudio(): Promise<boolean>`, implemented from the existing `audioRef` (create-if-enabled + resume), assigned alongside `getMachine`/`registerFrameHook` (~line 585). Workspace ignores it. No other changes needed.

**New files**

- `src/player/PlayerApp.tsx` (replaces the Stage-1 placeholder) — boot effect: `fetchSharedProgram(shareId)` → **compatibility check**: if the verb's dialect ∉ `record.compatibleDialects`, phase `'incompatible'` - a notice naming both machines with a one-tap link to `playerPathFor(record.dialectId, shareId)`; otherwise `playerBoot({ dialectId: verbDialectId, ... })` → `requestRun()` (auto-start). Local phase `'loading' | 'running' | 'incompatible' | 'error'` with per-error messages + retry. Renders:
  - `<EmulatorPane apiRef={machineApiRef}/>` full-bleed; keyboard/controller machine targets built exactly like `Workspace.tsx:85–101`.
  - `VirtualKeyboard` (machine target) and `GameController` (`effectiveGamepadMode(dialect, gamepadMode)`; no `onStartRemap` - remap dropped), visibility from `useInputOverlays()`.
  - Controls rail: round green Play FAB (clone of `.fabRun`, `Workspace.module.css:~205`, `onClick={requestRun}` - Run _is_ restart in this app), "See the Code" button (`location.assign('/?open=' + shareId)`), ⌨/🎮 toggles (key-mapped fallback keeps 🎮 useful for dialects without joystick modes), "tap for sound" pill until `resumeAudio()` confirms.
- `src/player/PlayerApp.module.css` - responsive: portrait = screen top / overlay bottom band; landscape ≈ existing phone-landscape layout (copy the relevant `.workspaceVkOverlay`/`.workspaceGcOverlay` rules; keep the flanking-gamepad geometry so `landscapeSideGutter()` in EmulatorPane stays valid); desktop = centered screen + docked keyboard. Theme comes free from `src/styles.css`.

**Verify:** dev server with `page.route`-style stub or a local mock; physical keyboard reaches the machine via the focused canvas (already built into EmulatorPane); all four gates.

## Stage 4 — AWS backend (CDK: DynamoDB + Lambda + HTTP API) ✅

Implemented in the separate **[basically-share-server](https://github.com/seanhodges/basically-share-server)** repo. That repo needs this one as a sibling checkout (`../basically`) to bundle `src/player/routes.ts`; this repo has **no dependency in the other direction** - it consumes only the deployed API URL, copied by hand from the stack's `ShareApiUrl` output into `.env.local` (dev) and the `SHARE_API_URL` repository variable (prod). Shippable alone: `cdk deploy` over there, then set `VITE_SHARE_API_URL=<ShareApiUrl output>` in this repo's `.env.local`.

Standalone repo (own package.json: `aws-cdk-lib`, `constructs`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`; dev: `aws-cdk`, `tsx`, `esbuild`, `vitest`, `aws-sdk-client-mock`):

- `bin/app.ts` - CDK app.
- `lib/shareApiStack.ts` - DynamoDB table `basically-shares` (PK `id`, on-demand, `timeToLiveAttribute: 'expiresAt'` - enabled but unset by default: links are permanent, TTL is an ops lever); one `NodejsFunction` (Node 22, ARM); API Gateway **HTTP API** with `GET /share/{id}` (throttle ~20 rps) and `POST /share` (~2 rps, burst 5); CORS for prod origin + localhost:5173. (HTTP API over a Function URL: two routes, built-in CORS, per-route throttling.)
- `lambda/shareHandler.ts` - imports `SHARE_VERBS`/`SHARE_ID_RE` from `../../basically/src/player/routes` (this repo, via the sibling checkout — dependency-free by design; esbuild bundles it; its CI checks out both repos side by side). GET: validate → GetItem → 200/404/410 (410 for expired-not-yet-reaped items). POST: validate dialect/name/size + `compatibleDialects` (non-empty subset of `SHARE_VERBS` dialect ids, must contain `dialectId`) → generate ID → conditional put ×5 → `201 { id }`.
- `lambda/shareHandler.test.ts` (aws-sdk-client-mock), `lib/shareApiStack.test.ts` (CDK assertions), `README.md` (deploy, env wiring, abuse notes: anonymous public write → throttle + size cap + TTL lever + billing alarm; WAF/captcha future).

Root vitest include stays `src/**`; the backend repo tests and synths itself in its own CI. Nothing in this repo builds, imports, or runs anything from that checkout — it doesn't even need to be present.

## Stage 5 — IDE "Share link" flow (write path) ✅

- **Store:** `shareLinkOpen: boolean` + setter. **Naming caution:** `Toolbar.tsx` already has an `openShare` handler for the Export/Transfer dialog — name everything new `shareLink*`.
- **New:** `src/share/compatibility.ts` - `computeCompatibleDialects(source): string[]`: runs `getDialect(id).tokenize(source)` for every registry id, returns the ids with zero errors (colocated test with a program valid on several machines vs. one that is ZX81-only).
- **New:** `src/components/ShareLinkDialog.tsx` + module.css — on open: `createShare({ dialectId: dialect.id, compatibleDialects: computeCompatibleDialects(source), name: fileName, source })` → spinner → short URL `location.origin + playerPathFor(dialect.id, id)` with Copy (+ `navigator.share` on mobile), a line listing which machines the program is compatible with, and an "anyone with the link can view this code" note; error/retry; disabled with an explainer when offline or when `dialect.tokenize(source)` reports errors (don't mint links to broken programs).
- **Modified:** `src/components/Toolbar.tsx` (File-menu item "Share link…"), `src/App.tsx` (render dialog).

**Env wiring (self-contained):** dev needs `VITE_SHARE_API_URL` in this repo's `.env.local`, its value copied from the deployed stack's `ShareApiUrl` output (an `execute-api` URL). This is a duplicated literal, not a reference — the basically-share-server checkout is not required. Without it, `createShare` rejects with `'unconfigured'` and the dialog shows the disabled-state explainer, so the flow is also buildable/testable with mocked `fetch` before any backend is deployed.

**Verify:** unit tests mock `fetch` (as `shareClient.test.ts` already does); manual round-trip against the deployed API — share a program, open the minted URL in the player, confirm it runs; unset `VITE_SHARE_API_URL` and confirm the dialog degrades gracefully. All four gates.

## Stage 6 — Open-in-IDE handover ✅

- **Store:** `openSharedInIde({ dialectId, source, fileName })` - reuses the internal `applyDialectSwitch(s, next, text)` helper (`store.ts:384`) so teardown/AI-reset/breakpoint semantics match a real dialect switch (persisting the dialect is correct here — the user is moving into the IDE), then `dirty: false`. Bypasses the confirm dialog by design: at boot the editor holds only autosave, and `dirty: false` means the autosave loop won't clobber the user's saved program until they edit the shared one (same semantics as loading a sample).
- **New:** `src/app/useOpenShared.ts` - hook mounted in `App`: parse `?open=` once; valid ID → `fetchSharedProgram` → `openSharedInIde` → `history.replaceState` strips the param (so refresh doesn't re-clobber later edits); status-bar notice on failure.

## Stage 7 — Hosting, PWA hardening, full test pass

- GitHub Pages wiring: the `404.html` copy step from Stage 1 ships with the first player deploy; add the deployed API URL as the `SHARE_API_URL` repository variable (value copied from the stack's `ShareApiUrl` output — this repo's only cross-project input, and it's a duplicated value, not a reference) and pass it into the `npm run build` step in `.github/workflows/deploy.yml` as a `VITE_SHARE_API_URL` `env:` entry via the workflow `vars` context (the moustache syntax is not reproduced here because VitePress interpolates it). Confirm the Stage 4 stack's CORS `allowOrigins` matches the production Pages origin exactly (`https://ba.sical.ly`).
- PWA checks: installed-PWA update cycle lands `/run/x` in the player; denylist keeps `/docs` out of the SW fallback; cold (no-SW) deep link exercises the 404.html path.
- E2E: `e2e/player.spec.ts` (boot via `page.route` stub, canvas renders frames — reuse the canvas assertions from `e2e/debug.spec.ts`, FAB restart, error states, the incompatible-dialect notice + canonical-link redirect, landscape device project mirroring `landscape-layout.spec.ts`), `e2e/share-flow.spec.ts` (verb URL per dialect), open-in-IDE round trip.
- Docs page + CLAUDE.md architecture-table updates (`src/player/`, `src/share/`; link basically-share-server as the backend's home — a documentation link only, not a build input).

**Dependency graph:** 1 → 2 → 3 → 7; 2 → 4 → 5 → 7; (2, 4) → 6 → 7. Stages 3 and 4 parallelize after 2.

## Risk register

| Risk                                                                                                               | Mitigation                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setDialect` confirm dialog blocks programmatic boot                                                               | Dedicated `playerBoot` / `openSharedInIde` actions                                                                                                             |
| `replaceDocument` mobile side effect (mobileTab→editor + stopRequest)                                              | Player never calls it; `playerBoot` sets `mobileTab: 'preview'`                                                                                                |
| EmulatorPane couplings (mobileTab, landscape ⌨ toggle, `useInputOverlays`)                                         | Satisfied via store state + one additive `resumeAudio`; zero IDE behavior change                                                                               |
| Audio autoplay policy vs auto-start                                                                                | First-gesture `resumeAudio` + "tap for sound" pill; tap-to-play overlay as fallback                                                                            |
| SW serves stale index.html for new routes right after deploy                                                       | autoUpdate self-heals on next load; release-checklist note                                                                                                     |
| GitHub Pages serves deep links via 404.html (HTTP 404 status; root 404 also shadows missing `/docs/*` pages)       | Acceptable for an SPA; documented; revisit if link unfurling ever matters                                                                                      |
| Site deployed under a `/repo/` sub-path (no custom domain) would break `base: '/'`                                 | Confirmed the Pages custom domain serves the site at the root                                                                                                  |
| `base` change breaks hand-written relative URLs                                                                    | index.html + manifest audited in Stage 1; `vite preview` check                                                                                                 |
| Player toggles / dialect leaking into IDE localStorage                                                             | Ephemeral setters; `playerBoot` skips `persistDialectId`                                                                                                       |
| Anonymous public write abuse                                                                                       | POST throttling, 64 KiB cap, TTL lever, billing alarm                                                                                                          |
| Toolbar `openShare` naming collision (existing Export dialog)                                                      | New feature named `shareLink*`                                                                                                                                 |
| Tokenize-based compatibility is syntactic only (a program may tokenize on a machine yet rely on hardware it lacks) | Acceptable v1 heuristic; authoring dialect always included, canonical link always offered on mismatch                                                          |
| Accidental reverse dependency on basically-share-server (imports, shared config files, test wiring)                | Forbidden by design: only the deployed API URL crosses over, duplicated into `.env.local` / the `SHARE_API_URL` repo variable; dev and e2e otherwise use stubs |

## Verification (per stage + final)

Every stage ends with the CLAUDE.md gates: `npm run typecheck && npm test && npm run lint && npm run format:check`. UI stages additionally: drive the dev server (`npm run dev`), open a player URL with a stubbed/deployed API, confirm the program auto-runs, virtual keyboard/gamepad/physical keyboard all reach the machine, FAB restarts, Open-in-IDE lands in the editor with the program loaded. Final pass: `npm run e2e` including the new `player.spec.ts`/`share-flow.spec.ts`. The backend verifies itself in the basically-share-server repo's own CI — nothing in this repo's verification requires that checkout.
