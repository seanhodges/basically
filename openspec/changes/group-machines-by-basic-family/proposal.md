## Why

Every registered machine declares the BASIC it runs as a version-specific
string — `ZX81 BASIC`, `48K Sinclair BASIC`, `128 Sinclair BASIC`,
`BBC BASIC II`, `BBC BASIC IV`, `Locomotive BASIC 1.0` — which is the right
level of detail when a reader is comparing two machines, and the wrong one when
they are choosing between all of them. Arranging the machine list by the BASIC
it runs therefore produces a long list of near-singleton headings that separates
machines running what is recognisably one language, and the language reference
has the same shape: pages split by machine variant rather than by language.

The reference already groups some machines this way — the two BBCs, the three
Commodores, the three CPCs, the two Ataris and the two Spectrums each share a
page — so what is missing is the family as a thing a machine declares, rather
than a coincidence of prose.

## What Changes

- Every registered dialect declares the **family** of BASIC it runs, alongside
  the version it already declares. The version is unchanged and stays
  per-machine; the family is added, never substituted.
- The machine list's "by the BASIC it runs" arrangement groups by family, so the
  three Commodores read under one heading and the two BBCs under another.
  Narrowing the list by typing matches the family name and the version name, so
  typing either still finds the machine.
- The language reference is organised one page per family. Two pages merge:
  ZX81 joins the Spectrums as **Sinclair BASIC**, and the Apple I joins the
  Apple II as **Integer BASIC**. Rows that only some of the page's machines
  provide are marked per machine, as shared pages already require.
- The Altair's page is retitled **Microsoft BASIC**, naming Altair 8K BASIC as
  the version it runs.
- Machines whose BASIC is a licensed Microsoft BASIC under a vendor's own name —
  Commodore BASIC, Applesoft BASIC, TRS-80 Level II BASIC — keep those names as
  their families. The shared ancestry is prose on the pages, not a merge.
- ZX80 BASIC, Atom BASIC, Atari BASIC and BASIC-G stay as they are: each is
  either the only machine in its family or already grouped.
- **BREAKING (documentation URLs only):** two reference pages move —
  `/reference/zxspectrum` → `/reference/sinclair` and `/reference/apple1` +
  `/reference/apple2` → `/reference/integer-basic`. No application URL, share
  link, saved project or dialect id changes.

The result is 12 families across the 21 registered machines, and 12 reference
pages where there were 14.

## Non-goals

- **No dialect is merged, renamed or removed.** All 21 stay registered under
  their current ids, each with its own tokenizer, emulator and keyword set. This
  changes how machines are *described and grouped*, not what any of them runs.
- **The version-specific name is not replaced.** `porting-guidance` requires the
  comparison to name "the machine chosen, not the family it belongs to", and it
  continues to.
- **No emulator, tokenizer, charset or memory-map behaviour changes.**
- **No change to how a project is stored, shared or opened.** Dialect ids are
  the key for saved projects, share links and player routes, and are untouched.
- **No reference content is rewritten** beyond what merging two pairs of pages
  and marking their rows per machine requires.
- Deciding families for machines that are not yet registered.

## Capabilities

### New Capabilities

None. This change modifies how existing capabilities describe and group the
machines they already cover.

### Modified Capabilities

- `dialect-toolchain`: every registered dialect declares the family of BASIC its
  machine runs as well as the version, and the language reference is organised
  one page per family rather than per machine variant.
- `project-setup`: the machine list's by-BASIC arrangement groups by family, and
  narrowing the list by typing matches the family as well as the version.

`porting-guidance` and `memory-map` are deliberately **not** modified. Their
existing requirements — that the comparison names each machine's own version,
that a row belonging to one machine on a shared page shows that machine's
spelling, and that each machine on a shared page gets its own memory layout —
are what the merged pages must satisfy, and they already say so.

## Impact

**Code.**

- `src/dialects/types.ts` — the family field on `Dialect`, and a leaf helper
  beside `src/dialects/referencePage.ts` to read it, subject to the same
  import-graph ban that helper already observes.
- Every `src/dialects/<id>/index.ts` — declares its family.
- `src/reference/machines.ts` — mirrors the family, and the moved page slugs.
- `src/components/machinePicker.ts` — groups and searches on the family.
- `src/reference/` keyword and escape tables — `zx81` + `zxspectrum` merge to
  `sinclair`, `apple1` + `apple2` merge to `integer-basic`, and `pages.ts` maps
  the new slugs.
- Crosscheck batteries that pin the docs data to the registry
  (`machines-crosscheck`, `facts-crosscheck`, `pages.test.ts`,
  `keyword-crosscheck`) extend to the new field and slugs.

**Documentation.** `docs/reference/` page and sub-page merges, the "BASIC
dialects" list in `docs/reference/index.md`, and the Language reference section
of the sidebar in `docs/.vitepress/config.ts` — the one sidebar edit this change
is authorised to make, being the substance of the request rather than an
incidental page addition.

**Authoring guidance.** `.claude/skills/dialect-reference-docs/SKILL.md` gains
the family field and the revised page list, so the next target system joins an
existing family rather than minting a new one.
