# Adding a new BASIC dialect

A **target system** is one machine's worth of support: a BASIC dialect
(tokenizer, charset, keywords), an emulator, a virtual keyboard, transfer and
tape I/O, a memory map and memory blocks, an AI profile, samples and reference
docs. That is 30–40 files once tests are counted.

The app talks only to the `Dialect` interface in `src/dialects/types.ts` and
the `MachineEmulator` it returns. Everything machine-specific lives behind
that seam.

## The shapes a target takes

| Shape                              | Where it lives                                                                                             | Read first                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| In-tree bus over a vendored core   | `src/emulator/<machine>/`; the older Sinclair-shaped machines keep theirs in `src/dialects/<id>/emulator/` | `src/emulator/cpc/`, `src/dialects/zx81/emulator/` |
| Adapter over a third-party package | `src/emulator/<machine>/`, with a hand-written `.d.ts` for the surface used                                | `src/emulator/bbc/` (jsbeeb)                       |
| Delegation over a shipped sibling  | `src/dialects/<id>/`, importing the sibling's language files, samples and keyboard                         | `src/dialects/bbcmaster/`                          |
| In-tree interpreter                | `src/dialects/<id>/interpreter/`; no CPU core and no ROM                                                   | `src/dialects/trs80/interpreter/`                  |

Look for a shipped sibling first. Delegation is by far the cheapest shape:
`bbcmaster` owns four files and imports the rest from `bbcmicro`. The
[dialect roadmap](./dialect-roadmap) places each candidate machine by the
effort it will cost and names the core it would run on.

## Before you start

1. Open a GitHub issue describing the machine and the shape you expect.
2. Check the machine's row in the [dialect roadmap](./dialect-roadmap).
3. Settle the ROM's licence and attribution, or the package's licence, before
   writing code. An interpreter dialect needs neither.

## Plan and scaffold with the skill

Ask Claude Code to plan the machine as a target system. The
`adding-a-target-system` skill:

- audits the shipped dialects to derive the current feature baseline;
- writes a staged plan to `docs/contributing/dialect-plans/<id>.md`;
- adds a row to the dialect roadmap;
- scaffolds compiling stubs under `src/dialects/<id>/`.

The skill does not implement any stage and does not register the dialect.

Without Claude, the skill file and its `plan-template.md` under
`.claude/skills/adding-a-target-system/` serve as the checklist. Write the
plan by hand to the same template.

## Run the stages

Run one stage per session, in the plan's order. Each stage carries its own
verify line.

The dialect is registered in the last stage only. Registration switches on the
registry-driven test batteries, so everything they demand must already be in
place. Until then the machine is driven headlessly through
`src/dialects/bootHarness.ts`.

Decisions to settle before the relevant stage starts:

- **The docs sidebar.** The reference-docs stage needs an entry in
  `docs/.vitepress/config.ts`, which requires the maintainer's explicit
  approval.
- **The share verb.** A real keyword of the machine's BASIC, unique in
  `SHARE_VERBS` (`src/player/routes.ts`).
- **Sub-skills.** The samples stage uses `authoring-dialect-samples`; the
  reference-docs stage uses `dialect-reference-docs`.

## Checks

Per stage:

```bash
npm run typecheck
npm run lint
npm run format:check
npx vitest run src/dialects/<id>/
```

At registration, add the registry line and the share verb, run the full unit
suite, and work the failure list:

```bash
npm test
```

Each battery names what it wants. About half want a written reason for an
exception about this machine rather than data. Then regenerate the generated
pages and run the browser checks:

```bash
npm run gen:semigraphics
npm run gen:glyphs
npm run docs:build
npm run e2e:chromium -- e2e/project-setup e2e/program-execution e2e/porting-guidance
```

In the same change, move the machine's roadmap row to the Shipped table and
delete the plan file.

## Submitting

Raise one pull request per stage. The early stages are reviewable on their
own because the machine runs headlessly. See [Contributing](./contributing)
for the checks to run before opening a PR and how to raise one.

## Where the detail lives

- `.claude/skills/adding-a-target-system/SKILL.md` — the full stage rules.
- `src/dialects/types.ts` — the `Dialect` and `MachineEmulator` contracts.
- `src/keyboard/layoutSchema.ts` and `src/keyboard/templateRows.ts` —
  keyboard authoring, pinned by `src/keyboard/layoutGeometry.test.ts`.
- [Architecture](./architecture) — the layers and the vendored-core caveats.
- [File formats](../reference/file-formats) and
  [Serial protocol](../reference/serial-protocol) — transfer formats.
- [Semigraphics support](./semigraphics-support) and
  [Glyph sources](./glyph-sources) — charset coverage per machine.
