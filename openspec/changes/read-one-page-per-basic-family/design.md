## Context

The map of the app is in `docs/contributing/architecture.md`; what matters here
is one seam and one keying mistake.

Three lists describe the machines and their documentation, and they are
deliberately separate: the dialect registry, the hand-authored mirror in
`src/reference/machines.ts` that the docs runtime reads (it may never reach the
registry, which pulls in every emulator core), and the table map in
`src/reference/pages.ts`, keyed by page slug. `referencePageOf()` is the one
rule connecting a machine to its page.

The reference tables already support several machines on one page:
`ReferenceTableData.machines` lists them, a row carries `onlyOn` to scope itself
and `tag` to badge itself, and `tableForMachine()` narrows a page to one
machine. Everything that renders keyword rows already narrows this way — the
comparison, the AI's machine description, the hardware pages. The Commodore page
is the worked example: three machines, one table, the 4.0 disk commands badged.

The porting *advice* does not narrow, because it is not rows. It is keyed by
page slug:

- `keywordEquivalences` and `falseFriends` in `porting.ts` map a slug to a
  spelling or a meaning.
- `pairPortingNotes` maps a slug pair to its notes, `zx81 → zxspectrum`
  included.
- `domain-guidance.ts` holds thirteen cells per slug, each with what the target
  offers in a capability, what to do instead, a worked example, and up to four
  of the target's own command names to reach for.

That keying is already lossy where a page covers several machines — a CPC 464 is
answered by guidance written around BASIC 1.1 — and merging two dissimilar
machines onto one page would make it wrong rather than merely coarse. So the
re-keying comes first, and the merge is safe afterwards.

`facts.ts` already went through this. Its header records the same fold and its
removal: "There used to be a REPRESENTATIVE map here, sending each docs *page*
to the one machine whose hardware its facts described - which is precisely how a
reader porting to a VIC-20 came to be told the C64's 38911 bytes free."

## Goals / Non-Goals

**Goals:**

- Make the porting advice a property of the machine, so that two machines on one
  page can differ in it — and so that merging pages is a documentation decision
  with no bearing on what a port is told.
- Organise the language reference one page per family, with each page's material
  attributed to the machines that have it.
- Keep every reader who has a link to a moved page reaching the page that
  replaced it.

**Non-Goals:**

- Rewriting porting advice. Re-keying carries today's text to the machines that
  read it today.
- Any change to the `Dialect` / `MachineEmulator` seam's behaviour — see below.
- Merging, renaming or removing a dialect.

## Decisions

### Impact on the Dialect / MachineEmulator seam

None. The only registry edit is the `docsReference` value on five dialects,
which is metadata in the same class as `manufacturer` and `blurb`; nothing in
`MachineEmulator`, tokenizing, running, exporting or importing reads it. No
field changes type or meaning, and no dialect id moves.

### The porting data is keyed by machine, with families named rather than implied

`keywordEquivalences.spellings`, `falseFriends.meanings`, `pairPortingNotes.from`
and `.to`, and `domainGuidance.to` all take machine ids. Where several machines
genuinely share a value they are named together — `from: COMMODORES` rather than
`from: 'commodore'` — so the file stays about as long as it is now, and a
variant that later needs its own answer is split out of the list without
touching the others.

The lists are named constants shared across the two files, which is the shape
`facts.ts` already uses for `COMMODORE_NOTES`, and for the same reason: a
variant with anything of its own to say would otherwise have to restate the
shared text to keep it, and the copy would drift from the original the first
time either was edited.

*Alternative rejected: give the porting modules a grouping key of their own that
keeps today's fourteen buckets.* It unblocks the merge with the least work, but
it adds a third grouping concept beside the page and the family, and it keeps
every defect the fold already causes — the CPC 464 answered as a 6128, the
VIC-20 answered as a C64. The bucket boundary would also be invisible: nothing
would say why `zx81` and `zxspectrum` are separate buckets on one page.

*Alternative rejected: keep the page key and scope cells with `onlyOn`, as rows
are scoped.* Rows are scoped that way because a row is a fact about a keyword
that some machines have. A guidance cell is a paragraph written *to* a machine;
two machines needing different advice is the ordinary case, not the exception,
and `onlyOn` would make the ordinary case the annotated one.

### The crosschecks narrow to the machine, which is where this pays

`domain-guidance-crosscheck` computes what a target supports and what a port can
lose into it by reading `PAGES[slug]`. Those reads become
`tableForMachine(PAGES[pageOf(id)], id)`, so a cell claiming the target has no
support in a capability its own rows cover, or reaching for a command only its
relative has, fails rather than reading plausibly. Expect this to report genuine
defects on the pages that already cover several machines — the CPC and Commodore
cells are written around one member each. Each such report is a content fix
grounded in the machine's own rows, and belongs in its own commit; none of them
blocks the merge.

The narrowed diff is the cost to watch: the target sweep goes from fourteen
targets against thirteen sources to twenty-one against twenty, on tables that
now need narrowing per machine. Memoise the narrowed table per machine as well
as the losable set per target, or the file becomes one of the slow ones the
unit-suite budget is about.

### The merges use the machinery that is already there

`onlyOn` plus `tag` on a row, `machines` on the table, a section per machine on
the hardware sub-page. No new mechanism, and the requirements that govern shared
pages already exist: `dialect-toolchain`'s row attribution and version-only
badges, and `memory-map`'s "each machine SHALL have its own layout shown with
that machine's own material". Resist averaging the hardware pages — a ZX81 and a
Spectrum 128 share almost nothing.

Slugs are named for the family rather than for a machine that happens to be on
the page — `sinclair` and `integer-basic`, joining `applesoft` in being
language-named. Keeping `zxspectrum` as the slug of a page titled "Sinclair
BASIC" would leave the ZX81 reader on a URL naming a machine they are not using.

### The moved URLs keep a stub, because the host has no redirects

The site is built by VitePress and served by GitHub Pages, which has no
server-side redirect mechanism and no rewrite config to add one to. So each of
the three moved addresses keeps a markdown page whose frontmatter carries a
`meta http-equiv="refresh"` to the new URL, and whose body is a single sentence
linking there for a reader whose browser declines the refresh.

The stubs are deliberately absent from the sidebar and from the reference index:
`docsNavigation.test.ts` requires every *registered machine's* page to appear in
both, and a stub is not one of those — listing it would advertise an address the
change is retiring.

*Alternative rejected: accept the break.* Three URLs that have been published
and linked, for the saving of six lines of frontmatter.

## Risks / Trade-offs

**The re-keying is a large mechanical diff over hand-written prose, and a
mis-keyed cell reads perfectly** → Do it as its own step, ahead of the merge,
and prove it by construction: every machine that today reads a slug's value must
come out reading the same text, which is a diff a reviewer can check by reading
the constants rather than the cells. The crosschecks stay green throughout;
where they newly fail, the failure is the point.

**The narrowed crosschecks may condemn advice that is merely coarse rather than
wrong** → Fix the ones that name a command the machine lacks, which is what the
spec forbids. For a cell that is simply written around a relative, splitting it
is a content decision: state it in the change, do not let a crosscheck decide it
silently.

**The Sinclair merge can quietly go wrong** → ZX81 and Spectrum BASIC diverge
substantially, so most Spectrum rows need `onlyOn` and a badge, and a row missed
in either direction offers a ZX81 reader a keyword their machine has never had.
The existing 128K-only tags must survive intact. The crosscheck batteries read
the tables against the registry's real keyword sets, so a row scoped to the
wrong machines fails rather than merely reading oddly: run them before the prose
is polished, not after.

**Two changes' worth of work in one** → The re-keying is independently
shippable and independently valuable; the tasks are ordered so it lands green
before the first page is merged. If the merge has to wait, it waits behind a
tree that is already better than it found it.

**A MODIFIED block can silently delete another change's work** → This delta
modifies a `porting-guidance` requirement that `group-machines-by-basic-family`
did not touch, so the baseline it was written against is the live one. Re-diff
it against the baseline before implementing anyway, and read every removed line
as a deliberate edit or a bug: `openspec validate` checks a delta's shape, not
its fidelity.
