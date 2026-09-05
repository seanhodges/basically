## RENAMED Requirements

- FROM: `### Requirement: The command line offers what the assistant offers`
- TO: `### Requirement: Every caller of this toolchain offers what the others offer`

## MODIFIED Requirements

### Requirement: Every caller of this toolchain offers what the others offer

Every operation any caller of this toolchain can perform on a program or a
machine SHALL be reachable from every other caller. No caller SHALL gain a
capability another silently lacks.

Parity is of capability, not of invocation. How a caller reaches an operation
MAY differ, because their circumstances differ: an invocation of the command
line holds no machine between runs, so what a caller that is holding a machine
asks of that machine, the command line asks of a run — as an option on that run
or as an action within it. What SHALL be equal is what can be asked, not how it
is spelled.

Where a caller deliberately lacks an operation, that absence SHALL be declared
together with the reason for it, so that an asymmetry is a decision on record
rather than something discovered by trying. A declared absence SHALL stop being
declared once it stops being true, so the record cannot decay into a list of
things nobody rechecked.

A reason SHALL be particular to the caller it is claimed of. An absence which
holds because of the circumstances one caller works in SHALL NOT be carried over
to a caller those circumstances do not describe, so that adding a caller widens
what is offered rather than inheriting what was withheld.

#### Scenario: An operation one caller gains

- **WHEN** an operation becomes available to one caller
- **THEN** the same capability is reachable from every other caller, whether as
  an operation of its own, as an option on running a program, or as an action
  within a run

#### Scenario: A caller that is added

- **WHEN** a new caller of the toolchain is added
- **THEN** every operation is reachable from it, or is declared as one it
  deliberately lacks, with the reason stated

#### Scenario: An absence that does not travel

- **WHEN** an operation is declared absent from one caller, and another caller is
  added whose circumstances that reason does not describe
- **THEN** the operation is reachable from the new caller, and the existing
  absence stands only where its reason holds

#### Scenario: An asymmetry that is intended

- **WHEN** an operation is deliberately not offered to one of the callers
- **THEN** that absence is declared, and the reason for it is stated

#### Scenario: An asymmetry that stops being true

- **WHEN** an operation previously declared unavailable to a caller becomes
  available to it
- **THEN** it is no longer declared as unavailable
