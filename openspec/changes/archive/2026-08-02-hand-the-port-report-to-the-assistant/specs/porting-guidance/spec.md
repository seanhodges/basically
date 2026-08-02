## MODIFIED Requirements

### Requirement: Carrying out the port targets the machine chosen

Where the comparison offers to carry the port out, it SHALL convert the program
for the machine the user selected as the target.

Carrying the port out SHALL additionally hand the assistant what the comparison
worked out for this program: the machine being ported from and the BASIC it runs,
the commands the program uses that the target lacks together with any advice
written for them, the commands to rename, the commands whose behaviour differs,
the commands that mean something different under the same name, the control codes
that must change, and the guidance specific to this pair and this target.

What is handed over SHALL be narrowed to the program being converted, as the
comparison's own report is, so it describes this port rather than the two
machines in general.

#### Scenario: Converting to a specific machine

- **WHEN** the user selects a machine as the target and asks for the port to be
  carried out
- **THEN** the program is converted for that machine, and the IDE continues on
  that machine

#### Scenario: Converting to a machine that shares a BASIC with a relative

- **WHEN** the user selects a machine whose BASIC a close relative also runs,
  and asks for the port to be carried out
- **THEN** the program is converted for the machine selected, not for its
  relative

#### Scenario: The port is carried out with the differences reported

- **WHEN** the user asks for the port to be carried out
- **THEN** the assistant is given the differences the comparison reported for
  this program, rather than only the name of the target machine

#### Scenario: Differences the program does not touch

- **WHEN** the comparison has reported differences for commands the program does
  not use
- **THEN** those are not handed over, because they are not work this port
  requires

### Requirement: Carrying out the port is offered only where there is a program

Where the comparison is shown inside the IDE, and the user's own program is
therefore at hand, the comparison SHALL additionally offer to convert that
program to the target dialect using the AI assistant. Where the comparison is
read on its own, outside the IDE, that offer SHALL be absent and every other
part of the comparison SHALL be unaffected — the assistant is an extra for the
user who has a program to convert, never a condition of the guidance.

Accepting the offer SHALL switch the IDE to the target machine keeping the
current program, and ask the assistant to translate it: preserving behaviour
where the target machine allows, and reporting what could not be ported.
Accepting it with no assistant configured SHALL take the user to configure one,
rather than appearing to do nothing.

Accepting it with nothing written, or with a program that cannot be read as a
program in the language being ported from, SHALL NOT convert. The user SHALL be
told what the problem is, and the machine and the program SHALL be left as they
were. A port carried out for a program the comparison could not read is
guesswork wearing the authority of the comparison's findings, which is worse
than declining the work and saying so.

#### Scenario: Converting the open program

- **WHEN** a user reading the comparison inside the IDE, with an assistant
  configured, asks for their program to be converted to the target dialect
- **THEN** the IDE switches to the target machine with the program kept, and the
  assistant is asked to translate it to that dialect

#### Scenario: Reading the comparison outside the IDE

- **WHEN** a user opens the comparison on its own, outside the IDE
- **THEN** no offer to convert a program is made, and the rest of the comparison
  and its guidance are unchanged

#### Scenario: Asking to convert with no assistant configured

- **WHEN** a user inside the IDE asks for their program to be converted, having
  configured no assistant
- **THEN** they are taken to configure one, and the machine and program are left
  as they were

#### Scenario: Asking to convert with nothing written

- **WHEN** a user inside the IDE asks for their program to be converted with
  nothing written in the editor
- **THEN** no conversion is attempted, they are told there is no program to
  convert, and the machine and program are left as they were

#### Scenario: Asking to convert a program that cannot be read

- **WHEN** a user inside the IDE asks for their program to be converted, and the
  program has errors that prevent it being read as a program at all in the
  language being ported from
- **THEN** no conversion is attempted, they are told the program cannot be read,
  and the machine and program are left as they were
