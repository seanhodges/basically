## ADDED Requirements

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
