## ADDED Requirements

### Requirement: A program's behaviour can be checked against a written expectation

The user SHALL be able to run a program against a written expectation — the same
actions a schedule may hold, together with expectations that named text is on the
screen, that named text is not on the screen, that the program has stopped, that
it is still running, or that a named variable holds a named value — and receive a
pass or a failure.

The check SHALL pass only when every action is carried out and every expectation
holds. It SHALL fail at the first that does not, and SHALL report which
expectation or action it was, by its line, what was expected, and what the screen
actually held at that moment. A failure SHALL count as the program's failure,
distinct from an expectation the tool cannot read, which SHALL be the caller's
mistake and refused before the machine is started.

An expectation that could not be evaluated SHALL be reported as unevaluated
rather than as passed or as failed, and SHALL NOT be folded into the verdict as
though it had held. An expectation whose form only the assistant can settle SHALL
be reported this way rather than refused, so that one file of expectations can be
written for either caller.

The verdict SHALL be available as structured data on request.

#### Scenario: An expectation that holds

- **WHEN** the user checks a program against a file whose every action succeeds
  and whose every expectation holds
- **THEN** the check passes

#### Scenario: An expectation that does not hold

- **WHEN** the user checks a program against an expectation that names text the
  program never prints
- **THEN** the check fails, reporting that expectation by its line and the text
  expected, shows the screen as it stood, and exits with the outcome reserved for
  a program at fault

#### Scenario: An expectation about a variable

- **WHEN** the user checks a program against an expectation naming a variable and
  the value it should hold
- **THEN** the check reports whether that variable holds that value

#### Scenario: An expectation nothing here can settle

- **WHEN** a file of expectations contains one that only the assistant can judge
- **THEN** it is reported as unevaluated, and the check neither passes nor fails
  on account of it

#### Scenario: A file that cannot be read

- **WHEN** the user checks a program against a file holding a line the parser
  cannot understand
- **THEN** it is refused as the caller's mistake before any machine is started

#### Scenario: A verdict read by a program

- **WHEN** a caller asks for the verdict as structured data
- **THEN** standard output holds the verdict, every step and how it went, the
  failing step where there was one, and the screen, and nothing else

### Requirement: Checking a program requires its ROM

Checking a program SHALL require the machine's ROM to be present, and SHALL
refuse a machine whose ROM is absent as the caller's mistake before any action is
taken — a verdict from a machine that ran nothing would say nothing about the
program.

#### Scenario: Checking without the ROM

- **WHEN** the user checks a program on a machine whose ROM is not present
- **THEN** the check is refused as the caller's mistake, saying the ROM is
  missing, and no action is carried out
