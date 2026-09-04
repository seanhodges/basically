# CLAUDE.md

## What this is

**Basically** is a browser-based IDE for retro BASIC dialects and supporting
multiple machines (Sinclair, Acorn/BBC, Commodore, Tandy…) — from the 1960s
mainframe BASIC was born on to the 8-bit micros that carried it, so "microcomputer"
is no longer the boundary. Don't assume a count or list;
check `src/dialects/registry.ts` (`getDialect`/the registered dialects) for what's
actually available. Each dialect has an in-browser CPU emulator, per-dialect
hardware import/export (cassette audio, native binary downloads, serial device, etc),
and an optional Claude-powered code assistant.

**Stack:** TypeScript (strict), React 18, Vite 6, Vitest 3, CodeMirror 6, Zustand 5.

**Key mental model:** the app talks only to the `Dialect` interface
(`src/dialects/types.ts`) and the `MachineEmulator` it returns — never to a
machine's specifics directly. Above that, the command line and the AI
assistant are two callers of one operation layer (`src/ops/`): an operation is
declared once and both surfaces derive from it, and an operation one caller
deliberately lacks is a declared exemption with a reason, not an omission. Each dialect lives in `src/dialects/<name>/`. The
Sinclair-shaped dialects keep their machine under `src/dialects/<name>/emulator/`;
every other machine, in-tree bus or adapter, lives under `src/emulator/<machine>/`
(e.g. the CPC bus in `src/emulator/cpc/`, the BBC's jsbeeb adapter in
`src/emulator/bbc/`, the C64's viciious in `src/emulator/c64/`). The `Dialect`
seam is what stays uniform and makes new dialects pluggable.

## Spec-driven changes (OpenSpec)

New features and behaviour changes go through
[OpenSpec](https://github.com/Fission-AI/OpenSpec) (a pinned devDependency;
invoke as `npx openspec …`): `/opsx:explore` to think a change through,
`/opsx:propose` to create the change folder with proposal/design/spec-delta/
tasks artifacts, `/opsx:apply` to implement, `/opsx:archive` to merge the
spec deltas into the baseline once shipped.

- Baseline capability specs (what the product guarantees, behaviourally) live
  in `openspec/specs/<capability>/spec.md`; in-flight changes in
  `openspec/changes/`. Validate with `npx openspec validate --specs`.
- Project conventions the artifacts must respect are in
  `openspec/config.yaml` (`context:` and per-artifact `rules:`).
- Specs say **what**; `docs/contributing/architecture.md` says **how**. Write
  spec deltas only for behaviour changes — refactors get none.
- **Exception:** planning a whole new target system stays with the
  `adding-a-target-system` skill and `docs/contributing/dialect-plans/`;
  OpenSpec covers everything else.
- `openspec/` and the generated `.claude/commands/opsx/` +
  `.claude/skills/openspec-*/` files are Prettier-ignored; never hand-edit
  the generated files (`npx openspec update` regenerates them).

## Commands

```bash
npm install            # install dependencies
npm run dev            # Vite dev server serving IDE at http://localhost:5173
npm run docs:dev       # Vite dev server serving docs at http://localhost:5173/docs/

npm test               # run all unit tests once (vitest run) — CI does this; rarely needed locally
npm run test:watch     # vitest in watch mode
npx vitest run src/dialects/zx81/tokenizer.test.ts   # run a single test file
npx vitest run src/dialects/zx81/                    # run one folder's tests

npm run e2e            # Playwright end-to-end / visual tests, full browser matrix (specs in e2e/)
npm run e2e:chromium -- e2e/<capability>   # e2e for one capability, Chromium only (agent default)
npm run e2e:headed     # same as e2e, with a visible browser
npm run e2e:report     # open the last Playwright HTML report

# The toolchain outside the browser: describe a machine, check a listing, build
# one into a file the machine loads, or run one and report its screen. Builds
# its bundle when stale. `--help` names every operation, `<operation> --help`
# its options. Only `run` needs a ROM. `-m` is optional for `lint`/`build` when
# the program declares its own machine with a `#MACHINE <machine>` line; naming
# one anyway overrides the declaration.
./scripts/basically machines                       # every machine, and whether its ROM is here
./scripts/basically info commodore64               # memory, BASIC rules, keywords, formats (--json for all of it)
./scripts/basically lint prog.bas -m zx81          # problems on stdout, no emulator; exit 2 if any is fatal
./scripts/basically build prog.bas -m zx81 -o /tmp/prog.p
printf '10 PRINT "HI"\n' | ./scripts/basically run -m commodore64
./scripts/basically run prog.bas -m bbcmicro --screenshot /tmp/bbc.png --screen-text
# --keys drives the run: get past a prompt and see what the program then does.
# Needs the machine's ROM, and key names mean the same on every machine
# (`info` lists the ones a machine has).
./scripts/basically run prog.bas -m zx81 --keys 'WAIT FOR "NAME?"; PRESS A; PRESS ENTER; WAIT END'
# --profile, --time and --variables report the run's measurements, its timing
# and its variables, on the same terms the IDE and the assistant read them.
./scripts/basically run prog.bas -m zx81 --profile --time --variables
./scripts/basically lsp --stdio                    # a language server for any editor that speaks LSP; no ROM
scripts\basically.cmd machines                     # the same tool from cmd.exe or PowerShell

npm run typecheck      # fast type check (tsc -b, no bundle)
npm run lint           # ESLint
npm run lint:fix       # ESLint with autofix
npm run format         # Prettier write
npm run format:check   # Prettier check (used in CI)

npm run build          # tsc -b && vite build → dist/
```

**Before finishing a change**, run `npm run typecheck`, `npm run lint`, and
`npm run format:check` (or `npm run format` to auto-fix), plus the unit tests
covering what you touched — the colocated `*.test.ts` files and the
registry-driven suites that assert facts about every dialect. Pass paths to
vitest to scope the run (`npx vitest run src/dialects/zx81/`); the whole
`npm test` suite is CI's job, not a local gate. GitHub runs the full sharded
unit suite on every push and PR, so a green targeted run plus CI is the
verification — re-running everything locally only duplicates it. Run the full
suite locally only when a change is genuinely cross-cutting (the `Dialect`
seam, the store, shared editor/emulator plumbing) and you can't name which
tests it reaches.

For tokenizer / emulator / charset changes, add or update the colocated
`*.test.ts` rather than only checking by hand. For app-visible changes, also
run the e2e folder(s) for the affected capabilities, Chromium-only:
`npm run e2e:chromium -- e2e/<capability>`. The full `npm run e2e` matrix is
for humans and releases — managed agent environments only have Chromium
installed, so never run the bare full matrix there.

The `e2e/` layout mirrors `openspec/specs/`: one folder per capability, plus
`e2e/shell/` for cross-cutting UI specs no capability owns. Shared helpers
live flat at the `e2e/` root (`fixtures.ts`, `helpers.ts`, `shareStub.ts`).
New user-visible scenarios belong in the matching capability folder; a unit
test (`src/e2eCapabilityLayout.test.ts`) guards the folder↔capability
mapping.

## Writing efficient tests

e2e runs on one runner, one worker, Chromium, under a 30-minute cap, and it is
a blocking gate. It is no longer the scarce resource it was: the suite serves
the built artifact rather than a dev server, which took it from around twelve
minutes to around three, and a test that cost four seconds now costs one. The
rules below are still the rules - a browser is the most expensive way to learn
anything, and the reasons to prefer a unit test were never only about minutes -
but "it is too slow" is no longer the argument. Before adding an e2e test, ask
what only a real browser can prove; everything else belongs in a colocated
`*.test.ts`.

- **e2e is for browser-only behaviour** — canvas actually painting,
  pointer/touch capture, clipboard and file-picker fallbacks, real
  `history.back()`, viewport/orientation changes, the docs-iframe
  postMessage join, WebSerial gating, `decodeAudioData`, font loading.
  Logic, data tables, classification, storage rules and registry facts go in
  Vitest next to the source — headless emulator tests that boot the real
  ROMs and read the screen back are the norm here, not the exception.
- **One representative per browser flow; registry-driven Vitest for the
  matrix.** Never loop all machines in a spec. Boot one machine and pin the
  per-machine matrix in a registry-driven unit test — `e2e/paletteMachines.ts` +
  `src/dialects/graphicsPalette.test.ts` for a fact about the dialects,
  `e2e/program-execution/emulator-boot.spec.ts` +
  `src/dialects/screenPaints.test.ts` for one about the running machines. That
  second pair is why the wiring families no longer need a boot each: a machine's
  own picture is reachable headlessly through `src/dialects/headless/`, so the
  browser is left proving only what the app adds around it.
- **Reuse expensive setup within a file.** If several tests share a booted
  machine, an opened drawer, or a saved project, merge them into one journey
  test with staged assertions rather than repeating the setup per test.
- **No `page.waitForTimeout`.** Poll for the observable condition with
  `expect.poll` / web-first assertions (autosave: poll the storage key,
  don't sleep out the 2 s interval). A fixed sleep needs a comment
  explaining why nothing pollable exists.
- **No `test.setTimeout` above 30 s without a one-line justification**, and
  never above 90 s except the cassette WAV round trip (120 s). A long budget
  usually means the test boots a machine it doesn't need.
- **A new e2e test must pay rent**: if it will take >15 s, say in a comment
  what browser-only fact it proves that a unit test cannot. Prefer extending
  an existing journey in the same capability folder over a new cold
  `page.goto('/')`.
- **No unasserted `page.screenshot()`** — failure screenshots and traces are
  captured automatically by the Playwright config.
- **Don't launch browsers by hand.** For touch/mobile contexts use
  `test.use({ viewport, hasTouch, isMobile })` (skipping non-Chromium), not
  `chromium.launch()`.
- Every capability keeps at least one browser smoke test even when most of
  its coverage is unit-level, and specs stay in `e2e/<capability>/` or
  `e2e/shell/` (`src/e2eCapabilityLayout.test.ts` enforces this).

These rules come from a suite-wide streamlining pass (2026), which took the
Chromium run from 207 tests to 138 and halved the summed test duration a
one-worker runner pays. The existing specs are the worked examples: read the
capability folder you are adding to before adding to it.

### The Vitest side

The unit suite has its own budget, and it is shaped nothing like the e2e one.
Cost is extremely concentrated: the top twenty files are ~72% of the runtime and
the remaining four hundred are under 2%. So a new cheap test is genuinely free,
and the rules are about the few files that are not.

- **Boots are cheap; frames are the cost.** Booting a machine is ~30-80ms - a
  battery doing three boots for each of nineteen dialects lands under three
  seconds. What costs is frames, and unevenly: a C64 or Atari frame is several
  times a ZX81 one. Sharing a booted machine between tests buys almost nothing
  and couples them; running fewer frames is the whole game.
- **Frame budgets are named constants with a comment saying why that number.**
  `SETTLE_FRAMES`, `MAX_FRAMES` and friends. A cap on a `runUntil` predicate
  costs nothing when the predicate trips early; a fixed `runFrames(n)` pays
  every frame, so reach for the predicate.
- **Never call `runFrames(machine, 1)` in a loop.** `runUntil` yields the
  macrotask every twenty frames so the ROM loads that settle on timers can land,
  and asking for one frame at a time yields on every frame instead - Node clamps
  `setTimeout(fn, 0)` to ~1.1ms, so the sleeping costs more than the emulation.
  Pass the loop body to `runUntil`'s `onFrame` instead.
- **One `it` per behaviour, not per row.** A table of N rows is one test that
  loops and names the offending row in the assertion message - never
  `describe.each` over the rows with the assertions inside. Two crosschecks here
  declared 1170 tests, 12% of the whole suite, from 327 lines and half a second
  of work; a reader scrolling 819 identically-named cases learns less than one
  failure naming its cell. `it.each` over _machines_ is fine and often right:
  the point is not to multiply a test by data it already names.
- **A fact true of every registered machine gets one registry-driven test.**
  Before adding `src/dialects/<new>/foo.test.ts`, check whether
  `src/dialects/foo.test.ts` already asserts it for every dialect. If the same
  file exists for three or more dialects, it should have been a table -
  `cassetteRoundTrip.test.ts` and `graphicsPalette.test.ts` are the pattern.
- **Shared titles are not proof of duplication.** Per-dialect files often share
  every test name while asserting genuinely different facts - the memory-map
  suites all say "names every region" about entirely different machines. Merge
  on what the assertions do, not on what they are called. Where the _tests_
  differ but their scaffolding does not, extract the helper and leave the tests
  alone, as `dialects/audio/tapeSignal.ts` does.
- **The suite is sharded three ways in CI**, so a new file lands in whichever
  shard its path hashes to. Nothing to do about that except keep the slow files
  few: the slowest single file is a floor the whole gate waits on.

## Architecture

| Path                           | Role                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/dialects/types.ts`        | The `Dialect` / `MachineEmulator` contracts — the app's only seam                                                                         |
| `src/dialects/registry.ts`     | Registers available dialects (`getDialect(id)`)                                                                                           |
| `src/dialects/<name>/`         | One folder per dialect (tokenizer, charset, keywords, samples, `aiProfile`, `targets`); the Z80 dialects also hold their `emulator/` here |
| `src/emulator/`                | Emulator cores used by the supported dialects/machines.                                                                                   |
| `src/editor/`                  | Generic CodeMirror builders: BASIC language, completions, lint, line numbering                                                            |
| `src/app/`                     | Zustand store (`store.ts`) and app-level hooks/utilities                                                                                  |
| `src/ops/`                     | One declaration per operation; the command line and the assistant both derive from it, and `parity.test.ts` holds them to it              |
| `src/components/`              | React UI: `Workspace`, `EmulatorPane`, `AiPanel`, `Toolbar`, status bar                                                                   |
| `src/ai/`                      | Anthropic SDK client, prompt builder, AI code extractor/merge                                                                             |
| `src/transfer/`                | Hardware export: WAV cassette, `.P`, WebSerial protocol                                                                                   |
| `src/player/`                  | Standalone player: URL/verb routing (`routes.ts`) + emulator-only shell (`PlayerApp.tsx`) for short share links                           |
| `src/share/`                   | Share-link API client (`shareClient.ts`) + syntactic dialect-compatibility check (`compatibility.ts`)                                     |
| `src/storage/`                 | localStorage settings + autosave                                                                                                          |
| `src/dialects/<name>/samples/` | Bundled sample `.bas` programs for that dialect (registered in its `samples.ts`)                                                          |

**Run-a-program data flow** (the build step is dialect-specific —
`buildPFile`/`.P`, `.O`, `.TAP`, raw BBC bytes, `.prg` — but the shape is the
same for every dialect):

Example for ZX81:

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

## Documenting architecture changes

`docs/contributing/architecture.md` is the map of **how** the code is put
together; `openspec/specs/` say **what** it guarantees. Keep the map current in
the same change that moves the code, and keep it in the shape that survives:

- **Update it when the shape changes**, not for every edit: a new `Dialect` or
  `MachineEmulator` member, a new store request counter, a new storage key or
  lifetime rule, a new top-level `src/` folder, a new obligation test under
  `src/dialects/`, or a new vendored-core caveat. Find the section by the
  folder or symbol it names and change that row, table or diagram.
- **Tables for member lists, one diagram per flow, short prose for rules.**
  A new capability is a new row, not a new paragraph. Every mermaid diagram
  should show a mechanism the text cannot say in a sentence.
- **Write nothing that drifts on its own.** No machine lists or counts (say
  "every registered machine"; name one machine only as an example of a
  pattern), no line counts, no library version numbers beyond the stack line,
  no constant values. Name a symbol only after grepping that it exists.
- **Lifecycle claims come from the module contract**, not memory: what clears
  the virtual filesystem is the header comment in `src/storage/vfs/vfsStore.ts`,
  what autosave keeps is `persistAutosave` in the store. Quote the rule, then
  point at the test that pins it, rather than restating either.
- **Point at the registry-driven test** that holds every machine to a fact
  (`src/dialects/*.test.ts`) instead of listing which machines satisfy it and
  which are excused; the test's own table is the source of truth.
- **Figures are regenerated, never hand-edited.** The annotated IDE screenshot
  comes from `e2e/capture-docs-screenshots.spec.ts`
  (`npm run e2e:docs-screenshots -- -g "architecture"`); re-run it when the
  shell layout changes.
- Keep the `#vendored-core-caveats` heading: the dialect roadmap links to it.
- `npm run docs:build` is part of the gate for any change under `docs/`.

**Diagrams and tables have to survive a phone**, and both fail silently - a
diagram scaled to 3px text and a table dragged sideways still "render". Measure
rather than eyeball: build the docs, serve `dist/`, and read the numbers out of
a real browser at 390px and at 1440px.

- **A mermaid diagram is drawn once at an intrinsic width and then scaled to
  its column**, and its label text scales with it. Keep that width under about
  1100px, which is roughly 16px labels in a desktop article and 8px on a phone.
  Prefer `flowchart TB` over `LR`: a page already scrolls down, and left-to-right
  is drawn as wide as the pipeline is long. Where the enumeration matters more
  than the picture, cut the diagram down and let the table beside it carry the
  detail.
- **Sequence diagrams are the exception** - their width comes from the
  participant count, and six is already ~1400px. That is what the enlarge-on-tap
  viewer (`theme/components/Mermaid.vue`) exists for; do not mangle a sequence
  diagram to fit.
- **Keep each `<br/>` line in a node label short.** Mermaid sizes the node from
  its own measurement; a line that then wraps is clipped by the box.
- **Two-column tables fit a phone and three-column ones do not.** Where a
  column is thin - a folder path, a test filename - fold it under the first
  column with `<br>` rather than spending a column on it.
- **Never break a code identifier to make a table fit.** `src/com|ponents|/`
  costs the reader more than the sideways drag does, so the CSS keeps tokens
  whole and lets the table scroll inside itself; the page itself must never
  scroll sideways at any width.
- **A new surface inside the docs must claim Escape in the capture phase.** The
  drawer's own handler (`theme/Layout.vue`) closes the drawer and stands down
  only for a keypress something else has already marked handled.

## Adding a dialect

How to plan a machine with the skill, run its stages and submit them:
**`docs/contributing/adding-a-dialect.md`**; see also `docs/contributing/dialect-roadmap.md`,
`docs/reference/file-formats.md` (`.bas` / `.P` / `.O` / `.TAP` / `.BBC` / `.prg` /
cassette audio), and `docs/reference/serial-protocol.md` (the WebSerial bridge).

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
- **Comments** — say what the code does and why, in the present tense.
  Multi-line prose is for facts the code cannot express: chip port maps, tape
  encodings, ROM layouts, cross-module invariants, and traps ("not implied by
  X"). Everything else gets one line. Never name a planning artifact — a
  `docs/contributing/dialect-plans/` stage, an OpenSpec change, "Stage 3", "the
  plan expected"; those are deleted once the work ships, and half of them
  describe work that never shipped. `eslint-rules/no-plan-references.js` fails
  the build on them. Don't narrate a refactor either ("this used to live in X",
  "nothing below this point changed") — git records that. Past tense earns its
  place only where it explains why a test or guard exists ("the renderer used to
  draw a fixed 24 rows"). Don't hardcode a machine or dialect count; say "every
  registered machine". Best exemplar: `src/emulator/cpc/ppi.ts`.
- **UI labels** — a control's `title` and `aria-label` say what activating it
  does, as a short imperative phrase in sentence case with no trailing period:
  "Open documentation", not "Documentation". An icon-only control carries both,
  and where it has a shortcut the chord goes in `title` only, read from the
  shortcut map rather than typed out. Anything longer than a phrase belongs in
  the documentation the control can open.
  `eslint-rules/no-vague-ui-labels.js` fails the build on what it can check
  mechanically; the rest is a review job. The virtual keyboard is exempt — a
  keycap's label is specced behaviour, not copy.
- **Docs** — everything under `docs/` publishes to the public VitePress site.
  Pages in `docs/guide/` and `docs/reference/` are for end-users: don't reference
  unpublished internal files there (source paths like `src/…`, `CLAUDE.md`, plan
  files, `.claude/` skills) or internal API symbols — describe what the IDE does,
  and cross-link other docs with relative links (`./page`). `docs/contributing/`
  is the developer exception, where references to project files are fine.
- **Docs sidebar** — never add, remove, or reorder entries in the `sidebar`
  config in `docs/.vitepress/config.ts` unless the user explicitly asks for it.
  Adding a new docs page does **not** imply adding it to the sidebar: ask first,
  and leave the sidebar untouched until the user says yes.

## Don't touch

- `src/emulator/z80/` — vendored Z80 core (MIT, Molly Howell). Don't rewrite it;
  fix bugs upstream-style or in the relevant machine adapter/bus instead.
- `src/emulator/6502/cpu6502.js` — vendored build output; don't hand-edit.
- `src/emulator/c64/viciious/` — vendored viciious C64 core (public domain).
- The **jsbeeb** npm package — wrap it in `src/emulator/bbc/`, don't fork it.
- `public/roms/**` — third-party ROMs (see `public/roms/ATTRIBUTION.md` for
  origins and licensing). Don't modify or relicense.
