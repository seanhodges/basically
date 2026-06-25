# CLAUDE.md

Guidance for working in this repository. Read the **Commands** and
**Architecture** sections first — they cover most tasks.

## What this is

**Basically** is a browser-based IDE for microcomputer BASIC dialects spanning
several classic machines (Sinclair, Acorn/BBC, Commodore, Tandy…). The exact set
ships in the registry, so don't assume a count or list — check
`src/dialects/registry.ts` (`getDialect`/the registered dialects) for what's
actually available. Each dialect has an in-browser CPU emulator, per-dialect
hardware export (cassette audio plus a native binary such as `.P`, `.O`, `.TAP`,
`.bbc`, `.prg`, `.cas`, or `.atm`, and a WebSerial bridge), and an optional
Claude-powered code assistant.

**Stack:** TypeScript (strict), React 18, Vite 6, Vitest 3, CodeMirror 6,
Zustand 5, and the Anthropic SDK.

**Key mental model:** the app talks only to the `Dialect` interface
(`src/dialects/types.ts`) and the `MachineEmulator` it returns — never to a
machine's specifics directly. Each dialect lives in `src/dialects/<name>/`. Some
dialects keep a small self-contained machine under that folder; others wrap a
larger vendored/third-party core under `src/emulator/` (e.g. the BBC's jsbeeb in
`src/emulator/bbc/`, the C64's viciious in `src/emulator/c64/`). The `Dialect`
seam is what stays uniform and makes new dialects pluggable.

## Commands

```bash
npm install            # install dependencies
npm run dev            # Vite dev server at http://localhost:5173

npm test               # run all unit tests once (vitest run)
npm run test:watch     # vitest in watch mode
npx vitest run src/dialects/zx81/tokenizer.test.ts   # run a single test file

npm run e2e            # Playwright end-to-end / visual tests (specs in e2e/)
npm run e2e:headed     # same, with a visible browser
npm run e2e:report     # open the last Playwright HTML report

npm run typecheck      # fast type check (tsc -b, no bundle)
npm run lint           # ESLint
npm run lint:fix       # ESLint with autofix
npm run format         # Prettier write
npm run format:check   # Prettier check (used in CI)

npm run build          # tsc -b && vite build → dist/
```

**Before finishing a change**, run `npm run typecheck`, `npm test`,
`npm run lint`, and `npm run format:check` (or `npm run format` to auto-fix).
For tokenizer / emulator / charset changes, add or update the colocated
`*.test.ts` rather than only checking by hand.

## Architecture

| Path                           | Role                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/dialects/types.ts`        | The `Dialect` / `MachineEmulator` contracts — the app's only seam                                                                         |
| `src/dialects/registry.ts`     | Registers available dialects (`getDialect(id)`)                                                                                           |
| `src/dialects/<name>/`         | One folder per dialect (tokenizer, charset, keywords, samples, `aiProfile`, `targets`); the Z80 dialects also hold their `emulator/` here |
| `src/emulator/z80/`            | Vendored Z80 CPU core; used by the Sinclair machines (ZX81/ZX80/Spectrum)                                                                 |
| `src/emulator/bbc/`            | BBC Micro/Master machine (`bbcMachine.ts`), an adapter around the jsbeeb core                                                             |
| `src/emulator/c64/`            | Commodore 64 machine (`c64Machine.ts`) around the vendored viciious core                                                                  |
| `src/emulator/6502/`           | Vendored 6502 CPU core (present; not yet wired to a dialect)                                                                              |
| `src/editor/`                  | Generic CodeMirror builders: BASIC language, completions, lint, line numbering                                                            |
| `src/app/`                     | Zustand store (`store.ts`) and app-level hooks/utilities                                                                                  |
| `src/components/`              | React UI: `Workspace`, `EmulatorPane`, `AiPanel`, `Toolbar`, status bar                                                                   |
| `src/ai/`                      | Anthropic SDK client, prompt builder, AI code extractor/merge                                                                             |
| `src/transfer/`                | Hardware export: WAV cassette, `.P`, WebSerial protocol                                                                                   |
| `src/storage/`                 | localStorage settings + autosave                                                                                                          |
| `src/dialects/<name>/samples/` | Bundled sample `.bas` programs for that dialect (registered in its `samples.ts`)                                                          |

**Run-a-program data flow** (ZX81 shown; the build step is dialect-specific —
`buildPFile`/`.P`, `.O`, `.TAP`, raw BBC bytes, `.prg` — but the shape is the
same for every dialect):

```
editor (CodeMirror)
  → store.setSource()
  → dialect.tokenize(source)          # text → program bytes (+ TokenizeError[])
  → buildPFile(...)                   # bytes → full memory image (dialect-specific)
  → machine.loadProgram(image)        # the dialect's MachineEmulator
  → runFrame() + renderTo(canvas)     # per 50Hz frame
```

The AI path is parallel: prompt + lint errors → `streamChat()` →
`extractCodeBlocks()` → `mergeBasicLines()` → push back into the editor.

## Adding a dialect

Implement the `Dialect` interface in a new `src/dialects/<name>/` folder and
register it in `src/dialects/registry.ts`. A small self-contained machine can
live in that folder (mirror `zx81/`); when you wrap a large external core, put
the machine under `src/emulator/` instead (see `bbc/` and `c64/`). Either way the
app only ever talks to the `Dialect` seam. Full step-by-step guide:
**`docs/adding-a-dialect.md`**; see also `docs/dialect-roadmap.md`,
`docs/file-formats.md` (`.bas` / `.P` / `.O` / `.TAP` / `.BBC` / `.prg` /
cassette audio), and `docs/serial-protocol.md` (the WebSerial bridge).

## Conventions

- **Strict TypeScript** — `noUnusedLocals`, `noUnusedParameters`, and
  `noFallthroughCasesInSwitch` are on; unused symbols fail the build.
- **Naming** — components `PascalCase`, functions/vars `camelCase`, hardware
  constants `SCREAMING_SNAKE_CASE` (e.g. `TSTATES_PER_FRAME`).
- **Errors, not throws** — the tokenizer collects `TokenizeError[]` (1-based
  line, 0-based column) for inline editor display instead of throwing.
- **State** — single Zustand store; components subscribe via narrow selectors
  (`useIdeStore((s) => s.source)`). Async work is requested by bumping a counter
  (e.g. `runRequest`) that a `useEffect` watches, not by calling across modules.
- **Tests** — `*.test.ts` colocated with source; emulator tests may read the
  real ROM(s) under `public/roms/` (e.g. `zx81.rom`, `zxspectrum.rom`, `c64/…`).
- **Formatting** — Prettier (single quotes, semicolons, 2-space, trailing
  commas). Run `npm run format` before committing.

## ZX81 BASIC gotchas

These rules are ZX81-specific (shown as a worked example); the other dialects
have their own syntax rules in their dialect folders.

- One numbered statement per line; line numbers are 1–9999 and must be strictly
  ascending. No multi-statement lines, no `ELSE`.
- Variable names are single letters (`A`–`Z`, optional `$` for strings).
- Keywords tokenize to single bytes; the charset maps unicode block graphics and
  escapes to ZX81 codes.
- Display has two modes: **FAST** (CPU full speed, screen blanked) and **SLOW**
  (continuous display, ~1/4 speed).

## Don't touch

- `src/emulator/z80/` — vendored Z80 core (MIT, Molly Howell). Don't rewrite it;
  fix bugs upstream-style or in the relevant machine adapter/bus instead.
- `src/emulator/6502/cpu6502.js` — vendored build output; don't hand-edit.
- `src/emulator/c64/viciious/` — vendored viciious C64 core (public domain).
- The **jsbeeb** npm package — wrap it in `src/emulator/bbc/`, don't fork it.
- `public/roms/**` — third-party ROMs (see `public/roms/ATTRIBUTION.md` for
  origins and licensing). Don't modify or relicense.
