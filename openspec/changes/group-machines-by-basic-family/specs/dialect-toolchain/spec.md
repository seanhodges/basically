## MODIFIED Requirements

### Requirement: Registered dialects are the available targets

The IDE SHALL offer exactly the set of registered dialects as target machines,
and every capability in this product (editing, running, exporting, AI
assistance) SHALL work against whichever dialect is active. The set SHALL be
presented the same way wherever a machine is chosen, so that switching the
target machine describes the machines as fully as starting a project does.
Presented the same way covers how the list may be narrowed and arranged as well
as how its machines are described, and the narrowing and the arrangement SHALL
be shared: choosing one while switching the target machine SHALL be what
starting a project then finds.

Every registered dialect SHALL declare the BASIC its machine runs, naming both
the version that machine runs and the family that version belongs to, so that
the machines can be arranged and searched by either without reading it out of
prose. Machines running different versions of one BASIC SHALL declare the same
family; machines whose BASICs are not versions of one another SHALL declare
different families, whatever their makers have in common.

The family SHALL NOT stand in for the version anywhere the version is what a
reader needs: a machine that declares a family still declares the version it
runs, and the two SHALL be separately readable.

Where the user is asked what should happen to their code, the question SHALL
state what travels with it and what does not, so that neither the work kept nor
the work discarded is a surprise. It SHALL describe only what the document
actually holds.

#### Scenario: Switching target

- **WHEN** the user selects a different target machine
- **THEN** the editor language, keyboard, emulator, samples, and export
  options all reflect the newly selected dialect

#### Scenario: Switching target describes the machines

- **WHEN** the user goes to switch the target machine
- **THEN** they are offered the same set of machines, described the same way and
  narrowed and arranged the same way, as when creating a project

#### Scenario: Narrowing the list in one place narrows it in the other

- **WHEN** the user narrows or rearranges the machine list while switching the
  target machine, and then opens it again while creating a project
- **THEN** the list is narrowed and arranged as they left it

#### Scenario: Every machine names its BASIC

- **WHEN** the machines are arranged by the BASIC they run
- **THEN** every registered machine appears under the name of a family of BASIC,
  and none is left unaccounted for

#### Scenario: A machine's version is readable alongside its family

- **WHEN** the user reads a machine that runs a later version of a BASIC other
  machines in its family run earlier versions of
- **THEN** the version that machine runs is named, and is not replaced by the
  name of its family

#### Scenario: Switching target still asks about the user's program

- **WHEN** the user switches the target machine while holding code that the new
  machine cannot take as it stands
- **THEN** they are still asked what should happen to that code before the
  switch is applied

#### Scenario: The question says what comes with the code

- **WHEN** the user is asked what should happen to their code, while the
  document holds memory blocks, scratch buffers, or files a run saved
- **THEN** the question states which of those come across with the code and
  which are discarded

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
