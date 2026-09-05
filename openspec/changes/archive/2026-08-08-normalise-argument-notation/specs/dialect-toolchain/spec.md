## ADDED Requirements

### Requirement: The language reference describes arguments one way

Every BASIC reference page SHALL describe the arguments a command, function or
operator takes in one shared notation: one vocabulary of argument names, and one set
of rules for marking which arguments are optional, which alternatives are accepted,
which parts repeat, and which parts are the literal text the user types. A reader who
has learned to read one dialect's page SHALL be able to read every other dialect's
page without relearning.

Where two machines take the same argument in the same position, both pages SHALL
describe it identically, so that any visible difference between two pages is a
difference between the two BASICs rather than between the two pages.

Where a command's arguments mean materially different things — a sound channel and a
pitch, a screen coordinate and a colour, an address and the byte stored at it — each
argument SHALL be named for what it is, rather than all of them being named for their
shared type. A reader SHALL be able to tell which argument is which from the reference
entry alone, without inferring it from the description or from a hardware page.

#### Scenario: Reading the same command on two machines

- **WHEN** the user consults the reference entry for a command that two machines both
  provide, and both machines take the same arguments
- **THEN** both pages describe those arguments identically

#### Scenario: A command whose arguments mean different things

- **WHEN** the user consults the reference entry for a command taking several arguments
  of the same type but with different meanings
- **THEN** each argument is named for its meaning, and the reader can tell which
  position carries which

#### Scenario: Meeting an unfamiliar argument name

- **WHEN** the user meets an argument name they do not recognise on a reference page
- **THEN** that page states what it means, for every argument name that page uses, and
  states nothing for names it does not use

#### Scenario: Learning how the notation itself works

- **WHEN** the user wants to know what the optional, alternative, repetition and
  literal markings mean
- **THEN** that is explained once and reachable from every dialect's reference page

#### Scenario: A machine's real syntax outranks the notation

- **WHEN** a machine genuinely requires a punctuation, spacing or literal form that the
  shared notation would otherwise smooth away
- **THEN** the reference entry shows what the machine actually requires
