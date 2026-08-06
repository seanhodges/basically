## ADDED Requirements

### Requirement: The comparison shows both machines' memory layouts

The comparison SHALL report where things live in each machine's memory by
showing both machines' memory layouts together, drawn against one shared
address scale so that a position in one is the same address as that position in
the other. It SHALL NOT report the two layouts at scales the reader has to
reconcile.

The controls over how the layouts are read — how far in they are zoomed, how
much detail they resolve into, and whether addresses read as hexadecimal or as
plain numbers — SHALL govern both layouts at once, so that the two are never
read at different settings.

Each region SHALL be named where it is drawn, so that what a colour means is
read off the layout itself and the comparison's key to its own colours is
neither extended nor contradicted by it.

#### Scenario: Reading the two layouts

- **WHEN** the user opens a comparison between two machines whose memory layouts
  the IDE describes
- **THEN** both layouts are reported against one shared address scale, and a
  given address is found at the same position in each

#### Scenario: Changing how the layouts are read

- **WHEN** the user changes how far the layouts are zoomed, how much detail they
  show, or how addresses are written
- **THEN** the change applies to both layouts, which stay readable at the same
  setting as each other

#### Scenario: Naming what is drawn

- **WHEN** the user reads a region of either layout
- **THEN** that region is named where it is drawn, rather than identified only
  by its colour

### Requirement: A machine with no described layout reports no layout

A memory layout the IDE cannot describe SHALL NOT be reported partially or
guessed at. Where either of the two chosen machines has no described memory
layout, the comparison SHALL report no memory layouts at all, and the section
SHALL be absent rather than shown with one side empty.

#### Scenario: One machine has no described layout

- **WHEN** the user chooses a machine whose memory layout the IDE does not
  describe, on either side of the comparison
- **THEN** no memory layouts are reported, and the section is absent rather than
  half-populated

#### Scenario: Both machines have a described layout

- **WHEN** both chosen machines have a described memory layout
- **THEN** both are reported

### Requirement: The memory layouts are narrowed to the program's own writes

Where the comparison is shown inside the IDE, and the user's own program is
therefore at hand, the memory layouts SHALL mark the addresses that program
writes to. On the machine being ported **from** these are the program's own
writes; on the machine being ported **to** they are where those same addresses
land, which is what tells a reader that a write aimed at one machine's system
variables reaches another machine's program text.

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

#### Scenario: An address that can only be approximated

- **WHEN** the program computes a write address the comparison cannot resolve
  exactly
- **THEN** the address is marked as approximate rather than reported as exact

#### Scenario: Reading the layouts with no program

- **WHEN** a user reads the comparison outside the IDE, or inside it with
  nothing written
- **THEN** both layouts are reported without marks, and are otherwise unchanged

### Requirement: The layouts stay comparable where there is no room for both

Two layouts side by side need width the reader does not always have. Where there
is not enough room to show both at once, the comparison SHALL offer them one at
a time, each reachable by a control naming the machine it shows, the machine
being ported from first and shown first.

Moving between them SHALL preserve how far they are zoomed, how much detail they
show, how addresses are written, and which part of the address space is in view,
so that moving from one to the other compares the same addresses on the two
machines rather than presenting two unrelated pictures.

#### Scenario: Not enough room for both

- **WHEN** the user reads the comparison where there is not enough width to show
  both layouts at once
- **THEN** the layouts are offered one at a time, each reachable by a control
  naming its machine, with the machine being ported from shown first

#### Scenario: Moving between the two layouts

- **WHEN** the user has zoomed in on part of the address space and moves to the
  other machine's layout
- **THEN** that layout is shown at the same zoom, the same level of detail, the
  same address notation, and the same part of the address space

#### Scenario: Reaching the layouts without a pointer

- **WHEN** the user moves between the layouts by keyboard alone
- **THEN** each can be reached and shown, and each is named by its machine

## MODIFIED Requirements

### Requirement: The language and hardware differences are ordered by what the port turns on

The language and hardware differences SHALL be reported in a fixed order that
does not vary with the pair chosen, running from the differences that decide how
much of the program must change to those that affect only a program that reads
or writes memory directly.

The differences that describe memory — how memory is written and how an address
is written — SHALL be reported together as one run rather than interleaved with
the language rules, so a reader needing them finds them in one place and a
reader who does not passes them in one step.

The addresses themselves SHALL NOT be reported among these differences. Where a
machine's memory layout is described, that layout reports its addresses, and
reporting them here as well would give one difference twice under two forms —
once as a pair of numbers and once as the picture that explains them. The run
therefore ends at how an address is written, and the layouts follow it.

#### Scenario: Reading the differences top to bottom

- **WHEN** the user reads the language and hardware differences from the top
- **THEN** the BASIC each machine runs, how it handles numbers, and how much
  program memory it has are reached before the rules that affect only how
  individual statements are written

#### Scenario: Finding the memory addresses

- **WHEN** the user looks for where the screen and the BASIC program live on
  each machine
- **THEN** they are found in the machines' memory layouts, and are not also
  reported among the language and hardware differences

#### Scenario: The order does not depend on the pair

- **WHEN** the user changes which machines are compared
- **THEN** the differences that are reported appear in the same relative order
  as before
