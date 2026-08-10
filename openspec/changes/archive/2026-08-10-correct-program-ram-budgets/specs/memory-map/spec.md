## MODIFIED Requirements

### Requirement: The memory map accounts for the whole machine

Where the IDE offers a memory map for a machine, that map SHALL describe the
machine's entire address space, with every address belonging to exactly one
region - no gap, no overlap, and no address the map cannot explain. A machine
whose layout the IDE cannot describe SHALL NOT offer the map at all, rather than
offer an incomplete one.

Addressing a range is not the same as holding memory in it. Where a machine's
configuration leaves part of its address space unpopulated, the map SHALL show
that range as unfitted rather than as memory the program may use, so that the
span the map presents as the program's own is the span the program actually has.

#### Scenario: Every address belongs to a region

- **WHEN** the user opens the memory map on any machine that offers it
- **THEN** the bands run unbroken from the lowest address to the highest
- **AND** selecting any address in the map identifies the region containing it

#### Scenario: A machine without a described layout hides the map

- **WHEN** the active machine has no memory map
- **THEN** the memory-map entry point is not offered for that machine

#### Scenario: Address space the machine does not populate

- **WHEN** the user opens the memory map on a machine whose configuration leaves
  part of its address space empty
- **THEN** that part is shown as unfitted, and the region the map marks as the
  BASIC program's own stops where the machine's memory does
