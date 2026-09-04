## ADDED Requirements

### Requirement: A program's behaviour can be checked against a written expectation

The user SHALL be able to run a program against a written expectation — the
same actions a schedule may hold, together with expectations that named text is
on the screen, that named text is not on the screen, that the program has
stopped, or that it is still running — and receive a pass or a failure. The
check SHALL pass only when every action is carried out and every expectation
holds. It SHALL fail at the first that does not, and SHALL report which
expectation or action it was, by its line, what was expected, and what the
screen actually held at that moment. A failure SHALL count as the program's
failure, distinct from an expectation the tool cannot read, which SHALL be the
caller's mistake and refused before the machine is started. The verdict SHALL
be available as structured data on request.

#### Scenario: An expectation that holds

- **WHEN** the user tests a program against an expectation whose every action
  succeeds and whose every expectation holds
- **THEN** the test passes

#### Scenario: An expectation that does not hold

- **WHEN** the user tests a program against an expectation that names text the
  program never prints
- **THEN** the test fails, reporting that expectation by its line and the text
  expected, shows the screen as it stood, and exits with the outcome reserved
  for a program at fault

#### Scenario: A verdict read by a program

- **WHEN** a caller asks for the verdict as structured data
- **THEN** standard output holds the verdict, every step and how it went, the
  failing step where there was one, and the screen, and nothing else

### Requirement: Testing a program requires its ROM

A test SHALL require the machine's ROM to be present, and SHALL refuse a machine
whose ROM is absent as the caller's mistake before any action is taken — a
verdict from a machine that ran nothing would say nothing about the program.

#### Scenario: Testing without the ROM

- **WHEN** the user tests a program on a machine whose ROM is not present
- **THEN** the test is refused as the caller's mistake, saying the ROM is
  missing, and no action is carried out
