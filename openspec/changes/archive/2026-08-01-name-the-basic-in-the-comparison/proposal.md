## Why

The porting guide's language & hardware table answers fifteen questions about
two machines and never the first one a porter asks: **what BASIC does each of
them run?**

For nine of the thirteen machines the answer is on the page somewhere else — in
the picker row's blurb, or in the reference page's title. For the four families
that share a reference page it is on the page nowhere the comparison can use.
"BBC BASIC (Micro & Master)" is one title over two versions; a BBC Micro → BBC
Master comparison reports `EDIT` as a newly available command and never says the
word that explains it, which is *IV*. The same holds for the CPC 464 → 6128 port
and its twelve gained commands, and for the 48K → 128K Spectrum and its `PLAY`.
A reader who wants to know whether they are porting between two BASICs or
between two versions of one has to leave the comparison to find out.

The row order compounds it. The table opens on `Line numbers` — a rule that
changes almost nothing about a port — and reaches `Numbers` (floating point or
integer-only, which decides whether every fractional calculation has to be
rescaled) sixth and `Free program RAM` (3,583 bytes on a VIC-20 against 38,911
on a C64) tenth. The four memory facts are scattered through it: `Screen base`
third from the screen it belongs with, `Program start` two rows further down
with the free RAM between them, and `Address notation` five rows after that —
so the reader interested in memory reads the table four times, and the reader
who is not steps over it four times.

## What Changes

- **A `BASIC dialect` row, first in the table.** Every machine names the BASIC
  it runs — `Commodore BASIC V2`, `BBC BASIC IV`, `Locomotive BASIC 1.1`,
  `128 Sinclair BASIC` — so a comparison states outright what it is a comparison
  between. It is the first row because the rest of the table is about it.
- **A new per-machine fact, `basicDialect`, pinned rather than authored twice.**
  Every registered dialect's `blurb` already names its BASIC ("Runs BBC BASIC
  IV"), which the machine picker shows on the row; the crosscheck requires the
  fact to be a substring of it, so the picker and the comparison cannot come to
  disagree about what a machine runs.
- **The rows reordered by what a port turns on.** The BASIC, then what decides
  whether the program can work at all (arithmetic model, free RAM), then the
  language rules that force edits wherever they apply (variable names,
  conditionals, statement layout, `LET`, exponent, line numbers), then the
  hardware the program draws and sounds on, then the memory facts.
- **The memory facts grouped as one closing run,** addresses adjacent at the
  end: how memory is written, how addresses are spelled, then the screen base
  and the program start. They are the rows that matter only to a program that
  pokes at hardware, and grouping them lets that reader find them at once and
  every other reader skip them at once.
- Machines that share a BASIC with a relative (a VIC-20 and a C64) inherit the
  same name and the row simply does not differ — so it is absent from the
  default view exactly as every other unchanged row is, and present when the
  reader asks for unchanged rows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: two added requirements — that the language and hardware
  differences name the BASIC each machine runs, and that they are ordered so
  what most decides the port is met first with the memory facts reported
  together. The existing requirement that hardware figures describe the machine
  chosen is what makes the first of these per-machine rather than per-page; it
  is unaffected and not restated.

## Non-goals

- **Changing what any other section reports.** The keyword diff, the capability
  groups, the control codes, the guidance and the summary sentence are
  untouched. This change ends at the fact table.
- **Adding facts beyond the BASIC's name.** No release date, no ROM version, no
  interpreter size. The row answers "which BASIC", and the reference page it
  already links to answers the rest.
- **Naming the BASIC anywhere else.** The reference page titles, the picker
  blurbs and the hardware pages keep the words they have; this change reads
  them, it does not rewrite them.
- **Making the dialect row exempt from the unchanged-row filter.** A pair that
  shares a BASIC has no difference to report there, and a row that ignored the
  filter would be the one exception a reader has to learn.
- **Ordering by anything measurable.** "Most significant for a porter" is an
  editorial judgement stated in the code and in the spec, not a score derived
  from the data.

## Impact

- **Docs data** (`docs/reference/data/`): `types.ts` gains
  `PortingFacts.basicDialect`; `facts.ts` names it on all eight base entries and
  on the four variants whose BASIC differs from the relative they extend (the
  VIC-20 inherits the C64's, which is the truth); `facts-crosscheck.test.ts`
  pins each name to its dialect's `blurb`.
- **Docs theme** (`docs/.vitepress/theme/components/DialectCompare.vue`): the
  `factRows` list gains the row and is reordered. No change to
  `dialectCompare.ts` — the fact table is rendered from `PortingFacts`
  directly and the diff logic never sees it.
- **Tests**: new `e2e/porting-guidance/language-hardware-table.spec.ts` over the
  row's content, its position, the full row order and the shares-a-BASIC case.
- **Not touched**: no `src/` change, no dialect or emulator change, and nothing
  near the `Dialect`/`MachineEmulator` seam. `?from=`/`?to=` links keep their
  meaning.
