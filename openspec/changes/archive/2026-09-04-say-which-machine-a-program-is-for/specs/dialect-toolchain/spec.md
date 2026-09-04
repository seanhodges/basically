## ADDED Requirements

### Requirement: A program can declare the machine it is for

A listing SHALL be able to declare, on a line of its own, which registered
machine it is written for, naming that machine the same way machines are named
everywhere else in the product. A listing SHALL NOT be required to declare one,
and a listing without a declaration SHALL behave exactly as it does today.

The declaration SHALL NOT be part of the program. It SHALL contribute no bytes on
any registered machine, SHALL NOT count against the memory a program may occupy,
and SHALL never reach the machine. Every path that turns a listing into bytes —
running it, exporting it, sharing it, checking it, and reporting how large it is
— SHALL honour the declaration identically, so that a program cannot behave one
way for the person who wrote it and another way for anyone they give it to.

A declaration the product cannot honour SHALL be reported as a problem at the
line and column of the fault, in the same way as any other problem with the
listing: naming a machine that is not registered, naming no machine at all, and
declaring a machine twice. A listing SHALL carry at most one declaration.

Where the declaration is honoured, problems reported about the rest of the
listing SHALL be positioned against the listing as the user wrote it, not as it
was read.

#### Scenario: Declaring a machine

- **WHEN** the user writes a listing that declares a registered machine and runs,
  exports or checks it without saying which machine to use
- **THEN** it is read as that machine's program

#### Scenario: The declaration costs nothing

- **WHEN** the same program is turned into bytes with and without its declaration
- **THEN** the bytes are identical, and the size reported against the machine's
  free memory is the same

#### Scenario: A declaration naming no such machine

- **WHEN** a listing declares a machine that is not registered
- **THEN** the problem is reported at the line and column of the name, and the
  listing is not read as some other machine's program

#### Scenario: Two declarations

- **WHEN** a listing declares a machine twice
- **THEN** the second is reported as a problem, rather than one of them silently
  taking effect

#### Scenario: A problem after the declaration

- **WHEN** a listing declares a machine and a later line has a problem
- **THEN** that problem is reported at the line the user sees it on

### Requirement: The declared machine and the active target stay one answer

Where the product has an active target machine of its own and the document also
declares one, the two SHALL be kept in agreement rather than allowed to
contradict each other: opening a document that declares a machine SHALL make that
machine the active target, and changing the active target SHALL update the
document's declaration.

Changing the active target SHALL NOT add a declaration to a document that has
none, so that a document the user has never declared anything in is not silently
altered.

#### Scenario: Opening a document that declares a machine

- **WHEN** the user opens a program declaring a machine other than the active
  target
- **THEN** the target becomes the declared machine, and the document is not left
  claiming one machine while being edited as another

#### Scenario: Switching the target with a declaration present

- **WHEN** the user switches the target machine while the document declares one
- **THEN** the declaration names the machine switched to

#### Scenario: Switching the target with no declaration present

- **WHEN** the user switches the target machine while the document declares
  nothing
- **THEN** the document still declares nothing
