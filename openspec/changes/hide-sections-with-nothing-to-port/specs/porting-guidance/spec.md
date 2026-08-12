## ADDED Requirements

### Requirement: A section with nothing to port is not shown

Narrowing the comparison to the open program is a promise that what remains is
the work that program needs. A section that has narrowed down to nothing breaks
the promise while appearing to keep it: it costs a heading to read and a count
to interpret before it says that nothing is being asked, and a page of those
reads like the comparison that was never narrowed at all.

Where the comparison is narrowed to the user's program, a section with nothing
in it for the reader SHALL NOT be shown — not as a heading, not as a count of
zero, not as a sentence reporting its own emptiness.

What holds a section open is content the reader must act on or be told about.
Content that only reports what the target adds where the port loses nothing
SHALL NOT hold a section open, being news rather than work; the comparison
already leaves it out by default. Content the reader must be told about SHALL
hold a section open even where nothing in the program's text changes, because
a difference that leaves the program looking correct is the one the reader
cannot find unaided.

Where the comparison is not narrowed to a program it is the whole comparison of
the two machines, and every section that has anything to report SHALL still be
shown: the reader has asked about the machines rather than about a program, and
a section reporting no difference is then an answer.

#### Scenario: A program with no commands to rewrite

- **WHEN** the comparison is narrowed to a program that uses no command the
  target makes the user rewrite or remove
- **THEN** the section reporting commands to rewrite is absent, rather than
  present reporting none

#### Scenario: A program with no control codes to replace

- **WHEN** the comparison is narrowed to a program with no control code the
  target cannot express, and the target adds control codes the program never
  used
- **THEN** the section reporting control codes is absent, rather than present
  reporting that no code needs replacing

#### Scenario: A difference the program's text does not show

- **WHEN** the comparison is narrowed to a program that has nothing to replace
  in a section, but uses something that keeps its spelling on the target and
  means something else
- **THEN** the section is shown, reporting what changed meaning

#### Scenario: The comparison is not narrowed

- **WHEN** no program is open, or the open program cannot be read as the source
  machine's BASIC
- **THEN** every section with something to report is shown, as it is for a
  comparison of the two machines

#### Scenario: Asking to see what the target adds

- **WHEN** a section holds nothing but what the target adds and the program
  never used, and the user turns on the control that reports those
- **THEN** the section is shown, reporting them

## MODIFIED Requirements

### Requirement: What the target adds and the program never used can be filtered out

What the target offers where the port loses nothing is the one part of the comparison that is not
work the port requires. The comparison SHALL leave it out by default — both the capabilities with
nothing to replace and the control codes the target adds — and SHALL offer a control that reports
it, with what is being left out stated so the control can be found. What the target offers in a
capability the port *does* lose commands from is the advice for replacing them, and SHALL NOT be
left out by this control.

The control and the statement of what it is holding back SHALL be offered once for the comparison,
covering every section they govern, and SHALL be reachable whatever those sections are currently
reporting. A control offered only from inside the sections it filters is a control that goes away
with them, at exactly the point where nothing else on the page reports that the filtered content
exists.

#### Scenario: The default view

- **WHEN** the user opens a comparison
- **THEN** the capabilities the target only adds to and the control codes it adds are absent, and
  the comparison states how many capability areas are being left out

#### Scenario: Asking to see them

- **WHEN** the user turns the control on
- **THEN** the capabilities the target only adds to, and the control codes it adds, are reported

#### Scenario: Advice for a capability that loses commands is never hidden

- **WHEN** the control is off and the port loses commands from a capability the target also adds to
- **THEN** what the target offers in that capability is still reported with the commands lost from
  it

#### Scenario: Every section the control governs is holding nothing else

- **WHEN** the control is off and every section it governs has nothing to report but what the
  target adds
- **THEN** the control and the statement of what it is holding back are still offered, and turning
  it on reports the additions
