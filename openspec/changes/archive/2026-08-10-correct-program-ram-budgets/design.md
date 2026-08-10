## Context

`Dialect.programRamBytes` is the editor-time RAM budget: one hand-written number
per dialect, mirrored into the reference tree as `PortingFacts.freeRamBytes` and
pinned to it by a crosscheck. Every machine also implements
`MachineEmulator.readMemoryStats()`, which reads used/free from the machine's own
BASIC workspace pointers; the status bar shows that instead of the budget as soon
as a machine is running. The seam layout is in
`docs/contributing/architecture.md`.

The two numbers were never compared to each other. That is the whole defect: the
budget is what the user sees while writing, the reading is what the machine
actually has, and they disagreed by up to 3.5x.

## Goals / Non-Goals

- **Goal:** every machine's budget is the machine's own answer, and stays that
  way when a new machine is added.
- **Goal:** the Atom's emulated hardware matches the machine the map and the
  budget describe, so a program that fits in the IDE fits the Atom.
- **Non-goal:** changing what the budget *means*. It is still "free RAM for a
  BASIC program on this machine", still an estimate against which a real
  program's headroom varies with display mode and variables.

## Decisions

### The budget is verified against the machine, not replaced by it

The obvious alternative — drop `programRamBytes` and read the machine — does not
work: the budget has to be answerable with no machine running (that is when the
user is writing), and the porting guide has to answer for a machine it is not
running at all. So the field stays, and a registry-driven test boots each machine
and holds the field to its cold-start reading.

The comparison is deliberately two-sided and asymmetric. Overshooting the reading
is capped at a handful of bytes, because a budget that promises RAM the machine
lacks is the failure being fixed. Undershooting is allowed further, per machine
and with the reason written down, because some machines genuinely spend RAM the
cold-start pointers have not spent yet — most of all the Sinclair display file,
which lives inside the program area and grows as the screen fills.

### The Atom is constrained in the adapter, not in jsbeeb

jsbeeb's Atom model maps `0x0000-0x9FFF` as RAM unconditionally. Forking it is
against the vendoring rules and unnecessary: jsbeeb decides RAM through a
per-page status table, and reads and writes to a page marked as a device fall
through to handlers that ignore unmatched writes and return the address high byte
on read — open bus, which is what a 6502 sees with nothing driving the bus. The
adapter marks the unpopulated pages that way after initialisation.

A hard reset rebuilds that table from the model, and the Run path hard-resets
before every injection, so the adapter reapplies after each reset. That is the
one non-obvious part of this and the reason it has its own test: a missed reapply
would show as the machine silently growing 17K on its second run.

Rejected: capping only the reported figure and leaving the emulated RAM in place.
It would keep the byte counter honest while the machine underneath still ran
programs no Atom could hold — the same class of divergence, moved somewhere
harder to see.

### The Atom's samples move rather than the window widening

Two samples used a fixed scratch address at `#7000`, and the kaleidoscope block
loaded at `#5000`. Both are in the expansion window, so both are now open bus.
They move into the RAM the machine has: the block to `#3800`, in the last 1K of
internal RAM, and the scratch buffers to a `DIM`-allocated array, which is how
the machine's own documentation says to reserve bytes and which cannot fall out
of RAM as the samples change.

## Impact on the Dialect / MachineEmulator seam

None. `programRamBytes` and `readMemoryStats()` are both existing seam members;
this changes the values behind them and adds a test that relates them. No dialect
gains or loses a capability, and no app code learns anything machine-specific.

The one type-level change is to the local jsbeeb declarations, which gain the
page-status table the Atom adapter now writes to. That file describes a vendored
package to TypeScript; it is not part of the seam.
