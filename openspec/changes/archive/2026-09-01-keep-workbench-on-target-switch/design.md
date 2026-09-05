## Context

The target switch is one state patch in the single Zustand store, shared by every
path that makes a different program active: the switch itself, New, Open, a
shared program opened in the IDE, and the player's boot. That sharing is what
makes the switch's teardown semantics uniform, and it is also why "Keep my code"
drops so much: the patch was written for the document-replacement case, and the
one path that is *not* a replacement rides on it.

The fix is to give that patch a retain mode used only by the two paths where the
user keeps their program, and to leave every other caller on today's behaviour.

See `docs/contributing/architecture.md` for the store conventions this follows.

## Impact on the Dialect / MachineEmulator seam

**None.** No dialect gains a field, no method changes, and nothing new is asked
of a machine. The retention rule reads what the seam already declares — whether
a dialect supports memory blocks at all, and whether its blocks live in the BASIC
listing or at fixed addresses — and every rule below is expressed in those terms
rather than in machine names, so a machine registered later is covered without
being enumerated.

## Decisions

**Blocks travel whatever the CPU.** A Z80 routine carried onto a 6502 machine is
bytes that will not run and assembly that will not assemble, and both are
reported by machinery that already exists: the block linter against the memory
map, the assembler against the source. The alternative — dropping the block on a
CPU change — destroys the user's assembly to spare them a diagnostic, which is
the behaviour being fixed. Consistency with the BASIC decides it: "Keep my code"
keeps code that may not run.

**Blocks do not cross the two block models.** For most machines a block is bytes
injected at a fixed address. For the ZX80 and ZX81 a block is a `#BIN` record
inside the BASIC listing, whose address falls out of where the record sits in the
program area, and which is derived from the source rather than stored beside it.
Neither model can express the other's blocks without inventing an address, which
is the re-targeting this codebase deliberately does not do. So a switch between
the two models carries no blocks — and needs to carry none, because the records
are inside the program text that is being kept. Within one model, blocks travel:
fixed-address to fixed-address carries the blocks themselves, listing to listing
carries the per-record metadata the source cannot hold.

**Undo survives a keep, and only a keep.** The editor is torn down and rebuilt
when the machine changes, so the history has to be parked on the way out and
restored on the way in. The buffer-history store already distinguishes a
document replacement from an edit, by a generation counter bumped when a
replacement clears it. A retained switch does not clear, so the parked state
comes back; every other path clears, so the generation moves and the parked state
is refused. The existing mechanism does the discrimination — no new flag.

**The question states what travels.** The confirmation is computed from the
document in front of the user and from the same retention rule the switch will
apply, so the two cannot disagree: it names blocks only where there are blocks,
buffers only where there are buffers, saved files only where the program saved
some, and says blocks will be dropped exactly when they will be.

## Risks

- A kept block whose address is invalid on the new machine makes the program
  unrunnable until the user moves it. That is the intended, visible outcome, and
  it replaces a silent deletion — but it does mean a switch can leave a document
  that will not run for a reason the BASIC alone does not explain. The block
  linter's existing messages carry that explanation.
- Blocks retained onto a machine that lints them as invalid are still autosaved
  and still written into a saved project. This is correct — the document is what
  the user has — and matches how invalid BASIC is already treated.
