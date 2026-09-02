## Context

The map of the app is in `docs/contributing/architecture.md`; what matters here
is a narrow slice of it.

Three lists describe the machines, and they are deliberately separate:

- `src/dialects/registry.ts` and each `src/dialects/<id>/index.ts` — the app's
  own list, reachable only through the `Dialect` seam.
- `src/reference/machines.ts` — a hand-authored mirror for the docs runtime,
  which must never reach the registry (every dialect index pulls in an emulator
  core). `machines-crosscheck.test.ts` may import both, and pins them together.
- `src/reference/pages.ts` — the keyword and control-code tables, keyed by page
  slug, kept registry-free for the same reason and pinned by `pages.test.ts`.

The rule connecting a machine to its documentation page already exists as a leaf
module: `referencePageOf()` in `src/dialects/referencePage.ts`, which takes a
shape rather than a `Dialect` and imports nothing, precisely so that both sides
of that import boundary can use it. Five machines already set `docsReference` to
join a page they do not name.

The reference tables already support several machines on one page:
`ReferenceTableData.machines` lists them, and each row carries an optional `tag`
(the human badge, e.g. "128K only") and `onlyOn` (the machine scope). The
Commodore page is the worked example — three machines, one table, the 4.0 disk
commands badged.

Two existing requirements constrain the shape of any answer here, and are the
reason this change adds a field rather than repurposing one:

- `porting-guidance` — "The name SHALL be that of the machine chosen, not of the
  family it belongs to: machines that share a reference for their BASIC do not
  always run the same version of it."
- The doc comment on `Dialect.basicDialect` makes the same argument from the
  other direction: the two BBCs share a page and run different versions, "which
  is exactly the difference a reader of 'BBC BASIC (Micro & Master)' cannot see."

## Goals / Non-Goals

**Goals:**

- Make the BASIC family a thing a machine declares, so grouping stops being a
  coincidence of how a version string happens to be spelled.
- Group the machine list and organise the language reference by that family.
- Keep the version-specific name intact and separately readable everywhere it is
  what the reader needs.

**Non-Goals:**

- Merging, renaming or removing any dialect. The registry is untouched.
- Any change to the `Dialect` / `MachineEmulator` seam's behaviour — see below.
- Deriving the family by parsing `basicDialect`.

## Decisions

### The family is a declared field, not a derived one

`Dialect` gains an optional `basicFamily`, read through a new leaf helper
`basicFamilyOf()` placed beside `referencePageOf()` — same file conventions,
same "takes a shape, imports nothing" contract, so the docs runtime and the app
can both use it without either crossing the import ban that
`machinePickerBoundary.test.ts` and the eslint rule enforce. Absent means the
family is the `basicDialect` string, which is correct for every machine that is
the only one of its kind.

*Alternative rejected: derive the family by stripping a version suffix from
`basicDialect`.* It gets `BBC BASIC II` → `BBC BASIC` right and everything
interesting wrong: `48K Sinclair BASIC` and `128 Sinclair BASIC` carry the
version as a prefix, `Level II BASIC` would lose its `II`, and `Apple 1 Integer
BASIC` and `Apple II Integer BASIC` would strip to different stems. A string
rule that needs a per-machine exception table is a declared field wearing a
disguise.

*Alternative rejected: replace `basicDialect` with the family.* Forbidden by
`porting-guidance`, and it would flatten exactly the distinction the porting
comparison exists to report.

*Alternative rejected: a structured `{ family, version }` pair replacing the
string.* Cleaner in the abstract, but it forces every consumer — the compare
table, the AI machine reference, the port description, six crosscheck batteries —
to recompose a string they currently read directly, for no behavioural gain.
Additive is the cheaper truthful option.

### Impact on the Dialect / MachineEmulator seam

Additive and metadata-only. `basicFamily` is a description of the machine, in
the same class as `manufacturer`, `year` and `blurb`; nothing in
`MachineEmulator`, tokenizing, running, exporting or importing reads it. No
existing field changes type or meaning, and the field is optional, so every
dialect that does not set it stays valid. Half-built dialects under
`src/dialects/` that are not yet registered (`hb10p`, `samcoupe`) are unaffected
until they register.

### Families are drawn at the official-name line, not the ancestry line

Commodore BASIC, Applesoft and TRS-80 Level II are all licensed Microsoft BASIC
with vendor extensions, so a strict ancestry rule would merge six machines under
"Microsoft BASIC". They keep their vendor names instead: those are the names on
the machines, in the manuals, and in what a reader searches for. "Microsoft
BASIC" covers the Altair, where it is the product's own name. The shared descent
is a sentence of prose on each page, which is where a fact that interests a
reader once belongs.

The same line cuts the other way twice. The Apple I and Apple II share Integer
BASIC and merge; the Apple II Plus runs Applesoft, a different lineage on the
same machine line, and stays separate — the merge makes that distinction visible
rather than hiding it. And ZX80 BASIC stays its own family: the Spectrum ROM
descends from the ZX81 ROM, so ZX81 and both Spectrums are one Sinclair BASIC,
but the ZX80's integer-only 4K BASIC is a different language to write in.

### The reference merge is a separate change

Merging the ZX81 into the Spectrums' page and the Apple I into the Apple II's
turned out not to be a page-level edit. The porting data is keyed by *page slug*
rather than by machine: `porting.ts` gives each slug its own keyword spellings
and false-friend meanings (the ZX81's `GOTO`, `CONT` and `RAND` against the
Spectrum's `GO TO`, `CONTINUE` and `RANDOMIZE`), `domain-guidance.ts` carries
thirteen advice cells per slug, and `pairPortingNotes` holds `zx81 → zxspectrum`
and `zxspectrum → zx81` entries outright. Collapsing two slugs into one would
therefore offer a ZX81 reader the Spectrum's spellings and its PLOT/BEEP advice,
and turn two of the commonest ports into self-pairs the comparison can never
ask - a regression `porting-guidance` exists to prevent, and one no crosscheck
here would catch, because each battery reads the merged page as the truth.

Untangling the porting key from the page slug is the real work, and it wants its
own design: either the porting modules take a key of their own that keeps
today's fourteen buckets, or they go per machine as `facts.ts` already did. The
family field and the grouping ship without it; no documentation URL moves until
that change lands.

### The two page merges, when they happen, use the machinery that is already there

`onlyOn` plus `tag` on a row, and `machines` on the table. No new mechanism, and
the two requirements that govern shared pages already exist and already say what
must hold: `dialect-toolchain`'s "A row belonging to one machine on a shared
page" and "Reference documentation marks version-only keywords", and
`memory-map`'s "each machine SHALL have its own layout shown with that machine's
own material". The merged pages satisfy requirements rather than needing new
ones.

Slugs are named for the family, not for a machine that happens to be on the page
— `sinclair` and `integer-basic`, joining `applesoft` in being language-named.
Keeping `zxspectrum` as the slug for a page titled "Sinclair BASIC" would leave
the ZX81 reader on a URL naming a machine they are not using.

## Risks / Trade-offs

**Two public documentation URLs move** (`/reference/zxspectrum`,
`/reference/apple1`, `/reference/apple2`) → Deferred with the merge, so nothing
moves here. The redirect question stays open for the follow-up change: check for
a mechanism in the VitePress config, and if there is none, state the break
plainly rather than discovering it after publishing.
Nothing inside the app links by these slugs at runtime — the AI reference loader
and the docs-topic router both go through `referencePageOf()` — so the exposure
is external inbound links only.

**The Sinclair merge is the large piece of work, and is the one that can quietly
go wrong** → ZX81 BASIC and Spectrum BASIC diverge substantially, so most
Spectrum rows need `onlyOn` scoping and a badge, and a row missed in either
direction offers a ZX81 reader a keyword their machine has never had. The
existing 128K-only tags must survive the merge intact. Mitigation: the crosscheck
batteries read the tables against the registry's real keyword sets, so a row
scoped to the wrong machines fails rather than merely reading oddly; run them
before the prose is polished, not after.

**The hardware sub-pages merge machines that share very little** → A ZX81 and a
Spectrum 128 have almost no hardware in common. `memory-map` already requires
each machine's own layout with its own material, so the merged sub-pages are
sections per machine, not a blended table. Resist the temptation to average them.

**A MODIFIED block can silently delete another change's work** → Both deltas
here were first written against the then-pending text of
`machine-picker-search-and-sort`. By the time that archived, a second change had
modified one of the same requirements, and the delta written against the older
text would have dropped a paragraph and a scenario it had never seen.
`openspec validate` does not catch this: it checks a delta's shape, not its
fidelity to the baseline. Mitigation, and the rule worth generalising: whenever a
MODIFIED block is written against a delta that has not archived yet, re-diff it
against the baseline once that delta lands, and read every removed line as a
deliberate edit or a bug.

**A future dialect could mint a thirteenth family by accident** →
`.claude/skills/dialect-reference-docs/SKILL.md` and the `adding-a-target-system`
skill are where a new machine's metadata gets written; both need the field and
the current family list, or the next port silently reintroduces the problem this
change fixes.
