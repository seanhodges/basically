## Context

The porting guide's language & hardware table is rendered from `PortingFacts`,
one resolved entry per machine, by a literal list of `[label, accessor]` pairs in
`DialectCompare.vue`. Adding a row is adding a fact and a pair; the interesting
decisions are where the fact comes from and what the order should be. See
`docs/contributing/architecture.md` for how the docs data layer sits apart from
`src/`.

## Goals / Non-Goals

- **Goals:** name the BASIC per machine, from a source that cannot drift; order
  the rows by what a port turns on; put the memory facts in one place.
- **Non-Goals:** deriving the order from data, changing any other section of the
  comparison, or touching `src/`.

## Decisions

### The name is a fact on the machine, pinned to the dialect's blurb

Three sources for the BASIC's name were available:

1. **The reference page title** (`bbcReference.title`). Rejected: it is
   per-page, and the four multi-machine pages are exactly the cases the row
   exists for — "BBC BASIC (Micro & Master)" cannot tell a Micro from a Master.
2. **A new `Dialect` field in `src/`.** Rejected: the docs runtime must not
   reach the registry (an import-graph test enforces it), so the docs would need
   a hand-copied mirror of it anyway — which is what `machines.ts` and `facts.ts`
   already are.
3. **A hand-authored `PortingFacts.basicDialect`, crosschecked against the
   dialect's `blurb`.** Taken. Every registered dialect's blurb already names
   its BASIC ("Runs BBC BASIC IV", "Locomotive BASIC 1.1"), and the machine
   picker puts that blurb on the row a reader chooses from — so pinning to it
   makes the two surfaces agree by construction. The crosscheck is a substring
   test rather than equality, because the blurb is a sentence and the row is a
   name.

`extends` does the rest: the VIC-20 inherits the C64's `Commodore BASIC V2`,
which is correct and says so, while the PET, the Master, the 6128 and the 128K
each state their own. That is the same split of shared-versus-own the facts
already use for free RAM and colour.

### The row order is editorial, and stated where it is made

There is no measurable "significance to a porter", so the order is a judgement.
It is written down as a comment over `factRows` rather than left implicit,
because the next person to add a fact needs to know where it goes.

The order is: the BASIC → what decides whether the program can work at all
(`Numbers`, `Free program RAM`) → the language rules that force edits wherever
they apply (`Variable names`, `Conditionals`, `Statements per line`,
`LET on assignment`, `Exponent operator`, `Line numbers`) → the hardware it
draws and sounds on (`Screen`, `Colour`, `Sound`) → the memory facts
(`Writing memory`, `Address notation`, `Screen base`, `Program start`).

Two placements are worth defending. `Numbers` leads because an integer-only
target rescales every fractional calculation in the program, which is the
largest single thing a fact row can tell you; it was sixth. `Free program RAM`
follows because a program that does not fit is not a porting problem but a
rewrite — the VIC-20 has a tenth of the C64's — and it was tenth. `Line numbers`
falls to the end of the language block: it is the row that most rarely changes
anything, and it used to open the table.

### The memory facts close the table, addresses last

`Screen base` and `Program start` are the two rows the reader either needs
together or not at all, and they sat three rows apart with the free RAM between
them. They are now adjacent, behind the two rows that say how this machine
writes memory and spells an address — which is what a reader has to know before
either address is usable. The whole run is last because it is the only part of
the table that a program not touching hardware can ignore outright.

### The unchanged-row filter applies to the new row like any other

A pair that shares a BASIC (VIC-20 → C64) has nothing to report there, and the
row is hidden by default with the rest of the unchanged rows. Exempting it would
buy one line of reassurance at the cost of the filter having an exception.

## Impact on the Dialect / MachineEmulator seam

None. No `src/` file changes; the docs data layer is hand-authored and pinned to
the registry by tests that may import it, which is the existing arrangement.

## Risks / Trade-offs

- **The crosscheck depends on blurb wording.** Rewording a dialect's blurb away
  from its BASIC's name fails the crosscheck. That is the intended failure: the
  picker and the comparison disagreeing silently is the thing being prevented,
  and the fix is one line either way.
- **Reordering moves rows a reader may have learned.** The table is short, every
  row keeps its label, and it is read as a whole rather than by position.
