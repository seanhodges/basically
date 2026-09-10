## ADDED Requirements

### Requirement: Colour covers all of what was asked about

The colour the server reports for a program SHALL cover the whole of what the
editor asked about: all of the program when the editor asked about the program,
and all of a range when it asked about a range. A program's length SHALL NOT
change how much of it is reported — only how much there is to report.

The server SHALL NOT report colour for part of a program as though it were the
answer for all of it. Where the server cannot report the whole of what was asked
about, it SHALL decline rather than answer for a part, so that an editor is never
told that a run of characters has no kind when the server simply did not reach it.

This holds however busy the machine serving the editor is, and however many times
the same program is asked about: asking twice SHALL NOT produce a fuller answer
than asking once, because the first answer SHALL already be complete.

#### Scenario: A listing longer than one screen

- **WHEN** the editor asks about a program far longer than the few kilobytes an
  editor shows at once
- **THEN** every run of characters in it is reported, to its last line

#### Scenario: The same program asked about twice

- **WHEN** the editor asks about an unchanged program a second time
- **THEN** it is told exactly what it was told the first time, neither less nor
  more

#### Scenario: A range near the end of a long program

- **WHEN** the editor asks about a range at the end of a program far longer than
  one screen
- **THEN** that range is reported in full, on the same terms as a range at the
  start

#### Scenario: A machine under load

- **WHEN** the program is asked about while the machine serving the editor is
  busy with other work
- **THEN** the answer covers the same runs it would have covered on an idle
  machine
