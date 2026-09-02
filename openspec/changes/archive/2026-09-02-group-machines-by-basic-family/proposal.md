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
- Machines whose BASIC is a licensed Microsoft BASIC under a vendor's own name —
  Commodore BASIC, Applesoft BASIC, TRS-80 Level II BASIC — keep those names as
  their families. The shared ancestry is prose on the pages, not a merge.
- ZX80 BASIC, Atom BASIC, Atari BASIC and BASIC-G stay as they are: each is
  either the only machine in its family or already grouped.
- The authoring guidance for a new target system gains the field and the family
  list, so the next machine joins a family rather than minting one.

The result is 12 families across the 21 registered machines.

**Deferred to a follow-up change: reorganising the language reference one page
per family.** Merging the ZX81 into the Spectrums' page and the Apple I into the
Apple II's is not the page-level edit it looks like. The porting data is keyed by
page slug rather than by machine — `porting.ts` gives each slug its own keyword
spellings and false-friend meanings (`GOTO` vs `GO TO`, `RAND` vs `RANDOMIZE`),
`domain-guidance.ts` carries thirteen advice cells per slug, and
`pairPortingNotes` holds explicit `zx81 → zxspectrum` and `zxspectrum → zx81`
entries that a merge turns into self-pairs the comparison can never ask for. So
merging the pages would silently offer a ZX81 reader the Spectrum's spellings
and graphics advice, and drop the advice for one of the commonest ports there
is. Untangling the porting key from the page slug is its own change, with its
own design; no documentation URL moves until it lands.

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
- **No reference content is rewritten**, and no documentation URL moves — see
  the deferral above.
- Deciding families for machines that are not yet registered.

## Capabilities

### New Capabilities

None. This change modifies how existing capabilities describe and group the
machines they already cover.

### Modified Capabilities

- `dialect-toolchain`: every registered dialect declares the family of BASIC its
  machine runs as well as the version.
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
- `src/reference/machines.ts` — mirrors the family.
- `src/components/machinePicker.ts` — groups and searches on the family, and
  the arrangement is relabelled "BASIC family" so it does not promise a heading
  per version.
- `machines-crosscheck` pins the new field to the registry, and
  `registry.test.ts` holds every machine to a family and every shared page to
  one family.

**Documentation.** None. The reference pages are unchanged, so the sidebar is
untouched.

**Authoring guidance.** `.claude/skills/adding-a-target-system/SKILL.md` gains
the two fields and the family list, `dialect-reference-docs/SKILL.md` the rule
that a shared page is a shared family, and
`docs/contributing/adding-a-dialect.md` both — so the next target system joins
an existing family rather than minting a new one.
