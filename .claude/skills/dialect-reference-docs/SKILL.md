---
name: dialect-reference-docs
description: >-
  Generate or update the per-dialect language reference docs for Basically —
  the searchable keyword table data, the parent reference page and its
  hardware/escape-codes/file-formats sub-pages, and the sidebar/index wiring —
  deriving every fact from the dialect source and pinning it with crosscheck
  tests. Use for the docs stage of a new target system (from the
  adding-a-target-system plan), when a new machine variant joins a shared page,
  after keyword/charset/memory-map changes, or for an accuracy audit of an
  existing dialect's reference pages.
---

# Generating dialect reference docs

One dialect's reference set is five artifacts plus wiring. Everything in it is
**derived from the dialect's source, never from memory of the machine** — the
crosscheck tests below make drift a test failure, not a doc-review problem.

Machines and docs pages are not 1:1: sibling dialects share a page via the
`docsReference` field on the `Dialect` (see `src/app/docsTopic.ts` — e.g.
`zxspectrum128` → `zxspectrum`, `vic20` → `commodore64`, `bbcmaster` → `bbc`).
`<page>` below means that shared page id; `<id>` means one dialect folder.

| Artifact                                            | Content                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/reference/<page>.ts`                           | `ReferenceTableData` — every keyword, hand-enriched syntax + descriptions                                                                                                                                                                                        |
| `src/reference/escapes/<page>.ts`                   | `EscapeTableData` — every escape spelling with byte probes                                                                                                                                                                                                       |
| `docs/reference/<page>.md`                          | Parent page: intro → Notes and caveats → `<ReferenceTable>` → footer                                                                                                                                                                                             |
| `docs/reference/<page>/hardware.md`                 | One H2 per machine × `### Screen modes/Colour/Graphics/Sound/Memory`                                                                                                                                                                                             |
| `docs/reference/<page>/escapes.md` and `formats.md` | `<EscapeTable>` page; native containers + closing `## Cassette audio`                                                                                                                                                                                            |
| Wiring                                              | Sidebar group in `docs/.vitepress/config.ts` (**Hardware above Escape codes**), bullet in `docs/reference/index.md`, machine added to the CPU's list in `docs/reference/{z80,6502}-assembly.md` (intro **and** "Where blocks live"), `docsReference` on siblings |

## Ground truth map

| Docs content                                   | Derived from                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Reference table rows (names, kinds, tags)      | `src/dialects/<id>/keywords.ts` via `npm run gen:reference`                               |
| Escape rows (spellings, bytes, coverage)       | the dialect charset via `npm run gen:escapes`                                             |
| Hardware → Memory (ranges, defaults, warnings) | `src/dialects/<id>/memoryBlocks.ts` + `memoryMap.ts`                                      |
| Hardware → Screen/Colour/Graphics/Sound        | the dialect's own keyword docs + emulator; state what the IDE implements                  |
| formats.md containers + cassette scheme        | `src/dialects/<id>/targets.ts` + `audio/`; cross-machine `docs/reference/file-formats.md` |
| Machine lists, page ownership                  | `src/dialects/registry.ts` + each dialect's `docsReference`                               |

When the real machine has a feature the dialect doesn't implement, **say so
explicitly** (see the Atom's `?`-operator note) — never claim it, never omit
the sub-heading. A machine without a feature gets one flat sentence ("The ZX81
has no sound hardware.").

## Workflow A — new dialect (or new shared-page set)

1. **Scaffold the data.** Add a `sets` entry to
   `scripts/gen-reference-scaffold.mts` importing the dialect's keyword table
   (and a `SOURCES` entry to `scripts/gen-escape-scaffold.mts` for its
   charset), then run `npm run gen:reference` / `npm run gen:escapes`. The
   generators **skip files that already exist** — they never overwrite
   enrichment.
2. **Enrich by hand.** Rewrite each row's `syntax` into the typed `<…>` style
   and each `description` into 1–3 sentences in the docs voice (see any mature
   set, e.g. `src/reference/zx81.ts`). `tag` marks machine/version
   availability only ("128K only", "BASIC 1.1 only") — semantic notes belong in
   the description. Escape rows additionally need `category`, an
   `example: {source, bytes}` probe, and `codes` claims — the crosscheck suite
   rejects anything the charset doesn't actually produce.
3. **Write the four pages** from the bundled templates (read them before
   writing): [templates/reference-page.md](templates/reference-page.md),
   [templates/hardware-page.md](templates/hardware-page.md),
   [templates/escapes-page.md](templates/escapes-page.md),
   [templates/formats-page.md](templates/formats-page.md).
4. **Wire the navigation.** Sidebar group (Hardware · Escape codes · File
   formats, in that order; a sibling with no sub-pages of its own links the
   shared ones — see the PET group), index bullet in registry order, the CPU's
   assembly-page machine lists, `docsReference` on any sibling dialect.
   **Ask the user before adding the sidebar entry.** `CLAUDE.md` forbids
   adding, removing or reordering entries in `docs/.vitepress/config.ts`
   without an explicit request, and a page absent from the sidebar fails
   `src/app/docsNavigation.test.ts` — so the permission is needed, and asking
   for it at the start of the work beats discovering it at the end.
5. **Extend the crosscheck layer.** Add the new set to
   `src/reference/reference-data.test.ts`,
   `src/reference/keyword-crosscheck.test.ts` and
   `src/reference/escapes/escape-crosscheck.test.ts` (imports + a
   per-dialect probe block for the escapes).

## Workflow B — update or audit an existing dialect

1. Run `npx vitest run src/reference` — the crosscheck suites surface
   drift mechanically: a keyword without a reference row, an invented row, an
   escape byte no row claims, a probe that no longer tokenizes.
2. Diff the hardware page's Memory section against `memoryBlocks.ts` /
   `memoryMap.ts` (ranges, default address, warned regions), and the
   Screen/Colour/Graphics/Sound sections against the keyword docs.
3. Reconcile facts first; only then touch wording. Never rewrite another
   dialect's prose while updating one — uniformity changes are their own task
   across all pages at once.

## Conventions

- **Layout is fixed.** The templates are the layout; do not invent sections.
  Every hardware page nests the five H3s under a machine H2 even for a
  single-machine dialect; shared-page siblings get delta sections that refer to
  the first machine for what's identical.
- **Tone**: en-GB spelling, sentence-case headings, short declarative prose,
  relative `./page` links. Match the neighbouring pages sentence-for-sentence
  where they share structure (intro line, cross-link footer, "no such
  hardware" statements).
- **End-user pages never reference internal files** — no `src/…` paths, no
  `CLAUDE.md`, no skill names (CLAUDE.md docs rule). Describe what the IDE
  does; the ground-truth map above is for you, not for the page.
- Formatting is Prettier's (`npm run format`); data files are plain TS objects
  in strict mode.

## Verification

Run before finishing:

- `npm test` — the crosscheck layer (`reference-data`, `keyword-crosscheck`,
  `escape-crosscheck`) plus `src/app/docsTopic.test.ts`, which asserts every
  registered dialect resolves (via `docsReference` or its id) to a real
  reference page. For a **new** machine these pages are only half of what its
  registration demands: `facts-crosscheck`, `machines-crosscheck`,
  `porting-crosscheck` and the two guidance crosschecks want entries in
  `facts.ts`, `machines.ts`, `porting.ts`, `domain-guidance.ts` and
  `escape-guidance.ts` as well, and `loopSpeed.test.ts` wants a **measured**
  loop speed in the porting facts. Budget for those in the same pass.
- `npm run typecheck` · `npm run lint` · `npm run format:check`
- `npm run docs:build` — VitePress fails on dead links; new pages, anchors and
  retargeted links all get checked here.

## Guardrails

- Never re-run a generator expecting it to refresh an enriched file — it
  skips existing files by design; edits are by hand.
- Never satisfy a failing crosscheck by weakening the test — fix the data or
  the page.
- Sidebar and index order mirror `src/dialects/registry.ts` (menu order).
