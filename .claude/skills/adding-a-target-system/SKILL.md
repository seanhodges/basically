---
name: adding-a-target-system
description: >-
  Plan and scaffold a new target system (BASIC dialect + emulator + virtual
  keyboard) for Basically. Use when the user wants to support a new
  microcomputer or BASIC dialect, port the IDE to another machine, or make an
  existing half-built dialect feature complete. This skill audits the existing
  dialects, writes a dependency-ordered multi-stage plan to docs/contributing/dialect-plans/,
  and creates the initial compiling stub folder. It does NOT implement the
  stages — the user runs each stage later, when they choose.
---

# Planning & scaffolding a new target system

A **target system** is one microcomputer's worth of support: a BASIC **dialect**
(tokenizer, charset, keywords), an **emulator** (CPU bus + display + I/O), a
**virtual keyboard**, transfer/tape I/O, an AI profile and samples. That is ~20
files, and the feature baseline keeps rising — so new dialects routinely ship
half-finished (e.g. `src/dialects/bbcmaster/` has only `aiProfile.ts` +
`index.ts`, while `zx81`/`zxspectrum`/`commodore64` are complete).

**This skill does not write the implementation.** It produces a staged plan and
the initial scaffolding, then stops. Run it to get:

1. an **audit** of what "feature complete" means _today_ (derived from the
   existing dialects, not a stale checklist);
2. a **multi-stage plan** at `docs/contributing/dialect-plans/<id>.md`, dependency-ordered and
   grouped into medium, single-session tasks for the coding agent;
3. a **compiling stub folder** at `src/dialects/<id>/` ready for each stage to
   fill in.

> **Hard rule:** do not implement any stage, and do not register the dialect.
> Your output is the plan + stubs. The user decides when each stage runs.

## The one mental model

The app **only** talks to the `Dialect` and `MachineEmulator` interfaces in
`src/dialects/types.ts`. Everything machine-specific lives in a single folder,
`src/dialects/<name>/`. The seam means a complete dialect is exactly "every
member of those interfaces implemented, plus the optional ones the mature
dialects all carry". Nothing outside the dialect folder should change except
`src/dialects/registry.ts` (a later stage), a ROM asset, and an optional CSS
theme block.

## Phase 1 — Audit the existing dialects

Read the _complete_ reference dialects rather than trusting a fixed list, so the
plan reflects the current baseline. Read:

- `src/dialects/types.ts` — the `Dialect` / `MachineEmulator` contract. Note both
  the **required** members and the optional ones the mature dialects ship:
  `displaySize`, `binaryImports`, `audio` (incl. `audio.decodeSamples`,
  `saveInstructions`), and `MachineEmulator.readVariables`.
- `src/dialects/zx81/` — reference for the **in-tree bus over the vendored Z80
  core** pattern: `emulator/` (`zx81Machine.ts`, `memory.ts`, `display.ts`,
  `keyboard.ts`), `pfile.ts` (image builder), `sysvars.ts`, `vars.ts`
  (`readVariables`), `audio/` (cassette codecs), plus the language files.
- `src/dialects/commodore64/` and `src/dialects/bbcmicro/` — reference for the
  **adapter over a third-party emulator** pattern (6502 via viciious / jsbeeb in
  `src/emulator/<machine>/`), their `targets.ts`, `audio/`, `keyboardLayout.ts`,
  and the native-tokenizer-over-wrapped-ROM approach.
- `src/dialects/registry.ts` — how a dialect is registered (a later stage).

Know these dialect-aware seams _outside_ the folder so the plan reuses them and
does **not** edit them:

| Seam                                                                    | Reuse for                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/editor/basicLanguage.ts`                                           | `BasicLanguageOptions`: `nameChars`, `suffixChars`, `graphicsEscapes`, `hexPrefix`, `binaryPrefix` |
| `src/editor/completions.ts`                                             | generic keyword autocomplete                                                                       |
| `src/keyboard/layoutSchema.ts`                                          | keyboard layout types                                                                              |
| `src/keyboard/templateRows.ts`                                          | 40-column row templates                                                                            |
| `src/keyboard/sinclairGlyphs.ts`                                        | shared block-graphic glyphs                                                                        |
| `src/keyboard/{VirtualKeyboard,inputEngine}.tsx/.ts`                    | data-driven keyboard (no changes needed)                                                           |
| `src/dialects/sinclairTape.ts`, `sinclairCharset.ts`, `sinclairVars.ts` | shared Sinclair codecs                                                                             |
| `src/transfer/{wav,audioRecorder}.ts`                                   | WAV encode / mic record                                                                            |
| `src/emulator/z80/`                                                     | vendored Z80 core — **use, never edit**                                                            |

From the audit, produce a **capability checklist** = the union of what the
complete dialects ship. Then classify the target:

- **CPU / bus pattern** — in-tree Z80 bus, or adapter over a third-party package
  (check the package **license** first; jsbeeb's GPL-3.0 is why this repo is GPL).
- **Display size** — set `displaySize` if not the classic 256×192.
- **Tape / image format** — `.p`/`.tap`/`.prg`/`.bbc` equivalent, tape scheme.
- **Existing state** — if `src/dialects/<id>/` already partly exists (like
  `bbcmaster`), diff what's present against the checklist and plan **only the
  gaps**.

## Phase 2 — Write the staged plan

Copy the bundled `plan-template.md` into `docs/contributing/dialect-plans/<id>.md` and fill it
in. Keep the template's status legend (✅ shipped / 🔨 in progress / ⬜ planned
/ ⛔ blocked, matching `docs/reference/dialect-roadmap.md`) and its per-stage structure:
checklist, files created/filled, dependencies, and a verify line. Add a
cross-link to the new plan from `docs/reference/dialect-roadmap.md`.

Group work by dependency into medium, single-session stages. Default breakdown
(adapt to the audited gaps — drop any stage already satisfied):

| Stage                                          | Scope                                                                                                                                                                                                                                                                         | Depends on                                       | Verify                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **1 — Language core**                          | `keywords.ts`, `charset.ts`, `language.ts`, `tokenizer.ts` / `detokenizer.ts`, `lint`, the image builder (`pfile.ts`/`tapfile.ts`/`.prg` equivalent) + colocated tests. No registry change.                                                                                   | types contract                                   | `npm test` (tokenizer round-trip, charset, image-builder pointers) + `npm run typecheck` |
| **2 — Emulator core**                          | `emulator/` (machine + memory + display + keyboard matrix) implementing `MachineEmulator`, **or** the adapter folder under `src/emulator/<machine>/` when wrapping a package; ROM into `public/roms/<id>.rom` with attribution.                                               | charset (display), image builder (`loadProgram`) | emulator boot test: boot ROM, inject a program, assert on display memory                 |
| **3 — Wire-up: keyboard + samples + register** | `keyboardLayout.ts` (tokens match emulator `setKey`), `samples.ts` + `samples/*.bas` (canonical `hello`/`circles`/`breakout`/`maze`, degrade gracefully), finalize `aiProfile.ts`, **register in `registry.ts`**, optional `src/styles.css` theme. Now selectable + runnable. | stages 1–2                                       | typecheck + tests + `npm run dev` smoke + `npm run e2e`                                  |
| **4 — Transfer & tape I/O**                    | `targets.ts` build targets, `audio` (`buildSamples` + `decodeSamples`, load/save instructions), `binaryImports`.                                                                                                                                                              | tokenizer/detokenizer, image builder             | audio round-trip test + import/export in the app                                         |
| **5 — Polish / optional**                      | `readVariables` + variable watcher, richer build targets, dot-abbreviation/quirks, AI-profile accuracy pass, keyboard theming / function-key strip.                                                                                                                           | stage 3                                          | watcher shows vars; targeted tests                                                       |

### Canonical samples (Stage 3)

Every dialect ships the same four programs, **in this order**, ported to the
machine's own BASIC (match the _behaviour_, not bytes; degrade gracefully rather
than dropping). The first (`hello`) is the starter shown for a fresh document.

| `name`         | `title`       | What it does                                                           |
| -------------- | ------------- | ---------------------------------------------------------------------- |
| `hello.bas`    | `Hello world` | Prints a greeting; show off text colour / display.                     |
| `circles.bas`  | `Circles`     | Concentric circles, showcasing colour graphics.                        |
| `breakout.bas` | `Breakout`    | Paddle bounces a ball off a wall of blocks; score; lose when it drops. |
| `maze.bas`     | `Maze`        | Fixed wall map; move a marker with cursor keys to the exit.            |

Only exclude a sample when it genuinely cannot be ported (e.g. the ZX80 drops
`breakout`); keep the rest in the same relative order. Compare `zx81/`,
`zxspectrum/`, `bbcmicro/`, `commodore64/` sample folders for the same set
expressed several ways. Never point a new dialect at another machine's `.bas`.

## Phase 3 — Create the compiling stub folder

Create `src/dialects/<id>/` mirroring the chosen reference dialect, with one
type-valid throwing stub per planned component, colocated test stubs, and a
`samples/` directory. **Constraints that keep the build green:**

- **Stubs must pass `tsc -b`.** Strict mode (`noUnusedLocals`,
  `noUnusedParameters`) compiles _all_ files under `src/`, registered or not. So
  prefix unused params with `_`, give every export the exact shape the contract
  expects, and use bodies like `throw new Error('<id>: not implemented');`.
- **Do not touch `registry.ts`.** An unregistered stub keeps the app and e2e
  clean while the dialect is WIP; registration is Stage 3 of the plan.
- **Test stubs use `describe` + `it.todo(...)`** so `npm test` passes with the
  stubs present.
- **Do not fabricate a ROM.** Note the required `public/roms/<id>.rom` and its
  license/attribution in the plan's target summary instead.

After scaffolding, confirm `npm run typecheck` and `npm test` still pass and that
`git status` shows changes confined to `src/dialects/<id>/`,
`docs/contributing/dialect-plans/<id>.md`, and the roadmap cross-link — `registry.ts`
untouched.

## Phase 4 — Stop

End by pointing the user at `docs/contributing/dialect-plans/<id>.md` and telling them to run
the stages on demand. Do not start implementing.

## Conventions (from CLAUDE.md)

- **Strict TypeScript** — `noUnusedLocals` / `noUnusedParameters` /
  `noFallthroughCasesInSwitch` are on; unused symbols fail the build.
- **Errors, not throws** (in real code) — the tokenizer returns
  `TokenizeError[]` (1-based line, 0-based column), it does not throw. (Stub
  bodies are the one exception — they throw "not implemented".)
- **Naming** — components `PascalCase`, functions/vars `camelCase`, hardware
  constants `SCREAMING_SNAKE_CASE` (e.g. `TSTATES_PER_FRAME`).
- **Formatting** — Prettier (single quotes, semicolons, 2-space, trailing
  commas). Run `npm run format` before finishing.

## Key files to study

| File                                                                                                                            | What it shows                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `src/dialects/types.ts`                                                                                                         | Every interface a complete dialect implements |
| `src/dialects/zx81/index.ts`                                                                                                    | How a `Dialect` is assembled (in-tree Z80)    |
| `src/dialects/commodore64/index.ts`                                                                                             | A `Dialect` over a wrapped 6502 emulator      |
| `src/dialects/bbcmaster/`                                                                                                       | A half-built dialect — the gap-audit case     |
| `src/dialects/registry.ts`                                                                                                      | Where registration happens (Stage 3)          |
| `src/dialects/zx81/emulator/`                                                                                                   | `MachineEmulator` over the shared Z80 core    |
| `src/keyboard/layoutSchema.ts`                                                                                                  | All keyboard-layout types                     |
| `docs/reference/dialect-roadmap.md`                                                                                             | Tiered roadmap + status legend to cross-link  |
| `docs/contributing/adding-a-dialect.md` (dialect folder + virtual keyboard), `docs/reference/{file-formats,serial-protocol}.md` | Per-component reference detail for the stages |

## Guardrails

- **Plan & scaffold only — never implement a stage or register the dialect.**
- **Don't touch** `src/emulator/z80/` (vendored Z80 core) or third-party ROMs
  under `public/roms/` — fix bus bugs in your dialect's emulator, not the core.
- Nothing outside `src/dialects/<id>/` changes except (later) the registry, the
  ROM asset, and an optional `src/styles.css` theme block. A wider change means
  the seam is being bypassed.
