## ADDED Requirements

### Requirement: BASIC can refer to a block by name

BASIC source SHALL be able to name a memory block where it would otherwise
write that block's address, using the block's name. The IDE SHALL resolve every
such reference to the block's current address wherever the program is turned
into bytes — run, export, share, lint, and the byte count — so all of them agree.

Moving a block SHALL change what its references resolve to, without changing the
user's source. A reference naming no block SHALL be reported as an error at the
reference itself, and SHALL prevent the program being built, since it cannot be
turned into bytes.

A plain numeric address that matches no block SHALL be reported as a warning
only, and SHALL NOT prevent the program from running: naming a block is an
option, not a requirement, and numeric addresses remain valid.

References SHALL be recognised only in program text — never inside a string
literal or a comment.

The saved program SHALL keep the names the user wrote. A program read back from
a machine's own file format holds addresses, not names, since that is what the
machine stores.

A shared program SHALL resolve its references against the blocks shared with it,
so a recipient runs the program the author wrote.

#### Scenario: A moved block keeps its callers working

- **WHEN** the user changes the address of a block their BASIC calls by name,
  and runs the program
- **THEN** the call reaches the block at its new address, with no edit to the
  BASIC

#### Scenario: A reference to a deleted block is reported

- **WHEN** the user deletes a block their BASIC still names
- **THEN** the reference is marked as an error where it appears, and the
  program is not built until it is resolved

#### Scenario: An address matching no block is only a warning

- **WHEN** the user's program calls a numeric address that is not any block's
  address
- **THEN** they are told it matches no block, and the program still runs

#### Scenario: A name inside a string is left alone

- **WHEN** the user's program prints text that contains what looks like a block
  reference
- **THEN** the text is printed as written

#### Scenario: A shared program resolves its own references

- **WHEN** a recipient opens a shared program whose BASIC names its blocks
- **THEN** it runs, resolving each name against the blocks that came with it
