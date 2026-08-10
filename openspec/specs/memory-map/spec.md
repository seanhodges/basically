# memory-map Specification

## Purpose

Show the user where everything lives in the machine's memory: a colour-coded
picture of the whole address space that resolves into finer detail as they zoom
in, names each region the way the machine's own documentation names it, and marks
the addresses their program writes to.

## Requirements

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

### Requirement: Colour means the same thing on every machine

A region's colour SHALL be determined by what the region is for, not by which
machine is selected, so that ROM, screen memory, the BASIC program area and the
other region classes keep recognisably the same colour as the user switches
between machines.

Where a region resolves into sub-regions as the user zooms in, those sub-regions
SHALL be drawn as distinguishable shades of their group's colour, so that each
can be told apart from its neighbours while remaining visibly part of the same
group. Shading SHALL vary only the strength of the colour, never which colour it
is, so a sub-region can never be mistaken for a region of a different class.

#### Scenario: Switching machines keeps the colours

- **WHEN** the user changes the target machine with the memory map open
- **THEN** each class of region keeps the colour it had on the previous machine

#### Scenario: Sub-regions read as one family

- **WHEN** the user zooms in on a band that groups several regions
- **THEN** the sub-regions are drawn in shades of that group's colour, each
  distinguishable from the ones beside it

### Requirement: A machine's reference documentation shows its memory layout

Where the IDE describes a machine's memory layout, that machine's hardware
reference documentation SHALL show the layout, in the part of the page that
covers the machine's memory. The layout SHALL be readable with the same controls
the layout carries elsewhere in the product — how far it is zoomed, how much
detail it resolves into, and whether addresses read as hexadecimal or as plain
numbers — so that a reader learns one way of reading a layout and it holds
wherever they meet one.

Where the documentation covers several machines on one page, each machine SHALL
have its own layout shown with that machine's own material, because machines that
share a BASIC do not share a memory layout.

A machine whose layout the IDE does not describe SHALL have no layout shown on
its page, rather than a partial or guessed one.

#### Scenario: Reading a machine's layout in its reference documentation

- **WHEN** the user reads the hardware reference for a machine whose memory
  layout the IDE describes
- **THEN** the layout is shown where that page covers the machine's memory
- **AND** the user can zoom it, resolve it into finer regions, and switch how its
  addresses are written

#### Scenario: A page covering several machines

- **WHEN** the user reads a hardware reference page covering more than one
  machine
- **THEN** each machine's layout is shown with that machine's own material,
  rather than one layout standing for the page

#### Scenario: A machine with no described layout

- **WHEN** the user reads the hardware reference for a machine whose memory
  layout the IDE does not describe
- **THEN** no layout is shown, and the page's account of that machine's memory is
  otherwise unchanged

### Requirement: Layouts shown together are read independently

Where more than one memory layout is shown on a documentation page, each layout's
zoom, level of detail, address notation and selected region SHALL apply to that
layout alone. Changing how one layout is read SHALL NOT change how another is
read.

#### Scenario: Changing how one layout is read

- **WHEN** the user zooms, changes the detail of, or changes the address notation
  of one layout on a page showing several
- **THEN** only that layout changes, and the others stay as the user left them

#### Scenario: Selecting a region

- **WHEN** the user selects a region in one of the layouts
- **THEN** that layout reports the region, and no other layout on the page
  changes what it has selected
