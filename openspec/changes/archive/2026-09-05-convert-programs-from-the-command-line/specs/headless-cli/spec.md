## ADDED Requirements

### Requirement: A machine's binary program file can be read back as BASIC

The user SHALL be able to turn a machine's own program file back into the BASIC
it holds, outside the browser. The machine SHALL be inferred from the file where
its format identifies it, and named by the caller where it does not; where more
than one registered machine could claim the same file, the operation SHALL
decline rather than guess, naming every machine that could. Anything the
conversion could not carry over — a warning the machine's own detokenizer
raises, a part of the file that is not BASIC, an auto-start line — SHALL be
reported rather than dropped silently.

#### Scenario: Converting a named binary file

- **WHEN** the user converts a file whose format belongs to exactly one
  registered machine, naming no machine
- **THEN** the file is read as that machine's BASIC and the source is returned

#### Scenario: A file more than one machine could claim

- **WHEN** the user converts a file whose format more than one registered
  machine can produce, naming no machine
- **THEN** the operation declines and names every machine the file could belong
  to, rather than choosing one

#### Scenario: Reporting what a conversion could not carry

- **WHEN** a converted file holds a warning its machine's detokenizer raises, a
  block that is not BASIC, or an auto-start line
- **THEN** the source is returned alongside a report of everything the
  conversion could not carry, rather than the source alone
