# Standalone player & share links

Basically can turn any program into a short link that opens a **standalone
player** - a cut-down, fully responsive view with just the emulator screen, an
on-screen keyboard and a virtual gamepad, no editor or menus. Open the link and
the program loads and runs straight away; a round green Play button restarts it,
and a "See the Code" button hands it back to the full IDE.

This page explains how that feature is put together for contributors. Read it
alongside the [architecture overview](/contributing/architecture).

## The share URL scheme

Every share URL is `/<verb>/<id>`, where the **verb picks the machine** and the
**six-character id** identifies the shared program. Each verb is a real keyword
from that machine's own BASIC (nothing invented), chosen to evoke loading or
running code:

| Path         | Machine       | Keyword                                    |
| ------------ | ------------- | ------------------------------------------ |
| `/load/:id`  | ZX81          | `LOAD` - the iconic ZX81 tape command      |
| `/goto/:id`  | ZX80          | `GO TO` - ZX80 4K BASIC                    |
| `/gosub/:id` | Spectrum      | `GO SUB` - Spectrum BASIC                  |
| `/play/:id`  | Spectrum 128K | `PLAY` - a 128K-exclusive keyword          |
| `/chain/:id` | BBC Micro     | `CHAIN ""` - BBC BASIC load-and-run        |
| `/old/:id`   | BBC Master    | `OLD` - BBC BASIC program recovery         |
| `/run/:id`   | Commodore 64  | `RUN` - after `LOAD` on the C64            |
| `/link/:id`  | Acorn Atom    | `LINK` - Atom BASIC "execute machine code" |
| `/cload/:id` | TRS-80        | `CLOAD` - Level II BASIC tape load         |

The table lives in `src/player/routes.ts` (`SHARE_VERBS`), which is deliberately
dependency-free so the backend can bundle it too (see below). A unit test in
`src/player/routes.test.ts` asserts the table stays in **bijection** with the
dialect registry, so a new machine cannot ship without a verb. The id alphabet
is the unambiguous lowercase set `23456789abcdefghjkmnpqrstuvwxyz` (no `0/o/1/l/i`),
validated by `SHARE_ID_RE`.

Routing needs no router library: `src/main.tsx` calls `parsePlayerPath(location.
pathname)` once before React renders and lazy-loads either the IDE (`App`) or the
player (`PlayerApp`), so the player never pulls in CodeMirror or the AI SDKs.

## How a program is shared and opened

The write path and read path meet at the share record:

1. **Mint a link (IDE).** File ▸ "Share link…" opens `ShareLinkDialog`, which
   calls `createShare()` (`src/share/shareClient.ts`) with the program's dialect,
   name, source, and a `compatibleDialects` list. The backend stores it and
   returns a fresh id; the dialog shows the short URL to copy or share.
2. **Boot the player (link).** `PlayerApp` fetches the record with
   `fetchSharedProgram()`, checks the URL's machine can run it, then calls the
   store's `playerBoot()` action and auto-runs. `playerBoot` bypasses the IDE's
   confirm dialog and never overwrites the IDE's remembered machine or its
   keyboard/gamepad settings, so playing a shared game leaves the editor
   untouched.
3. **Hand back to the IDE ("See the Code").** The button navigates to
   `/?open=<id>`; `useOpenShared` (`src/app/useOpenShared.ts`) re-fetches the
   record, loads it into the editor with the right machine selected, and strips
   the query param. Re-fetching (rather than an in-memory handoff) makes the URL
   refresh-safe and shareable in its own right.

### Compatibility checking

A program is stored with its authoring `dialectId` **plus** a
`compatibleDialects` list - the machines it tokenizes cleanly on.
`computeCompatibleDialects()` (`src/share/compatibility.ts`) builds it at share
time by running every registered dialect's `tokenize(source)` and keeping the
ids with zero errors. When a link's verb selects a machine that is not in that
list, the player shows an incompatibility notice with a one-tap link to the
program's canonical URL instead of booting a machine that cannot run it. This is
a **syntactic** check only - a program may tokenize on a machine yet rely on
hardware it lacks - so the authoring machine is always included and the canonical
link is always offered on a mismatch.

## The backend

Share records live in a small AWS backend (DynamoDB + Lambda + an HTTP API),
which has its own home:
[basically-share-server](https://github.com/seanhodges/basically-share-server).
It bundles this repo's `src/player/routes.ts` as its single source of valid
dialect ids.

The dependency is **strictly one-way**: this repo never reads code, tests, or
config from the backend. The only thing that crosses back is a _value_ - the
deployed API URL - supplied to the build as `VITE_SHARE_API_URL` (the
`SHARE_API_URL` repository variable in CI, or `.env.local` in development). When
it is unset the share client degrades gracefully: the "Share link…" dialog
explains that no share service is configured, and player links show the same
notice rather than firing requests at a missing origin.

Hosting is GitHub Pages, which has no SPA rewrites, so cold deep links such as
`/load/abc234` are served through a build-time copy of `index.html` to
`404.html`; the installed-PWA case is covered by the service worker's navigation
fallback.
