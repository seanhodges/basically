## Context

What the assistant is told about the machine it is writing for is one string per
dialect: `aiProfile.systemPrompt` in `src/dialects/<id>/aiProfile.ts`, 31–54
lines of hand-written prose, 525 lines across the thirteen registered machines.
`buildSystemPrompt` in `src/ai/promptBuilder.ts` concatenates it with two
machine-independent blocks — `RETURNING_CODE_RULES` and the composed
`buildExpectationRules(dialect)` — and that is the whole of it.

The prose names some of each machine's commands in a sentence or two. The ZX81's
lists sixteen functions where its keyword table holds far more; whatever is
omitted, the assistant fills in from memory, and for the less famous machines its
memory is of a more famous relative.

Meanwhile the project already holds the same knowledge in structured, tested
form, under `docs/reference/data/`:

- eight per-page BASIC reference tables (plus two per-CPU assembly ones), each row
  a keyword with its `kind`, `syntax`, `description`, capability `domain` and
  optional `onlyOn` machine scoping;
- `facts.ts` — `portingFacts`, one entry **per machine**, carrying the BASIC it
  runs, its line-number range, statement separator, `ELSE`/`LET` rules, variable
  naming, number handling, exponent operator, memory-write syntax, free RAM,
  screen/colour/sound;
- `domain-guidance.ts` — per (machine, capability) advice with a worked example,
  written for exactly the case where a machine lacks something another has;
- `machines.ts`, `porting.ts`, `escapes/`, and the crosscheck tests
  (`keyword-crosscheck`, `facts-crosscheck`, `machines-crosscheck`,
  `domain-guidance-crosscheck`, `porting-crosscheck`) that pin all of it to the
  real dialects, per machine, so a newly registered dialect or a renamed keyword
  fails the suite until the data agrees.

`docs/.vitepress/theme/dialectCompare.ts` is the diff logic built on that data.
Its own header describes it as pure, framework-free and node-testable, importing
only the docs data types and never `src/`.

The application cannot import any of it. Nothing technical stops it — the
dependency already runs docs → src (`machines-crosscheck.test.ts` imports the
registry; `DialectCompare.vue` renders the IDE's own machine picker from
`src/components/machinePicker.ts`) and never the reverse. The obstacle is purely
where the files sit: under `docs/`, which is a published VitePress site.

So the project maintains two accounts of every machine — a tested one the
application cannot reach, and an untested one it sends to the model — and the
untested one was written first, with the tested one derived from it.

See `docs/contributing/architecture.md` for how the app, the docs site and the
dialect seam fit together; this design does not restate it.

## Goals / Non-Goals

**Goals:**

- Put the reference data and the comparison logic somewhere both the application
  and the documentation site can import, without changing either's behaviour.
- Compose each request's machine description from that data: the machine's whole
  command set, its language rules and hardware figures, and what to do where it
  lacks a capability.
- Keep the composed description out of the main bundle — the assistant is
  optional and most sessions never open it.
- Keep the composed system prompt byte-identical between requests for the same
  machine, because prefix caching depends on it.
- Describe every machine to the same standard, so completeness stops varying with
  how much prose someone wrote.
- Leave the documentation site's rendered output unchanged, and prove it.
- Thin the per-machine prose to what data cannot carry, so there is one account of
  each machine rather than two.

**Non-Goals:**

- Correcting the reference data on the way past. It moves as it stands.
- Changing the `AiProfile` shape, the reply format, the apply actions, or how
  generated code reaches the editor.
- Carrying the escape/control-code tables in the composed block. They are a
  property of the charset, not of the language, and the spec delta does not claim
  them; each machine's prose keeps its own account of how escapes are written.
- Carrying pair-anchored porting notes or `PortingFacts.portingNotes`. Porting is
  `hand-the-port-report-to-the-assistant`.
- Reconciling `EditorKeyword`'s terse description with `ReferenceEntry`'s fuller
  one. Two descriptions per command survive this change; it consumes the fuller.
- Any change to the `Dialect` / `MachineEmulator` seam.

## Decisions

### 1. The shared home is `src/reference/`

`docs/reference/data/**` moves to `src/reference/**`, keeping its internal shape
(`escapes/` stays a subfolder), and `docs/.vitepress/theme/dialectCompare.ts`
moves to `src/reference/compare.ts` alongside its two test files
(`dialectCompare.test.ts`, `perMachineCompare.test.ts`).

Why `src/` rather than a new top-level `shared/`: it is the direction the
dependency already runs, so nothing inverts; `vitest.config` already collects
`src/**/*.test.ts`, so the crosscheck tests keep running where they land;
`tsconfig.app.json` already includes `src`, so the modules are typechecked
without a new project; and a third root would need adding to four configs, the
ESLint setup and Prettier's ignore list for no gain.

Alternatives considered: leaving the data in `docs/` and importing upward from
`src/` (inverts the dependency, and makes the application's assistant depend on
the published site's layout); duplicating a trimmed copy into `src/` (recreates
exactly the two-accounts problem this change exists to end); publishing the data
as a workspace package (build complexity with no second consumer).

### 2. `sortEntries` moves; the rest of `referenceTable.ts` stays

`compare.ts` needs `sortEntries` from `docs/.vitepress/theme/referenceTable.ts`.
That function is row ordering, not page state, so it moves into the shared tree.
`filterEntries` and `findEntryByName` serve the reference page's search box and
its `?name=` deep link — they stay in the docs theme, and `referenceTable.ts`
re-exports `sortEntries` from its new home so its existing consumers and
`referenceTable.test.ts` are unchanged.

### 3. Relative imports, no new path alias

The docs side already reaches into `src/` with plain relative paths
(`'../../../src/dialects/registry'`). The rewire follows suit:
`'../../reference/data/types'` becomes `'../../../src/reference/types'` and so
on. Adding an alias would need it declared in the Vite config, the VitePress
config, three tsconfigs and the ESLint resolver, to save a few `../`.

### 4. `tsconfig.docs.json` widens to keep the crosscheck tests typechecked

`tsconfig.app.json` excludes `src/**/*.test.ts`, and `tsconfig.docs.json`
includes `docs/**/*.ts` — which is what currently typechecks the crosscheck
tests. Move them into `src/` and they would fall out of both programs and stop
being checked at all. So `tsconfig.docs.json`'s `include` gains
`src/reference/**/*.ts`, and its comment gains a line saying why: this project is
now the one that checks the shared reference tree's tests, as it already reaches
into `src/` for the ambient declarations. Overlapping `include` between the two
projects is fine — both are `noEmit`, and they already overlap on
`src/**/*.d.ts`.

### 5. The application reaches the data through per-machine deferred imports

`src/ai/machineReference.ts` holds a `Record<string, () => Promise<…>>` keyed by
reference-page slug, each value a dynamic `import()` of one page's table — the
same shape `src/ai/aiClient.ts` already uses for the three provider backends.
Vite gives each page its own chunk, so a session pulls the tables for the
machines it actually talks about rather than all ten. `facts.ts`,
`domain-guidance.ts` and `machines.ts` are small and needed for every machine, so
they load together in one further chunk. Resolved blocks are memoised per dialect
id, so the second request for a machine costs nothing.

To stop that boundary eroding, an ESLint `no-restricted-imports` rule bans static
imports of `src/reference/**` from `src/` outside the reference tree itself and
`*.test.ts` files. Without it, one convenience import anywhere in the app quietly
puts twelve thousand lines of tables into the main bundle, and nothing would fail.

### 6. `buildSystemPrompt` stays pure; a new async loader wraps it

`buildSystemPrompt(dialect, machineReference)` remains synchronous and total,
composing its three existing blocks plus the new one — so it stays as testable as
it is now, from a fixture string. A new
`loadSystemPrompt(dialect): Promise<string>` performs the deferred import,
composes the machine block and calls it. The three call sites (`AiPanel.tsx`
twice, `DocsDrawer.tsx`, `NewProjectDialog.tsx`) already fire their `send()` with
`void`; their handlers become `async` and `await loadSystemPrompt(dialect)` in
place of the sync call.

Alternative considered: moving prompt composition into `aiStore.send` so callers
pass a `Dialect`. It removes the `await` from three call sites at the cost of
widening the store's contract, and the store deliberately takes a finished
`system` string today.

### 7. What the composed machine block contains, in this order

Composed by a function per section so each is unit-testable, and emitted in a
fixed order:

1. **THIS MACHINE** — name, manufacturer, year, and the BASIC it runs
   (`PortingFacts.basicDialect`), plus free RAM, program start and screen base.
2. **LANGUAGE RULES** — line-number range, statement separator (or that there is
   one statement per line), `ELSE` support, whether `LET` is required, variable
   naming, number handling, exponent operator, memory-write syntax, address
   notation and hex prefix — every hand-authored and crosschecked field of
   `PortingFacts`.
3. **SCREEN, COLOUR AND SOUND** — the three prose capability facts.
4. **COMMANDS, FUNCTIONS AND OPERATORS** — `tableForMachine(page, dialect.id)`,
   which is exactly the rows that machine has, grouped by capability domain in
   `KEYWORD_DOMAINS` order and sorted within each group by `sortEntries`. One
   line per row: name, kind, syntax, description, and the tag where present.
5. **WHERE THIS MACHINE IS SHORT** — for each `domainGuidance` cell whose `to` is
   this machine's page and whose `support` is `partial` or `none`: the `instead`
   advice and the worked `example`, verbatim. This is the section that answers
   "the machine has no command for this" with the project's own written answer
   rather than another machine's command.

Grouping by capability rather than alphabetically is deliberate: the failure being
addressed is reaching for a command this machine does not have, and a reader
scanning "graphics" sees at once what this machine's graphics actually are.

### 8. Byte-stability is a property to test, not to hope for

Everything above is derived from module-level constant arrays through pure
functions, with fixed section order, a fixed domain order and an explicit sort —
no `Set`/`Map` iteration order, no timestamps, no environment reads. A test
asserts that two compositions for the same dialect are identical strings, and
that every registered dialect composes without throwing. That is what the
provider's prefix cache depends on, and it is cheap to pin.

### 9. The prose keeps what the data cannot carry

Each `aiProfile.systemPrompt` is edited to keep: the machine's speed and what to
design around it, the performance tricks, how to write escapes, graphics
characters and inverse video in this editor, the `#BIN` machine-code-block rules,
and the OUTPUT FORMAT section. It loses: keyword and function lists, and the
language rules now stated from `PortingFacts` — the two things the data states
better and states for every machine.

The editing rule is *remove what the block now states, never restate it
differently*. A completeness test backs the first half: for every registered
dialect, every name in the dialect's keyword table appears in the composed block —
the same assertion `keyword-crosscheck.test.ts` makes of the docs pages, now made
of what the assistant is sent. Nothing can test the second half automatically, so
each of the thirteen edits is reviewed against the composed block for that
machine.

### 10. Identical documentation output is verified by building twice

Before the move, `npm run docs:build` and the resulting `docs/.vitepress/dist`
is copied aside. After the move and rewire, it is built again and the two trees
diffed. Rendered HTML must match exactly; hashed asset filenames are expected to
differ, since the module graph's paths changed, and are excluded from the
comparison. The reference pages, the comparison page and the escape-table pages
are the ones that matter, and are checked by eye as well.

### 11. No seam impact

The `Dialect` / `MachineEmulator` contract in `src/dialects/types.ts` is
unchanged: no new members, and `AiProfile` keeps its two fields. The composition
reads `dialect.id`, `name`, `manufacturer` and `year` — all existing members —
and everything else comes from the shared data, keyed by dialect id and page
slug. No machine-specific code is added anywhere outside `src/dialects/<id>/`,
and the thirteen prose edits are each inside their own dialect folder.

`src/reference/machines.ts` keeps its standing ban on importing the registry.
Living in `src/` makes that import newly tempting and no more correct: the docs
runtime still cannot afford it (the registry pulls in every emulator core), and
`machines-crosscheck.test.ts` remains what keeps the hand-authored list honest.

## Risks / Trade-offs

- **The composed block is much larger than the prose it replaces** → One line per
  keyword, no blank-line padding, and description text taken as written. Machines
  with the largest tables are the ones whose prose was least complete, which is
  the point; the block is still a few thousand tokens against context windows
  measured in hundreds of thousands. Sizes per machine are recorded during
  implementation so the cost is a number rather than a feeling.
- **Non-Anthropic backends do not all cache the same way** → OpenAI and Gemini
  are selectable, and a bigger system prompt costs more per turn where caching is
  absent or automatic-only. Accepted: correctness of generated code is the thing
  being bought, and the block is stable per machine, which is the precondition
  every provider's caching wants.
- **A non-deterministic composition would silently destroy caching** → the
  identity test in decision 8. Note that `sortEntries` uses `localeCompare`,
  whose collation is locale-dependent; it is stable for a given user, which is
  what per-conversation caching needs, and the test pins it within a run.
- **The move breaks the docs site in a way tests do not see** (a `.vue` script
  block is not typechecked) → the build-and-diff of decision 10, plus a manual
  pass over the comparison page, which is the heaviest consumer.
- **Thinned prose contradicts the data instead of deferring to it** → the
  completeness test catches omission, not contradiction. Mitigated by the editing
  rule and by reviewing each machine's prose against its composed block; a
  contradiction found later is a normal fix, not a design failure.
- **Someone statically imports the reference tree into the app** → the ESLint
  rule in decision 5, so it fails `npm run lint` rather than quietly adding
  ~250KB to the initial download.
- **Thirteen prose edits are the largest hand-written surface here** → they are
  reversible in isolation, one file each, and their effect is now observable:
  with runtime verification in place, a machine whose thinning went too far shows
  up as programs that fail to run.

## Migration Plan

1. Move `docs/reference/data/**` → `src/reference/**` and
   `theme/dialectCompare.ts` (+ its tests) → `src/reference/compare.ts` with
   `git mv`, so history follows; fix imports inside the moved tree only.
2. Rewire the docs side: the three theme components, `referenceTable.ts`,
   `escapeTable.ts`, `domainMeta.ts`, `kindMeta.ts`, the theme tests, and the two
   scaffold scripts under `scripts/`. Widen `tsconfig.docs.json`.
3. Verify the move: full quality gates plus the docs build diff. Nothing has
   changed behaviourally at this point, so a clean diff means the move is done.
4. Add `src/ai/machineReference.ts` and its tests; wire `loadSystemPrompt` and
   the three call sites. The block is additive here — the prose is untouched, so
   any regression is attributable to composition alone.
5. Thin the thirteen prose descriptions, one commit per manufacturer group, each
   reviewed against that machine's composed block.
6. Update `docs/contributing/glyph-sources.md`, `docs/contributing/dialect-roadmap.md`,
   the `adding-a-target-system` and `dialect-reference-docs` skills, and
   `architecture.md`'s component map to name the new home.

Rollback is per step: steps 1–3 revert as one move commit, step 4 by dropping the
block from `buildSystemPrompt`, and step 5 file by file.

## Open Questions

- Should `PortingFacts.portingNotes` (target-anchored, true of the machine
  whatever you arrived from) eventually join the block? Left out here to keep one
  owner for porting behaviour; worth revisiting once the porting change lands.
- Should a program carrying machine-code blocks also be sent the relevant per-CPU
  assembly reference? Out of scope, but the data is now equally reachable.
- The two per-command descriptions (terse for autocomplete, fuller for the
  reference pages) are pinned only by name. Merging them is later work, and this
  change makes the fuller one load-bearing in a second place, which raises the
  value of doing it.
