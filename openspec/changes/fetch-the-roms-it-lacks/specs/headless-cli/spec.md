## MODIFIED Requirements

### Requirement: Only running a machine requires its ROM

Describing machines, describing one machine, checking a program and building a
program SHALL all work without any ROM being present, so that an installation
carrying no ROMs is still useful for everything but running. Running a machine
SHALL let the user say where ROMs are read from, rather than only ever reading them
from where the product was installed.

Where the user has said where ROMs are read from, or the installation already
carries them, the tool SHALL read them from there and SHALL obtain nothing.
Otherwise it SHALL be able to obtain a machine's ROM from where the product
publishes them, keep what it obtained for later runs, and prefer what it has
kept over what the installation carries.

#### Scenario: Working without ROMs

- **WHEN** the user lists machines, describes one, checks a program or builds a
  program on an installation with no ROMs present
- **THEN** each operation succeeds, and reports no ROM as missing because none was
  needed

#### Scenario: An installation that already carries the ROM

- **WHEN** the user runs a machine on an installation that carries its ROM, or
  says where ROMs are read from
- **THEN** the run reads that ROM, nothing is obtained, and the user is asked
  nothing

#### Scenario: A ROM obtained once is kept

- **WHEN** the user runs a machine whose ROM was obtained by an earlier run
- **THEN** the run uses what was kept, and obtains nothing again

### Requirement: Driving a machine requires its ROM

A run given a schedule SHALL require the machine's ROM to be present, and SHALL
refuse a machine whose ROM is absent as the caller's mistake before any action is
taken. A run given no schedule SHALL keep reporting a missing ROM as a condition
of the run rather than refusing.

Refusing SHALL say what the user can do about it, naming the ways a ROM is
obtained and agreed to, so the refusal is not a dead end.

#### Scenario: Driving without the ROM

- **WHEN** the user runs a program with a schedule on a machine whose ROM is not
  present
- **THEN** the run is refused as the caller's mistake, saying the ROM is missing
  and how one is obtained, and no action is carried out

### Requirement: Checking a program requires its ROM

Checking a program SHALL require the machine's ROM to be present, and SHALL
refuse a machine whose ROM is absent as the caller's mistake before any action is
taken — a verdict from a machine that ran nothing would say nothing about the
program.

Refusing SHALL say what the user can do about it, naming the ways a ROM is
obtained and agreed to, so the refusal is not a dead end.

#### Scenario: Checking without the ROM

- **WHEN** the user checks a program on a machine whose ROM is not present
- **THEN** the check is refused as the caller's mistake, saying the ROM is
  missing and how one is obtained, and no action is carried out

## ADDED Requirements

### Requirement: Obtaining a ROM is agreed to first

The tool SHALL NOT obtain any ROM image until the user has agreed to it, and
SHALL ask only where it would otherwise have no ROM to run — never on an
installation that already carries one, never for an operation that needs none,
and never where the tool has nowhere to obtain one from. Asking SHALL say what would be obtained, where it would be kept, and where
the terms those images travel on are set out, so the user is agreeing to
something they can read first.

The agreement SHALL be remembered, and SHALL cover every later machine and every
later run rather than being asked again for each. Declining SHALL NOT be an
error: the run SHALL carry on exactly as it does on an installation with no ROM,
so a user who says no is no worse off than before they were asked.

#### Scenario: Asked before the first ROM is obtained

- **WHEN** the user runs a machine whose ROM the installation does not carry and
  has not been agreed to before
- **THEN** the user is asked before anything is obtained, and is told what would
  be obtained, where it would be kept, and where the terms are set out

#### Scenario: Agreeing once covers later runs

- **WHEN** the user has agreed, and later runs a different machine whose ROM is
  not yet held
- **THEN** that ROM is obtained without asking again

#### Scenario: Declining leaves the run as it was

- **WHEN** the user is asked and declines
- **THEN** nothing is obtained, and the run behaves exactly as it does with no
  ROM present — reporting the missing ROM as a condition of the run, or refusing
  where a schedule or a check required it

#### Scenario: An installation with nowhere to obtain images from

- **WHEN** the tool was built without being told where the set is published, and
  the user runs a machine whose ROM the installation does not carry
- **THEN** the user is not asked, nothing is obtained, and the run behaves as it
  does when the question was declined

#### Scenario: Asking for images with nowhere to obtain them from

- **WHEN** the tool was built without being told where the set is published, and
  the user asks for the ROMs to be obtained
- **THEN** the tool says it has no publisher and how one is named, rather than
  reporting a download that failed

### Requirement: A caller with no terminal is never left waiting

A caller that cannot be asked — a program driving the tool, a scheduled build,
an editor or agent served over a protocol — SHALL NOT be blocked on a question
it has no way to answer. The user SHALL be able to agree in advance, both as a
setting the tool is started with and as an action of its own that records the
agreement and returns.

Where no agreement has been given and there is no one to ask, the tool SHALL
say so promptly and SHALL treat it as the caller's mistake rather than waiting,
naming both ways of agreeing in advance.

#### Scenario: Agreed in advance

- **WHEN** a caller that cannot be asked runs a machine whose ROM is not held,
  having agreed in advance
- **THEN** the ROM is obtained without any question, and the run proceeds

#### Scenario: Nobody to ask

- **WHEN** a caller that cannot be asked runs a machine whose ROM is not held,
  with no agreement given
- **THEN** the tool does not wait, and says how to agree in advance

### Requirement: An obtained ROM set is kept current

Once the user has agreed, the tool SHALL keep what it obtained current without
asking again, so that a machine added after the user agreed brings its ROM with
it and an image the publisher withdraws stops being kept. It SHALL check for
changes no more than occasionally rather than on every run, and the user SHALL
be able to ask for a check at any time rather than waiting for the next one.

Keeping current SHALL NOT be able to fail a command: where the check cannot be
made or cannot be trusted, the tool SHALL carry on with what it already holds
and SHALL say nothing about it in the command's own answer.

#### Scenario: A machine added later

- **WHEN** a machine the tool did not previously know about is registered, and
  the tool next checks for changes
- **THEN** its ROM is obtained without the user being asked again

#### Scenario: Not waiting for the next check

- **WHEN** the user asks for the ROMs to be obtained rather than waiting for the
  next check
- **THEN** the publisher is asked at once, and anything new is obtained

#### Scenario: A withdrawn image

- **WHEN** the publisher withdraws an image and the tool next checks
- **THEN** the tool stops keeping that image

#### Scenario: Checking when the publisher cannot be reached

- **WHEN** the tool would check for changes but cannot reach the publisher
- **THEN** the command runs on what is already held, succeeds or fails on its own
  terms, and reports nothing about the check

#### Scenario: An image that is not what it should be

- **WHEN** an obtained image does not match what the publisher says it should be
- **THEN** it is not kept, and nothing already held is disturbed

### Requirement: The user can ask about, obtain and discard ROMs directly

The user SHALL be able to ask where the tool is reading ROMs from and why, where
the published set would be obtained from or that this build names nowhere, which
machines it holds an image for, and when it last checked for changes; to agree
and to obtain the set in one deliberate action rather than as a side effect of a
run; and to discard everything it has obtained.

#### Scenario: Asking where ROMs come from

- **WHEN** the user asks about ROMs
- **THEN** the tool reports which source it would read from and why that one,
  what it holds, and when it last checked

#### Scenario: Obtaining deliberately

- **WHEN** the user asks for the ROMs to be obtained
- **THEN** the tool asks for agreement if it does not have it, checks for changes
  whether or not one was due, and obtains what is missing or changed

#### Scenario: Discarding

- **WHEN** the user asks for what was obtained to be discarded
- **THEN** the tool holds no obtained images afterwards, and a later run asks
  before obtaining them again only if the agreement was discarded too
