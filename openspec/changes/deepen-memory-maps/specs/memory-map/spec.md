## ADDED Requirements

### Requirement: The memory map accounts for the whole machine

Where the IDE offers a memory map for a machine, that map SHALL describe the
machine's entire address space, with every address belonging to exactly one
region - no gap, no overlap, and no address the map cannot explain. A machine
whose layout the IDE cannot describe SHALL NOT offer the map at all, rather than
offer an incomplete one.

#### Scenario: Every address belongs to a region

- **WHEN** the user opens the memory map on any machine that offers it
- **THEN** the bands run unbroken from the lowest address to the highest
- **AND** selecting any address in the map identifies the region containing it

#### Scenario: A machine without a described layout hides the map

- **WHEN** the active machine has no memory map
- **THEN** the memory-map entry point is not offered for that machine

### Requirement: Zooming in reveals the machine's own subdivisions

A map SHALL resolve into finer regions as the user zooms in, and the finer
regions SHALL be the ones the machine's own documentation and firmware
distinguish rather than an arbitrary subdivision. Zooming back out SHALL restore
exactly the coarser regions the map opened with, so the level of detail is the
user's choice and never changes what the machine is said to contain.

#### Scenario: A coarse band opens into its parts

- **WHEN** the user zooms in past the detail threshold on a band that groups
  several regions
- **THEN** the band is replaced by the regions it groups, each separately
  labelled and selectable

#### Scenario: Zooming out is lossless

- **WHEN** the user zooms back out after zooming in
- **THEN** the map shows the same bands, with the same names and extents, as when
  it opened

### Requirement: Regions are named as the machine's documentation names them

Each region SHALL carry the term the machine's manual, firmware guide or
canonical ROM disassembly uses for that area, so that a user can search a
region's name in the machine's own documentation and find the same thing. Where
an area has no documented name, the map SHALL say that it is undocumented rather
than present an invented name as authoritative.

#### Scenario: A region is searchable in the machine's manual

- **WHEN** the user reads a region's name and looks it up in that machine's
  documentation
- **THEN** the documentation describes the same area of memory

#### Scenario: An undocumented area is marked as such

- **WHEN** the user selects a region covering an area the machine's documentation
  does not name
- **THEN** the region's explanation states that the area is undocumented, rather
  than asserting a purpose for it
