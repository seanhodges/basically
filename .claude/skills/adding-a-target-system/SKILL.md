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
  sound), the memory-activity hooks, the profile seam (`setProfileRecording` /
  `drainProfile`, accumulated in the shared `LineCostRecorder`), and the
  debugger hooks (`currentLine` / `debugStep`). `romUrl` is optional — an
  interpreter dialect ships no ROM.
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
| `src/keyboard/templateRows.ts`                                          | the template's geometry: `GRID_COLUMNS`/`KEY_SPAN`, `centerRow`, `bottomRow`                          |
| `src/dialects/semigraphicsAudit.ts`                                     | declare the machine's graphics byte range in `SEMIGRAPHIC_CODES`; join `IN_SCOPE` once it round-trips |
| `src/keyboard/{VirtualKeyboard,inputEngine}.tsx/.ts`                    | data-driven keyboard (no changes needed)                                                              |
| `src/dialects/sinclairTape.ts`, `sinclairCharset.ts`, `sinclairVars.ts` | shared Sinclair codecs                                                                                |
| `src/dialects/{sinclairReports,sinclairImportReport,importBlocks}.ts`   | shared report decoding / import-to-blocks helpers                                                     |
| `src/transfer/{wav,audioRecorder}.ts`                                   | WAV encode / mic record                                                                               |
| `src/emulator/z80/`, `src/emulator/6502/`                               | vendored CPU cores — **use, never edit**                                                              |
| `src/emulator/commodore/`                                               | shared Commodore chip helpers (VIA/PIA, char renderer)                                                |

And know the small per-dialect tables **outside** the folder that a new dialect
**must** edit — the plan's stages have to include them:

| File                                                                                                                                        | Required edit                                                                                                                                                                                                        | Stage                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `src/dialects/registry.ts`                                                                                                                  | import + `dialects` array entry (array order = UI menu order)                                                                                                                                                        | registration (the last stage)  |
| `src/player/routes.ts`                                                                                                                      | a `SHARE_VERBS` entry — the verb must be a real keyword of this machine's BASIC, unique in the table. `routes.test.ts` asserts a strict **bijection** with the registry: registering without a verb fails `npm test` | registration (same change)     |
| `src/editor/constructs.ts`                                                                                                                  | `constructsByDialect.<id>` template list (siblings may reuse another id's array); the dialect's `language.ts` reads it for block autocomplete                                                                        | language core                  |
| `src/editor/variableLint.ts`                                                                                                                | thin `<id>VariableErrors` wrapper over `singleLetterVariableErrors` or the Microsoft-family helper                                                                                                                   | language core                  |
| `src/keyboard/VirtualKeyboard.css`                                                                                                          | optional `vk-theme-<id>` block (**not** `src/styles.css`, which has no per-dialect content) — lands **with registration**, never before it                                                                           | registration (same change)     |
| `public/roms/…` + `public/roms/ATTRIBUTION.md`                                                                                              | ROM asset **and** its attribution block (skip for interpreter dialects)                                                                                                                                              | emulator core                  |
| `docs/reference/<id>.md`, `docs/reference/<id>/{hardware,escapes,formats}.md`, `src/reference/<id>.ts`, `docs/.vitepress/config.ts` sidebar | per-dialect reference docs — run the **`dialect-reference-docs`** skill (it owns the scaffold commands, page templates and crosscheck tests)                                                                         | docs — **before** registration |
| `docs/contributing/dialect-roadmap.md`                                                                                                      | status row + cross-link to the plan                                                                                                                                                                                  | when planning                  |

### What registration switches on

That table is the small half. The line in `registry.ts` is also the switch for
the **registry-driven batteries** — some seventy test files walk `dialects` and
hold every machine in it to the same standard — and they reach a long way past
the per-dialect tables above:

| Battery                                                                                                                                                       | What it demands of the new dialect                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dialects/memoryMap.test.ts`, `memoryMapDetail.test.ts`                                                                                                       | `memoryMap.ts` tiling the whole address space, and a program region starting where `memoryBlocks.programArea` says it does                                                                                                                                                                |
| `dialects/programRamBudget.test.ts`, `lineProfiling.test.ts`, `memoryActivity.test.ts`                                                                        | `readMemoryStats` and the memory-activity hooks — or the id in that battery's exception table, with a reason that is about the machine rather than about the work not being done yet                                                                                                      |
| `ai/machineObservability.test.ts`                                                                                                                             | `readVariables` / `readReport`, or the same kind of named exception                                                                                                                                                                                                                       |
| `reference/{keyword,facts,machines,porting}-crosscheck.test.ts`, `escapes/escape-crosscheck.test.ts`, `reference/pages.test.ts`, the two guidance crosschecks | the **whole reference bundle**: `src/reference/<page>.ts` and `escapes/<page>.ts` hand-enriched, entries in `pages.ts`, `machines.ts`, `facts.ts`, `porting.ts`, `domain-guidance.ts` and `escape-guidance.ts`                                                                            |
| `app/docsTopic.test.ts`, `app/docsNavigation.test.ts`, `reference/hardware-memory-map.test.ts`                                                                | the four docs pages, the sidebar entry, the index bullet and the CPU assembly page's machine lists                                                                                                                                                                                        |
| `keyboard/keyboardTheme.test.ts`                                                                                                                              | the `vk-theme-<id>` block in `src/keyboard/VirtualKeyboard.css`, or the theme named in that battery's `UNSTYLED_THEMES` with a reason. It also fails on a theme block **no registered layout names**, so the stylesheet cannot land ahead of the registry line — the two go in one change |
| `dialects/loopSpeed.test.ts`                                                                                                                                  | a **measured** `loopSpeed` in the porting facts — run the battery to get the figure, do not author one                                                                                                                                                                                    |
| `ai/machineReference.test.ts`, `promptStability.test.ts`                                                                                                      | the lazy reference loaders, and a measured prompt-size ceiling                                                                                                                                                                                                                            |

So **registration is the last act, not the middle one.** A plan that registers
in the wire-up stage is a plan whose next three stages start on a red build: the
Apple I's did, and the wire-up stage had to carry the memory map, the block
window, `readMemoryStats`, the activity hooks and the entire reference-docs set
before it could go green. Order the stages so everything above is already in
place, and let the last stage flip the switch.

Two consequences for the plan:

- **Stages 3 to 5 are verified headlessly**, because an unregistered dialect is
  not in the picker. Boot it on its real ROM through `src/dialects/bootHarness.ts`
  and assert on `readScreenText()` in the colocated tests — which is what the
  samples sub-skill already requires of every sample. `npm run dev` and the e2e
  specs belong to the registration stage's verify line, not to the earlier ones.
- **The sidebar needs the user's permission before that stage starts.**
  `CLAUDE.md` forbids adding an entry to `docs/.vitepress/config.ts` unless the
  user explicitly asks, and `docsNavigation.test.ts` fails without one. Say so in
  the docs stage of the plan so the question is asked ahead of the work rather
  than found in the middle of it.

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

Group work by dependency into medium, single-session stages, **ending with the
one that registers** — see _What registration switches on_ above for why nothing
else can come after it. Default breakdown (adapt to the audited gaps — drop any
stage already satisfied; for a **delegation** target, collapse stages 1/3/4 into
"import from the base dialect, own the memory map/blocks, AI profile, metadata
and emulator variant"):

| Stage                                      | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Depends on                                       | Verify                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **1 — Language core**                      | `keywords.ts`, `charset.ts`, `language.ts`, `tokenizer.ts` / `detokenizer.ts`, `lint` (+ `constructsByDialect.<id>` in `src/editor/constructs.ts`, `<id>VariableErrors` wrapper in `src/editor/variableLint.ts`), the image builder (`pfile.ts`/`tapfile.ts`/`.prg` equivalent) + colocated tests. The charset gives each block graphic its **exact** unicode character where one exists (Block Elements, then Symbols for Legacy Computing) and falls back to an escape only where injectivity or unicode forces it; declare the machine's graphics range in `SEMIGRAPHIC_CODES`, cited to a primary source, or leave it `null` rather than guessing. No registry change.                                                                                                                                                                                                                                                                                                                                                              | types contract                                   | `npm test` (tokenizer round-trip, charset, image-builder pointers) + `npm run typecheck` |
| **2 — Emulator core**                      | `emulator/` (machine + memory + display + keyboard matrix) implementing `MachineEmulator`, **or** the adapter folder under `src/emulator/<machine>/` when wrapping a package (note any new npm dep + license); ROM into `public/roms/` **plus an `ATTRIBUTION.md` block** — no ROM at all for interpreter dialects. The debugger hooks (`currentLine` / `debugStep`) and the profile charge belong here, not later — see the run-measurement rules below for why bolting them on afterwards is what goes wrong.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | charset (display), image builder (`loadProgram`) | emulator boot test: boot ROM, inject a program, assert on display memory                 |
| **3 — Wire-up: keyboard + samples**        | `keyboardLayout.ts` (tokens match emulator `setKey`; geometry from `templateRows` — see the keyboard-geometry rules below), `graphics.ts` (a `GraphicEntry[]` read by both the keyboard and the charset so they cannot drift — derive the keys from the ROM, and where the machine printed no graphics on its keycaps omit `key` so the cell is labelled by character code), the `palette: 'graphics'` editor mode + `graphicsPalette` on the layout, `samples.ts` + `samples/*.bas` (canonical set from the audit, degrade gracefully), **the machine-code block pipeline `kaleido.bas` needs** — `memoryBlocks.ts` and a `loadProgram` that writes the blocks it is handed, unless stage 2 already carried the second (see the samples note below) — finalize `aiProfile.ts`, `index.ts` assembling the whole `Dialect`. The layout **names** its `vk-theme-<id>`, but the stylesheet block waits for stage 7 (see the battery table above). **No registry change** — the machine is complete and driven headlessly, not yet offered. | stages 1–2                                       | typecheck + tests; every sample booted on the real ROM through `bootHarness`             |
| **4 — Transfer & tape I/O**                | `targets.ts` build targets, `audio` (`buildSamples` + `decodeSamples`, load/save instructions), `binaryImports`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | tokenizer/detokenizer, image builder             | audio round-trip test + import/export in the app                                         |
| **5 — Memory map & runtime introspection** | `memoryMap.ts` — and with it a re-check of the `memoryBlocks.ts` figures stage 3 wrote, which now have a map to agree with (`memoryMapDetail.test.ts` pins the program region to `memoryBlocks.programArea`) — `sysvars.ts`/`vars.ts`/`reports.ts` → `readVariables`/`readReport`, `readMemoryStats` (spanning **every** pool a program spends — see the run-measurement rules below) + memory-activity hooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | stages 2–3                                       | memory-map + blocks tests; watcher shows live vars                                       |
| **6 — Reference docs**                     | run the **`dialect-reference-docs`** sub-skill (scaffolds the table data, writes the parent + hardware/escapes/formats pages from its templates, wires the sidebar/index/assembly lists, extends the crosscheck tests), plus the `facts.ts` porting entry, the `porting.ts` groups and the two guidance tables. **Ask about the sidebar before starting** — see above. Everything here is registry-pinned, so it lands before the machine registers rather than after.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | stages 1–3                                       | `npm run docs:build` (dead links) + the reference crosschecks                            |
| **7 — Register & ship**                    | the picker identity fields (`name`, `manufacturer`, `year`, `blurb`) written to the rules below, **`registry.ts` + the `SHARE_VERBS` verb in `src/player/routes.ts` in the same change** (bijection test), the remaining per-dialect tables (`glyphSources`, `charsetProbes`, `keywordSpellings`, `loopSpeedProbes`, `operatorProbes`, `semigraphicsAudit`, `machineArtIds` + `machineArt`, `ai/machineReference`, `e2e/bootMachines`, and `e2e/paletteMachines` where the machine has a palette), the measured `loopSpeed` and prompt ceiling, the optional `vk-theme-<id>` block in `src/keyboard/VirtualKeyboard.css`, roadmap status row, and whatever polish the audit listed (joystick, emulator sound, dialect quirks, the AI-profile accuracy pass). Now selectable + runnable; the plan file is deleted here.                                                                                                                                                                                                                  | stages 1–6                                       | typecheck + full `npm test` + `npm run dev` smoke + `npm run e2e:chromium`               |

### Canonical samples (Stage 3)

> **Use the `authoring-dialect-samples` sub-skill to write the samples.** It
> covers the per-sample intent and accuracy gotchas (the Pitteway `E/2` circles
> recurrence and ring-closure count, solvable mazes, keyword-as-variable
> collisions), the `samples.ts` / machine-code-block registration shape, the
> mandatory step of running each sample on the new machine and fixing what the
> screen shows, and the colocated `samples.test.ts` checks each dialect must
> ship. Stage 3 is not done when the files tokenize; it is done when the samples
> have been seen to work. The summary below is just the Stage-3 placement.

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

**The kaleidoscope's block is a stage-3 dependency, not a stage-5 one.** On any
machine whose dialect does not hide machine code in a `#BIN` REM (the Sinclair
convention), `kaleido.bas` carries its routine as a memory block, and
`src/app/sampleBlocks.ts` refuses to assemble one for a dialect with no
`memoryBlocks` — so the sample cannot be loaded, let alone run, until the dialect
declares `MemoryBlocksSupport` **and** its `loadProgram` writes the blocks it is
handed. Plan both into the wire-up stage, not into the memory-map stage that
sounds like their home: what the sample asks of them is small — a `cpu`, a
`defaultAddress` in RAM that neither the ROM nor BASIC touches, and
`validRanges` wide enough to hold the routine there — and the memory-map stage
revisits the figures once there is a map to check them against. Dropping
`kaleido` is the other way out of the ordering, but it is a missing sample
rather than a deferral, so it needs the reason every dropped sample needs.

Only exclude a sample when it genuinely cannot be ported (e.g. the ZX80 drops
`breakout`); keep the rest in the same relative order. Compare `zx81/`,
`zxspectrum/`, `bbcmicro/`, `commodore64/` sample folders for the same set
expressed several ways. Never point a new dialect at another machine's `.bas`.

### Keyboard geometry (Stage 3)

A layout authors legends, tokens and modifiers. It never authors a size — a
PMD 85 keycap is the same size as a Spectrum's, and that only holds while every
machine takes its proportions from `src/keyboard/templateRows.ts`:

- `gridColumns: GRID_COLUMNS`, and every row's spans sum to it.
- Ordinary keys are `KEY_SPAN` wide, `ROW_KEYS` to a typing band. A band with
  fewer goes through `centerRow` rather than growing its keys to fill the width.
- The bottom row comes from the `bottomRow` factory, which centres the space bar
  and sizes it from what the flanking modifiers leave.
- Function keys are `KEY_SPAN` too. The strip is one row, and it divides its
  width by the key rows' own grid: a machine with three of them gets three
  keycaps centred over the board, and one with more than a board's worth scrolls
  the rest into reach — neither stretches nor shrinks its keys to the count it
  happens to have. Design for ten. Nothing enforces a ceiling, but the eleventh
  key onwards starts off-screen, so put only the keys nothing else can reach on
  the strip and leave the rest to the host keyboard.
- A strip key carries `style: 'fn'` and `editor: null` on its label. It presses
  the matrix and nothing else; without the explicit `null` a label falls back to
  inserting its own text, and a key marked `f1` types `f1` into the program.

A machine whose real keyboard is wider than the template keeps the template
anyway: move the symbols that no longer fit to the bottom row, and reach the
rest from the host keyboard through `emulator/keyboard.ts`. Widening the grid
for one machine is the failure mode.

`src/keyboard/layoutGeometry.test.ts` pins all of this against the registry, so
a new dialect is covered the moment it registers and needs no geometry test of
its own.

### Run measurement and the debug path (Stage 2)

**A debug slice is a frame.** `debugStep` is not a mode the user opts into: a
session is opened on any press of Play for every dialect that sets
`debuggable`, and simply never pauses when nothing is breakpointed. So on most
of the registry `debugStep` is how the machine is _usually_ run, and everything
`runFrame` does around its CPU work has to happen in a slice too — the
profiler's charge, any free-running cycle counter the tape deck or speaker reads
itself against, any frame counter a blink or flash attribute is driven off, any
per-frame flush a sound chip needs.

That is structural rather than remembered, and the structure is
`src/emulator/machineLoop.ts`: `createMachineLoop(contract)` owns the walk over
the frame's budget and hands back the `runFrame`/`debugStep` pair the machine
exposes as its own. Supply the contract - `cyclesPerFrame`, a `step()` (one
instruction on a machine that owns its CPU, one cycle on a core ticked a cycle
at a time, one profiler slice on a wrapped core), `currentLine()`, and the
`onSliceStart`/`onSliceEnd` hooks for anything owed once a slice however it ends

- rather than writing either path by hand.

Writing the run loop first and adding the stepper afterwards is the failure
mode, and it has produced three shipped bugs. The PMD 85's slice stepped the
CPU itself: it never reached the profile charge, so every run measured nothing
and the profiler report came up empty; it never advanced the cycle counter, so
the machine was silent and its tape stalled; and it never advanced the frame
counter, so blinking characters stopped blinking. The BBC's slice never caught
its sound chip up, and since the chip is otherwise only advanced when the OS
pokes a register, a held note came out as silence followed by a burst of its own
backlog. None of those looked like a debugger bug.

**A memory figure spans every pool a program spends.** `readMemoryStats` feeds
the memory chart and the profiler's per-line byte charge, not just the status
bar, so a figure covering only part of what a program allocates reads as a
program that allocates nothing — a measurement, not an absence, and nothing
downstream can tell the difference. BASIC-G keeps its string pool in a region of
its own away from the program area, and the PMD 85 counted only the program
area: string churn, which is most of what a BASIC program does with memory,
moved neither figure.

`src/dialects/lineProfiling.test.ts` and `src/dialects/debugEquivalence.test.ts`
pin both of these against the registry — the first that a machine charges a run
to the lines that ran, on both paths, the second that a window of slices
advances a machine exactly as a window of frames does — so a new dialect is
covered the moment it registers and needs no measurement test of its own.

### Picker identity (the registration stage)

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
  clean while the dialect is WIP; registration is the plan's **last** stage, for
  the reasons in _What registration switches on_ above.
- **Test stubs use `describe` + `it.todo(...)`** so `npm test` passes with the
  stubs present.
- **Do not fabricate a ROM.** Note the required `public/roms/<id>.rom` and its
  license/attribution in the plan's target summary instead.
- **Leave the picker identity to the registration stage.** The stub's
  `index.ts` may hold placeholder `name`/`manufacturer`/`year`/`blurb` values to
  satisfy the type; they are written for real when the dialect is registered, to
  the rules in _Picker identity_ above.

After scaffolding, confirm `npm run typecheck`, `npm test`, `npm run lint` and
`npm run format:check` still pass and that `git status` shows changes confined
to `src/dialects/<id>/`, `docs/contributing/dialect-plans/<id>.md`, and the
cross-link in `docs/contributing/dialect-roadmap.md` — `registry.ts` and
`src/player/routes.ts` untouched (those change together, in the final stage).

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
| `src/dialects/registry.ts`                                                                                                      | Where registration happens (the last stage)   |
| `src/dialects/zx81/emulator/`                                                                                                   | `MachineEmulator` over the shared Z80 core    |
| `src/keyboard/layoutSchema.ts`                                                                                                  | All keyboard-layout types                     |
| `docs/contributing/dialect-roadmap.md`                                                                                          | Tiered roadmap + status legend to cross-link  |
| `docs/contributing/adding-a-dialect.md` (dialect folder + virtual keyboard), `docs/reference/{file-formats,serial-protocol}.md` | Per-component reference detail for the stages |

## Guardrails

- **Plan & scaffold only — never implement a stage or register the dialect.**
- **Don't touch** `src/emulator/z80/` (vendored Z80 core) or third-party ROMs
  under `public/roms/` — fix bus bugs in your dialect's emulator, not the core.
- Outside `src/dialects/<id>/`, only the enumerated per-dialect tables change:
  (later) the registry + `SHARE_VERBS` and, in that same change, an
  optional `vk-theme-<id>` block in `src/keyboard/VirtualKeyboard.css`;
  `constructsByDialect`, the `variableLint` wrapper, the ROM +
  `ATTRIBUTION.md`, the docs
  pages/sidebar/roadmap — plus, for wrapped cores, a new
  `src/emulator/<machine>/` adapter folder. Anything else means the seam is
  being bypassed.
