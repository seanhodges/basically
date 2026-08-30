## Why

Switching the target machine with your own code in the editor asks what should
happen to it: **Cancel**, **Keep my code**, **Start new**. "Keep my code" keeps
the BASIC text and nothing else. The document's memory blocks — hand-written
assembly, sprite tables, character sets — are dropped, every scratch buffer is
dropped, and the undo history goes with them. None of it is mentioned in the
question, so the loss is discovered afterwards, with nothing to undo back into.

The blocks and the buffers are the user's authored work in exactly the way the
BASIC is. A user porting a Spectrum program to the CPC has just told the IDE
that the program is moving machines; the assembly that program calls is part of
what is moving. "Keep my code" already accepts that what it keeps may not run
on the new machine — that is the whole point of the warning it carries — so
there is no reason for blocks and buffers to be held to a stricter test than
the BASIC beside them.

The reason they are dropped today is that a block sits at a fixed address in the
machine's memory map, and an address that was valid on the old machine may not
be on the new one. But the IDE already has the answer to that: the block linter
checks every block against the active machine's memory map and reports what does
not fit, and the run gate refuses a program whose blocks are invalid. Dropping
the block spares the user a diagnostic they would rather have.

## What Changes

- **"Keep my code" keeps the document's memory blocks**, with their names,
  addresses, bytes and assembly source, wherever the new machine supports blocks
  at all. Blocks keep their addresses rather than being re-sited, so a block that
  no longer fits the new machine's memory map is reported by the existing block
  validity check and fixed by the user, in the open.
- **"Keep my code" keeps the scratch buffers**, with their names and contents.
- **"Keep my code" keeps the undo history**, since the program text is unchanged
  by the switch.
- **"Start new" is unchanged**: a new program on the new machine starts with no
  blocks and no buffers, as it does today.
- **The question says what travels.** Where blocks or buffers exist, the switch
  confirmation states that they come across and what that means; where the new
  machine cannot hold the blocks, it states that they will be dropped.
- **The files a running program saved are still discarded**, on either answer.
  They are program output belonging to the machine that produced them, not part
  of the document, and that rule is unchanged.
- **Imported tape files, a boot disc image and an auto-start line are still
  discarded**, on either answer: each is a verbatim image in one machine's own
  format, which nothing on the new machine can read.
- **Program breakpoints are still cleared**, as they are on any switch today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `persistence`: the "Scratch buffers belong to the project" requirement says
  buffers are discarded when the user switches target machine. That becomes
  conditional on the answer given to the switch: discarded when the user starts
  a new program, kept when the user keeps their code.
- `memory-blocks`: the "Blocks are part of the document" requirement gains what
  a target switch does with them — kept with the program the user chose to keep,
  at their own addresses, where the new machine supports blocks; dropped where it
  does not.
- `dialect-toolchain`: "Switching target still asks about the user's program"
  gains that the question states what travels with the code.

`sharing-player` is **not** affected: a share link carries blocks already and
carries no scratch buffers, and neither changes.

`hardware-transfer` is **not** affected: export sees whatever blocks the document
holds, as it does today.

## Non-goals

- **Re-targeting a block to the new machine.** A block keeps the address it was
  given. The IDE does not relocate it, translate its bytes between CPUs, or
  re-assemble its source for a different instruction set. A block that no longer
  fits is reported, not moved.
- **Carrying blocks across the two block models.** A machine whose blocks are
  hidden `#BIN` records inside the BASIC listing and a machine whose blocks are
  fixed-address memory injections do not model the same thing, and a switch
  between the two carries no blocks. The records themselves ride inside the
  kept program text, so nothing is destroyed.
- **Keeping the files a running program saved.** Unchanged, deliberately.
- **Keeping breakpoints, tape files, a boot disc or an auto-start line.**
  Unchanged.
- **Warning before "Start new" discards blocks or buffers.** The switch
  confirmation is already that warning; this change makes it accurate.
