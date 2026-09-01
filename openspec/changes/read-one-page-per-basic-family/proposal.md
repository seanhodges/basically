## Why

Every registered machine now declares the family of BASIC it runs, and the
machine list reads by family. The language reference still does not: it carries a
page per machine variant, so the ZX81 and the Spectrums are three machines
running one Sinclair BASIC across two pages, and the Apple I and Apple II run one
Integer BASIC across two more. A reader who has just chosen their machine under
"Sinclair BASIC" arrives at a page that names a different machine.

Merging those pages is not the page-level edit it looks like, which is why it was
cut from `group-machines-by-basic-family` rather than shipped with it. The
porting data is keyed by **page slug** rather than by machine:

- `porting.ts` gives each slug its own keyword spellings and false-friend
  meanings — the ZX81's `GOTO`, `CONT` and `RAND` against the Spectrum's
  `GO TO`, `CONTINUE` and `RANDOMIZE`.
- `domain-guidance.ts` carries thirteen advice cells per slug: what the target
  offers in a capability, what to do instead where it does not, and a worked
  example.
- `pairPortingNotes` holds `zx81 → zxspectrum` and `zxspectrum → zx81` outright.

Collapse two slugs into one and a ZX81 reader is told their `GOTO` is spelled
`GO TO` and offered the Spectrum's `PLOT`, `DRAW` and `BEEP`, while two of the
commonest ports there are become self-pairs the comparison can never ask. The
same keying already costs something today, before any merge: a CPC 464 is
answered by the CPC page's guidance, which is written around BASIC 1.1.

## What Changes

- **The porting data is keyed by machine, not by page.** Keyword spellings,
  false-friend meanings, target guidance and pair notes are each declared per
  machine, with machines that genuinely share advice sharing a named constant
  rather than a slug — the shape `facts.ts` already uses for the Commodores.
  Where a machine currently rides on a relative's slug it keeps exactly the
  advice it has today, so nothing a reader sees changes until its own entry says
  otherwise.
- **The guidance crosschecks narrow to the machine.** A cell's `reachFor`
  command names and its claim to support a capability are checked against that
  machine's own rows rather than its page's, so advice naming a command the
  machine does not have fails rather than reading plausibly.
- **The language reference carries one page per family.** `zx81` and
  `zxspectrum` merge to `sinclair`; `apple1` and `apple2` merge to
  `integer-basic`. Rows only some of a page's machines have are scoped and
  badged, as the shared pages already require, and each machine's hardware keeps
  its own section.
- **The Altair page is retitled "Microsoft BASIC"**, naming Altair 8K BASIC as
  the version it runs. Twelve pages where there were fourteen, one per family.
- **BREAKING (documentation URLs only):** `/reference/zxspectrum`,
  `/reference/apple1` and `/reference/apple2` move. The site is on GitHub Pages,
  which has no server-side redirects, so each old URL keeps a stub page that
  sends the reader to the new one. No application URL, share link, saved project
  or dialect id changes.

## Non-goals

- **No dialect is merged, renamed or removed**, and no `Dialect` field changes.
  The registry is untouched but for the `docsReference` values naming the two
  merged pages.
- **No porting advice is rewritten** as part of the re-keying. Re-keying carries
  today's text to the machines that read it today; only advice the narrowed
  crosschecks prove wrong is corrected, and each correction is its own commit.
- **No emulator, tokenizer, charset or memory-map behaviour changes.**
- **The machine list is not touched.** It already groups by family.
- **The comparison keeps naming each machine's own version of its BASIC.** This
  change makes that easier to hold, never harder.

## Capabilities

### New Capabilities

None. This change reorganises how existing capabilities present and key material
they already carry.

### Modified Capabilities

- `dialect-toolchain`: the language reference is organised one page per family
  rather than one per machine variant.
- `porting-guidance`: the guidance a machine carries is that machine's own
  rather than its reference page's, so machines sharing a page no longer share
  advice they do not share behaviour for.

`memory-map` is deliberately **not** modified: its requirement that each machine
on a shared page gets its own layout shown with its own material is what the
merged hardware sub-pages must satisfy, and it already says so.

## Impact

**Code — the re-keying.**

- `src/reference/porting.ts` — `keywordEquivalences`, `falseFriends` and
  `pairPortingNotes` re-keyed to machine ids.
- `src/reference/domain-guidance.ts` — cells re-keyed to machine ids.
- `src/reference/compare.ts`, `portDescription.ts`, `machineDescription.ts` —
  look guidance up by machine rather than by `page`.
- `porting-crosscheck.test.ts`, `domain-guidance-crosscheck.test.ts`,
  `escape-guidance-crosscheck.test.ts` — completeness and `reachFor` checks
  narrowed to the machine's own rows.

**Code — the merge.**

- `src/reference/zx81.ts` + `zxspectrum.ts` → `sinclair.ts`; `apple1.ts` +
  `apple2.ts` → `integer-basic.ts`; the same for `escapes/`; `pages.ts` maps the
  new slugs; `apple1`, `apple2`, `zx81`, `zxspectrum` and `zxspectrum128` name
  their page with `docsReference`.

**Documentation.** The two page merges and their `hardware`/`escapes`/`formats`
sub-pages, the Altair retitle, the "BASIC dialects" list in
`docs/reference/index.md`, cross-links in `compare.md`, `z80-assembly.md`,
`file-formats.md`, `porting-basics.md` and `docs/contributing/`, three redirect
stubs, and the Language reference section of the sidebar in
`docs/.vitepress/config.ts` — the one sidebar edit this change is authorised to
make, being the substance of the request rather than an incidental page addition.

**Authoring guidance.** `.claude/skills/dialect-reference-docs/SKILL.md` gains
the twelve-page list and the rule that a new machine's guidance is written for
the machine, not for the page it joins.
