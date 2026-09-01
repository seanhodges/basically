## ADDED Requirements

### Requirement: The language reference is organised by BASIC family

The language reference SHALL carry one page per family of BASIC rather than one
page per machine, so that machines running versions of one BASIC are read
together. Every registered machine SHALL read from the page of the family it
declares, and every page SHALL be the page of a family some registered machine
declares — the reference SHALL offer no page no machine reads from, and leave no
machine without one.

A page SHALL be titled by the name of the family it covers, and SHALL name the
machines it covers and the version each of them runs, so that a reader arriving
at a family page can tell which of its material applies to the machine they are
using.

Where a page's material belongs to only some of its machines, it SHALL say which
— a machine SHALL NOT be offered a keyword, a control code or a hardware figure
that belongs to a relative it shares the page with.

Reorganising the reference SHALL NOT strand a reader who arrives at where a page
used to be: a moved page SHALL leave its former address reachable and pointing at
the page that replaced it.

#### Scenario: Machines running one BASIC share its page

- **WHEN** the user consults the language reference for a machine that runs a
  version of a BASIC other registered machines also run
- **THEN** one page covers that BASIC, naming each machine that runs it and the
  version each runs

#### Scenario: A BASIC that is not a version of another keeps its own page

- **WHEN** the user consults the language reference for a machine whose BASIC is
  not a version of any other registered machine's BASIC
- **THEN** that BASIC has its own page, whatever it shares with other machines
  by maker or by ancestry

#### Scenario: Every machine is reachable and no page is empty

- **WHEN** the user reads the list of BASICs the language reference covers
- **THEN** every registered machine is accounted for under one of them, and each
  page listed is read from by at least one registered machine

#### Scenario: Material only some of a page's machines have

- **WHEN** the user reads a family page covering their machine and a relative
  that has a keyword or a control code their machine does not
- **THEN** that material is marked as the relative's, rather than read as the
  page's

#### Scenario: Arriving at a page that has moved

- **WHEN** the user follows a link to the address a reference page used to have
- **THEN** they reach the page that now covers that machine's BASIC, rather than
  a missing page
