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
**virtual keyboard**, transfer/tape I/O, a memory map + memory blocks, an AI
profile, samples and reference docs. That is 30–40 files once tests are counted,
and the feature baseline keeps rising — a plan built from a stale checklist
ships a dialect that is half-finished by today's standards. Derive the baseline
from `src/dialects/registry.ts` and the mature folders at audit time; treat the
examples in this file as illustrations, not the source of truth.

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
`src/dialects/types.ts`. Everything machine-specific lives in
`src/dialects/<name>/` — plus, when wrapping a large core, a machine adapter
folder under `src/emulator/<machine>/`. The seam means a complete dialect is
exactly "every member of those interfaces implemented, plus the optional ones
the mature dialects all carry". The runtime layers (store, components, share
compatibility, storage, keyboard engine) are registry/interface-driven and never
change — but a handful of small per-dialect tables outside the folder **must**
be edited; they are enumerated in the audit section below. A change anywhere
else means the seam is being bypassed.

## Phase 1 — Audit the existing dialects

Read the _complete_ reference dialects rather than trusting a fixed list, so the
plan reflects the current baseline. Read:

- `src/dialects/types.ts` — the `Dialect` / `MachineEmulator` contract. Read the
  interfaces themselves and list every member — don't work from a remembered
  subset. Beyond the required members (which include `programRamBytes`), the
  mature dialects ship most of the optional ones: `memoryMap` + `memoryBlocks`
  (every complete dialect has both), `displaySize`, `binaryImports`,
  `supportsBinaryLines`, `audio` (incl. `decodeSamples`, `saveInstructions`),
  `detokenizeWithReport`, `docsReference`, `memoryWrites` / `addressNotation`,
  `joystickModes`, `debuggable`; and on `MachineEmulator`: `readVariables`,
  `readReport`, `readMemoryStats`, `readAudio` / `audioSampleRate` (emulator
  sound), the memory-activity hooks, and the debugger hooks (`currentLine` /
  `debugStep`). `romUrl` is optional — an interpreter dialect ships no ROM.
- `src/dialects/zx81/` — reference for the **in-tree bus over the vendored Z80
  core** pattern: `emulator/` (`zx81Machine.ts`, `memory.ts`, `display.ts`,
  `keyboard.ts`), `pfile.ts` (image builder), `sysvars.ts`, `vars.ts`
  (`readVariables`), `reports.ts`, `memoryMap.ts`, `memoryBlocks.ts`,
  `listingLayout.ts`, `audio/` (cassette codecs), plus the language files.
- `src/dialects/commodore64/` and `src/dialects/bbcmicro/` — reference for the
  **adapter over a third-party emulator** pattern (6502 via viciious / jsbeeb in
  `src/emulator/<machine>/`, which is also where their machine-side `vars.ts` /
  `reports.ts` live), their `targets.ts`, `audio/`, `keyboardLayout.ts`, and the
  native-tokenizer-over-wrapped-ROM approach.
- `src/dialects/bbcmaster/` and `src/dialects/zxspectrum128/` — reference for
  the **delegation** pattern: a sibling machine imports most language files,
  samples and keyboard from its base dialect and owns only `memoryMap.ts`,
  `memoryBlocks.ts`, `aiProfile.ts`, its metadata, and (when needed) an emulator
  variant. By far the cheapest plan shape — always check for a shipped sibling
  first.
- `src/dialects/trs80/` — reference for the **in-tree interpreter** pattern: a
  full BASIC interpreter under `trs80/interpreter/`, no ROM, no CPU core.
- `src/dialects/registry.ts` — how a dialect is registered (a later stage), and
  the authoritative list of what ships today.

Know these dialect-aware seams _outside_ the folder so the plan reuses them and
does **not** edit them:

| Seam                                                                    | Reuse for                                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/editor/basicLanguage.ts`                                           | `BasicLanguageOptions`: `nameChars`, `suffixChars`, `graphicsEscapes`, `hexPrefix`, `binaryPrefix`    |
| `src/editor/completions.ts`                                             | generic keyword autocomplete                                                                          |
| `src/keyboard/layoutSchema.ts`                                          | keyboard layout types, incl. `GraphicsPalette` / `GraphicEntry`                                       |
| `src/keyboard/templateRows.ts`                                          | 40-column row templates                                                                               |
| `src/dialects/semigraphicsAudit.ts`                                     | declare the machine's graphics byte range in `SEMIGRAPHIC_CODES`; join `IN_SCOPE` once it round-trips |
| `src/keyboard/{VirtualKeyboard,inputEngine}.tsx/.ts`                    | data-driven keyboard (no changes needed)                                                              |
| `src/dialects/sinclairTape.ts`, `sinclairCharset.ts`, `sinclairVars.ts` | shared Sinclair codecs                                                                                |
| `src/dialects/{sinclairReports,sinclairImportReport,importBlocks}.ts`   | shared report decoding / import-to-blocks helpers                                                     |
| `src/transfer/{wav,audioRecorder}.ts`                                   | WAV encode / mic record                                                                               |
| `src/emulator/z80/`, `src/emulator/6502/`                               | vendored CPU cores — **use, never edit**                                                              |
| `src/emulator/commodore/`                                               | shared Commodore chip helpers (VIA/PIA, char renderer)                                                |

And know the small per-dialect tables **outside** the folder that a new dialect
**must** edit — the plan's stages have to include them:

| File                                                                                                                                        | Required edit                                                                                                                                                                                                        | Stage                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `src/dialects/registry.ts`                                                                                                                  | import + `dialects` array entry (array order = UI menu order)                                                                                                                                                        | wire-up                               |
| `src/player/routes.ts`                                                                                                                      | a `SHARE_VERBS` entry — the verb must be a real keyword of this machine's BASIC, unique in the table. `routes.test.ts` asserts a strict **bijection** with the registry: registering without a verb fails `npm test` | wire-up (same change as registration) |
| `src/editor/constructs.ts`                                                                                                                  | `constructsByDialect.<id>` template list (siblings may reuse another id's array); the dialect's `language.ts` reads it for block autocomplete                                                                        | language core                         |
| `src/editor/variableLint.ts`                                                                                                                | thin `<id>VariableErrors` wrapper over `singleLetterVariableErrors` or the Microsoft-family helper                                                                                                                   | language core                         |
| `src/keyboard/VirtualKeyboard.css`                                                                                                          | optional `vk-theme-<id>` block (**not** `src/styles.css`, which has no per-dialect content)                                                                                                                          | wire-up / polish                      |
| `public/roms/…` + `public/roms/ATTRIBUTION.md`                                                                                              | ROM asset **and** its attribution block (skip for interpreter dialects)                                                                                                                                              | emulator core                         |
| `docs/reference/<id>.md`, `docs/reference/<id>/{hardware,escapes,formats}.md`, `src/reference/<id>.ts`, `docs/.vitepress/config.ts` sidebar | per-dialect reference docs — run the **`dialect-reference-docs`** skill (it owns the scaffold commands, page templates and crosscheck tests)                                                                         | docs                                  |
| `docs/contributing/dialect-roadmap.md`                                                                                                      | status row + cross-link to the plan                                                                                                                                                                                  | when planning                         |

From the audit, produce a **capability checklist** = the union of what the
complete dialects ship. Then classify the target:

- **CPU / bus pattern** — one of four: in-tree bus over a vendored core
  (Z80/6502), adapter over a third-party package (check the package **license**
  first — jsbeeb's GPL-3.0 is why this repo is GPL — and note whether a new npm
  dependency is needed), **delegation over a shipped sibling dialect**, or an
  in-tree interpreter (no ROM, no core).
- **Display size** — set `displaySize` if not the classic 256×192.
- **Tape / image format** — `.p`/`.tap`/`.prg`/`.bbc` equivalent, tape scheme.
- **Existing state** — if `src/dialects/<id>/` already partly exists, diff
  what's present against the checklist and plan **only the gaps**. Check the
  registry too — a thin folder may already be feature complete via delegation.

## Phase 2 — Write the staged plan

Copy the bundled `plan-template.md` into `docs/contributing/dialect-plans/<id>.md` and fill it
in. Keep the template's status legend (✅ shipped / 🔨 in progress / ⬜ planned
/ ⛔ blocked, matching `docs/contributing/dialect-roadmap.md`) and its per-stage structure:
checklist, files created/filled, dependencies, and a verify line. Add a
cross-link to the new plan from `docs/contributing/dialect-roadmap.md`.

Group work by dependency into medium, single-session stages. Default breakdown
(adapt to the audited gaps — drop any stage already satisfied; for a
**delegation** target, collapse stages 1/3/4 into "import from the base dialect,
own the memory map/blocks, AI profile, metadata and emulator variant"):

| Stage                                          | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Depends on                                       | Verify                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **1 — Language core**                          | `keywords.ts`, `charset.ts`, `language.ts`, `tokenizer.ts` / `detokenizer.ts`, `lint` (+ `constructsByDialect.<id>` in `src/editor/constructs.ts`, `<id>VariableErrors` wrapper in `src/editor/variableLint.ts`), the image builder (`pfile.ts`/`tapfile.ts`/`.prg` equivalent) + colocated tests. The charset gives each block graphic its **exact** unicode character where one exists (Block Elements, then Symbols for Legacy Computing) and falls back to an escape only where injectivity or unicode forces it; declare the machine's graphics range in `SEMIGRAPHIC_CODES`, cited to a primary source, or leave it `null` rather than guessing. No registry change.                                                                                                                                                                                                                                                                                             | types contract                                   | `npm test` (tokenizer round-trip, charset, image-builder pointers) + `npm run typecheck` |
| **2 — Emulator core**                          | `emulator/` (machine + memory + display + keyboard matrix) implementing `MachineEmulator`, **or** the adapter folder under `src/emulator/<machine>/` when wrapping a package (note any new npm dep + license); ROM into `public/roms/` **plus an `ATTRIBUTION.md` block** — no ROM at all for interpreter dialects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | charset (display), image builder (`loadProgram`) | emulator boot test: boot ROM, inject a program, assert on display memory                 |
| **3 — Wire-up: keyboard + samples + register** | `keyboardLayout.ts` (tokens match emulator `setKey`), `graphics.ts` (a `GraphicEntry[]` read by both the keyboard and the charset so they cannot drift — derive the keys from the ROM, and where the machine printed no graphics on its keycaps omit `key` so the cell is labelled by character code), the `palette: 'graphics'` editor mode + `graphicsPalette` on the layout, the id appended to `e2e/paletteMachines.ts` (`src/dialects/graphicsPalette.test.ts` pins that list against the registry, in registry order), `samples.ts` + `samples/*.bas` (canonical set from the audit, degrade gracefully), finalize `aiProfile.ts`, **register in `registry.ts` and add the `SHARE_VERBS` verb in `src/player/routes.ts` in the same change** (bijection test), optional `vk-theme-<id>` block in `src/keyboard/VirtualKeyboard.css`, the picker identity fields (`name`, `manufacturer`, `year`, `blurb`) written to the rules below. Now selectable + runnable. | stages 1–2                                       | typecheck + tests + `npm run dev` smoke + `npm run e2e`                                  |
| **4 — Transfer & tape I/O**                    | `targets.ts` build targets, `audio` (`buildSamples` + `decodeSamples`, load/save instructions), `binaryImports`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | tokenizer/detokenizer, image builder             | audio round-trip test + import/export in the app                                         |
| **5 — Memory map & runtime introspection**     | `memoryMap.ts`, `memoryBlocks.ts` (+ machine-side block load/inject support in `loadProgram`), `sysvars.ts`/`vars.ts`/`reports.ts` → `readVariables`/`readReport`, `readMemoryStats` + memory-activity hooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | stages 2–3                                       | memory-map + blocks tests; watcher shows live vars                                       |
| **6 — Docs & polish**                          | reference docs — run the **`dialect-reference-docs`** sub-skill (scaffolds the table data, writes the parent + hardware/escapes/formats pages from its templates, wires the sidebar/index/assembly lists, extends the crosscheck tests); roadmap status row, joystick, debugger hooks, emulator sound (`readAudio`), dot-abbreviation/quirks, AI-profile accuracy pass, keyboard theming / function-key strip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | stage 3                                          | docs dev build renders; targeted tests                                                   |

### Canonical samples (Stage 3)

> **Use the `authoring-dialect-samples` sub-skill to write the samples.** It
> covers the per-sample intent and accuracy gotchas (the Pitteway `E/2` circles
> recurrence and ring-closure count, solvable mazes, keyword-as-variable
> collisions), the `samples.ts` / machine-code-block registration shape, and the
> colocated `samples.test.ts` checks each dialect must ship. The summary below is
> just the Stage-3 placement.

Every dialect ships the same sample set, **in the same order**, ported to the
machine's own BASIC (match the _behaviour_, not bytes; degrade gracefully rather
than dropping). The first (`hello`) is the starter shown for a fresh document.
**Derive the authoritative set from the shipped dialects' `samples.ts` at audit
time** — the set grows (this table is a snapshot, last known to be):

| `name`         | `title`        | What it does                                                                                                     |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `hello.bas`    | `Hello world`  | Prints a greeting; show off text colour / display.                                                               |
| `circles.bas`  | `Circles`      | Concentric circles, showcasing colour graphics.                                                                  |
| `breakout.bas` | `Breakout`     | Paddle bounces a ball off a wall of blocks; score; lose when it drops.                                           |
| `maze.bas`     | `Maze`         | Fixed wall map; move a marker with cursor keys to the exit.                                                      |
| `kaleido.bas`  | `Kaleidoscope` | Mirrored plotting; carries a machine-code routine as memory blocks / a `#BIN` REM where the machine supports it. |

Only exclude a sample when it genuinely cannot be ported (e.g. the ZX80 drops
`breakout`); keep the rest in the same relative order. Compare `zx81/`,
`zxspectrum/`, `bbcmicro/`, `commodore64/` sample folders for the same set
expressed several ways. Never point a new dialect at another machine's `.bas`.

### Picker identity (Stage 3)

Registering the dialect puts the machine in the machine picker — which is where
someone who has never used any of these computers chooses one. Four fields on
the `Dialect` in `src/dialects/<id>/index.ts` are written for that reader rather
than for a spec sheet, and none of them may be written from memory:

| Field          | Content                                                                                                                                                              | Derived from                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `name`         | The short familiar name (`C64`, `CPC 464`, `Spectrum 128`), not the full marketing name. It sits under the manufacturer's heading, so don't repeat the maker in it.  | the shipped dialects' `name` values, for house style                                          |
| `manufacturer` | The short familiar form (`Acorn`, `Amstrad`, `Commodore`, `Sinclair`, `Tandy`). It is the grouping heading, so it must match its sibling machines' spelling exactly. | existing `manufacturer` values in `src/dialects/*/index.ts` — a new spelling splits the group |
| `year`         | The machine's release year.                                                                                                                                          | a primary source, verified (`registry.test.ts` bounds it to 1975–1995)                        |
| `blurb`        | Two short sentences: one distinguishing fact about the machine, then the BASIC it runs — `Sinclair's first home computer. Runs ZX80 BASIC.`                          | BASIC name from `docs/reference/<page>.md`; machine fact verified against a primary source    |

The blurb has a hard budget: **aim for 60 characters, never exceed 72**
(`registry.test.ts` fails above it). The picker clamps each row's description to
two lines, so a longer blurb is simply cut off mid-sentence on a phone. When
both sentences will not fit, keep the BASIC and drop the machine fact — the
dialect is what the user is actually choosing. Hardware specifics (screen modes,
colour counts, sound channels) belong on the reference pages, not here; a blurb
that reads like a spec list is the failure mode to avoid.

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
- **Leave the picker identity to Stage 3.** The stub's `index.ts` may hold
  placeholder `name`/`manufacturer`/`year`/`blurb` values to satisfy the type;
  they are written for real when the dialect is registered, to the rules in
  _Picker identity_ above.

After scaffolding, confirm `npm run typecheck`, `npm test`, `npm run lint` and
`npm run format:check` still pass and that `git status` shows changes confined
to `src/dialects/<id>/`, `docs/contributing/dialect-plans/<id>.md`, and the
cross-link in `docs/contributing/dialect-roadmap.md` — `registry.ts` and
`src/player/routes.ts` untouched (those change together in the wire-up stage).

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
- **Graphics characters need font coverage** — the IDE bundles small
  `unicode-range`-gated subsets, so a dialect that starts emitting a character
  no bundled face carries fails `src/dialects/fontCoverage.test.ts` rather than
  silently rendering a missing-glyph box. Re-cut the subsets per
  `src/assets/fonts/ATTRIBUTION.md` (which also lists what must be updated
  alongside them: `coverage.json`, and the `@font-face` in **both**
  `src/styles.css` and `docs/.vitepress/theme/custom.css`).

## Key files to study

| File                                                                                                                            | What it shows                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `src/dialects/types.ts`                                                                                                         | Every interface a complete dialect implements |
| `src/dialects/zx81/index.ts`                                                                                                    | How a `Dialect` is assembled (in-tree Z80)    |
| `src/dialects/commodore64/index.ts`                                                                                             | A `Dialect` over a wrapped 6502 emulator      |
| `src/dialects/bbcmaster/`                                                                                                       | Delegation over a sibling (imports bbcmicro)  |
| `src/player/routes.ts`                                                                                                          | `SHARE_VERBS` — bijection with the registry   |
| `src/dialects/registry.ts`                                                                                                      | Where registration happens (Stage 3)          |
| `src/dialects/zx81/emulator/`                                                                                                   | `MachineEmulator` over the shared Z80 core    |
| `src/keyboard/layoutSchema.ts`                                                                                                  | All keyboard-layout types                     |
| `docs/contributing/dialect-roadmap.md`                                                                                          | Tiered roadmap + status legend to cross-link  |
| `docs/contributing/adding-a-dialect.md` (dialect folder + virtual keyboard), `docs/reference/{file-formats,serial-protocol}.md` | Per-component reference detail for the stages |

## Guardrails

- **Plan & scaffold only — never implement a stage or register the dialect.**
- **Don't touch** `src/emulator/z80/` (vendored Z80 core) or third-party ROMs
  under `public/roms/` — fix bus bugs in your dialect's emulator, not the core.
- Outside `src/dialects/<id>/`, only the enumerated per-dialect tables change:
  (later) the registry + `SHARE_VERBS`, `constructsByDialect`, the
  `variableLint` wrapper, an optional `vk-theme-<id>` block in
  `src/keyboard/VirtualKeyboard.css`, the ROM + `ATTRIBUTION.md`, the docs
  pages/sidebar/roadmap — plus, for wrapped cores, a new
  `src/emulator/<machine>/` adapter folder. Anything else means the seam is
  being bypassed.
