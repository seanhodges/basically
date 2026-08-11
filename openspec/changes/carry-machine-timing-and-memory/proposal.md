## Why

The porting comparison learned three facts about every machine that the
assistant is never told when it *writes* a program:

- **The boot screen as numbers.** The comparison checks a program's print
  positions against the target's columns and rows. The assistant gets the
  prose summary beside them — "MODE-dependent: 40×25 teletext (MODE 7) up to
  640×256" — which no position can be checked against. So the guide can tell
  a user that column 35 has nowhere to be on a 32-column machine, while the
  assistant writing that machine's program has nothing that says so.
- **How long a wait is.** A pause written as a counting loop is the machine's
  own speed written into the program, and the machines run BASIC from 66 to
  1,880 empty iterations a second — a factor of twenty-eight. Each machine
  also has its own idiom for waiting, and one of them has none at all. Both
  are measured or authored facts the comparison uses; the assistant writes
  `FOR I=1 TO 1000: NEXT I` from habit instead.
- **Where things are in memory.** Every machine but one declares a full
  memory layout with its regions named — the keyboard, the sound chip, the
  jiffy clock, the read-only ROM. The comparison reads a program's addresses
  against both machines' layouts. The assistant is told two addresses out of
  it, screen base and program start, and reaches for the rest from
  recollection. A read of the wrong address does not fail: it returns a
  number that means nothing, which is the quietest way a generated program
  can be wrong.

All three are already loaded on the assistant's own path — the port report
composes with the same facts and the same maps — so the data is present and
simply not handed over when the request is to write code rather than to port
it.

## What Changes

- The machine description carried with every request states the **boot text
  screen as columns and rows**, with the ranges a position must stay inside,
  beside the prose summary it already carries.
- It gains a **timing section**: the machine's own idiom for waiting, and the
  measured rate of an empty counting loop, quoted as this product's emulators'
  and never as a claim about the original hardware. A machine with no measured
  speed states none.
- It gains the **machine's memory layout**: the addressable range, each named
  region with its bounds and its note, read-only memory marked as such, and
  the user-defined-graphics base where the machine has one. A machine whose
  dialect declares no layout carries no such section rather than a partial one.
- Addresses are written in the machine's own notation, from the same helper
  the port findings use, so a region named in the standing description and the
  same region named in a port's findings read alike.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: *The assistant knows the machine and the program* is
  extended — the complete definition the request carries now includes the boot
  screen's geometry, how the machine waits and how fast it runs, and where
  things are in its memory.

## Non-goals

- **Changing the port hand-over.** The conversion path already carries every
  one of these findings for the program in hand; this is the standing
  description, for the request that is not a port.
- **Live memory.** The layout is the static one the dialect declares and the
  memory-map viewer draws — the boot state, not what a running program has
  moved.
- **Real-hardware speed claims.** The rate is the emulators', said to be, for
  the same reason the comparison says it.
- **Teaching machine code.** Naming the regions is not a machine-code
  tutorial; what a routine is *for* stays the port's question.
- **New reference data.** Every fact here is already authored, crosschecked or
  measured; nothing new is written down.

## Impact

Affected code:

- `src/reference/machineDescription.ts` — the three new sections, and the
  address formatter lifted out of the port describer so both write an address
  the same way.
- `src/reference/portDescription.ts` — uses that shared formatter.
- `src/ai/machineReference.ts` — passes the dialect's memory layout through,
  as the port report already does.
- `src/ai/machineReference.test.ts` — registry-driven sweeps pinning each
  machine's geometry, wait idiom, measured rate and every region of its
  layout, plus the worked examples.

No dependency changes, no storage or share-format changes, no tokenizer or
emulator changes, and no change to the `Dialect` / `MachineEmulator` seam. The
description stays byte-stable per machine, which is what the providers' prefix
caching depends on.
