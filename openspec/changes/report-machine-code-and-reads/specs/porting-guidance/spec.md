## ADDED Requirements

### Requirement: Where the program's reads land on the target is reported

A program that reads memory directly carries addresses chosen for one machine
as surely as a program that writes: the keyboard matrix, the frame clock, the
system variables all live somewhere particular. On another machine those
addresses hold something else, and the read does not fail — it returns
numbers that mean nothing, which is quieter than a write's damage and no less
a porting fact.

Where the reader's own program is at hand and both machines' memory layouts
are described, the comparison SHALL report what each address the program reads
reaches on the target machine. It SHALL distinguish an address that reaches
the same kind of thing at a different place, one that reaches something else —
named on both sides, since either alone leaves the reader to guess — and one
the target's address space does not contain.

Where a read lands on a region the machine's layout names — the keyboard, a
clock, the system variables — the report SHALL name that region on both
machines, so that what the program was really asking for is visible and the
target's own way of asking it can be found.

An address the comparison could only approximate SHALL carry that doubt into
its verdict, reported as an estimate rather than a conclusion.

Where either machine has no described memory layout, or there is no program,
no verdicts SHALL be reported.

#### Scenario: A read that reaches something else on the target

- **WHEN** the open program reads an address that holds one kind of thing on
  the source machine and a different kind on the target
- **THEN** the comparison reports the read, naming what it asked for and what
  it would reach on the target

#### Scenario: A read of the keyboard

- **WHEN** the open program reads an address the source machine's layout names
  as keyboard hardware
- **THEN** the report names the keyboard on the source side, and names what
  the same address holds on the target

#### Scenario: A read the target's memory does not contain

- **WHEN** the open program reads an address beyond the target machine's
  address space
- **THEN** the comparison reports that the target has no such address

#### Scenario: An address that could only be approximated

- **WHEN** the comparison could not resolve a read address exactly
- **THEN** its verdict is reported as an estimate

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** no read verdicts are reported

### Requirement: Machine code the program calls is reported as work to re-achieve

A machine-code routine is the one part of a program no substitution can port:
it is processor code for the source machine, reached through a call command or
carried as an attached block, and on the target it is at best absent and at
worst noise. The commands that call it are not the finding — the routine is,
and the only question that moves the port forward is what the routine was
*for*, because a sound effect, a scroll, or a speed-up is re-achieved with the
target's own means, not translated.

Where the reader's own program calls machine code or carries code blocks, the
comparison SHALL gather the call targets and the blocks — each block with its
name, address and size, and a call that lands inside a block reported as a
call into that block — into one finding among the work that must be
rewritten. The finding SHALL state that these are the source machine's
processor code and that no substitution carries them, and SHALL pose the
decision for each routine: establish what it does, and do that with the
target's means.

The comparison SHALL NOT report the call commands themselves as commands the
target lacks where the real difference is the routine: a run-a-routine command
the target spells differently is a rename, and a call that returns a value on
one machine while running code on the other is a same-word-different-meaning
warning.

Where the pair's guidance already says how machine code is carried between
these two machines, the finding SHALL point to it rather than restate it.

Where the program calls no machine code and carries no blocks, nothing SHALL
be reported. Where there is no program, nothing SHALL be reported.

#### Scenario: A program that calls a routine in an attached block

- **WHEN** the open program carries a code block and calls an address inside
  it
- **THEN** the comparison reports the block by name with its address and size,
  the call as a call into it, and poses the decision to establish what the
  routine does and re-achieve it on the target

#### Scenario: A call to an address outside any block

- **WHEN** the open program calls an address it carries no block for
- **THEN** the call is still reported as machine code the port must
  re-achieve, with what the source machine's layout says lives at that address

#### Scenario: Call commands that differ only in spelling

- **WHEN** both machines run routines with commands that differ only in
  spelling, and the open program uses the source's
- **THEN** the spelling change is reported among the renames, and the
  machine-code finding carries the routine question — the command is not
  reported as one the target lacks

#### Scenario: A program with no machine code

- **WHEN** the open program calls no machine code and carries no code blocks
- **THEN** nothing is reported about machine code

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about machine code

## RENAMED Requirements

- FROM: `### Requirement: The memory layouts are narrowed to the program's own writes`
- TO: `### Requirement: The memory layouts are narrowed to the program's own writes and reads`

## MODIFIED Requirements

### Requirement: The memory layouts are narrowed to the program's own writes and reads

Where the comparison is shown inside the IDE, and the user's own program is
therefore at hand, the memory layouts SHALL mark the addresses that program
writes to and the addresses it reads. On the machine being ported **from**
these are the program's own writes and reads; on the machine being ported
**to** they are where those same addresses land, which is what tells a reader
that an access aimed at one machine's system variables reaches another
machine's program text.

The addresses SHALL be read from the program as the language being ported
**from** reads it, as the rest of the narrowing is. An address the comparison
can only approximate SHALL be marked as approximate rather than presented as
exact.

Where the comparison is read on its own, outside the IDE, or where there is no
program to narrow to, the layouts SHALL be reported without marks and everything
else about them SHALL be unaffected.

#### Scenario: A program that writes to memory

- **WHEN** a user reads the comparison inside the IDE with a program open that
  writes to memory
- **THEN** both layouts mark the addresses that program writes to, and the
  target's layout names what sits at those addresses on the machine being ported
  to

#### Scenario: A program that reads memory

- **WHEN** a user reads the comparison inside the IDE with a program open that
  reads memory directly
- **THEN** both layouts mark the addresses that program reads, alongside any
  writes, and the target's layout names what sits there on the machine being
  ported to

#### Scenario: An address that can only be approximated

- **WHEN** the program computes an access address the comparison cannot resolve
  exactly
- **THEN** the address is marked as approximate rather than reported as exact

#### Scenario: Reading the layouts with no program

- **WHEN** a user reads the comparison outside the IDE, or inside it with
  nothing written
- **THEN** both layouts are reported without marks, and are otherwise unchanged
