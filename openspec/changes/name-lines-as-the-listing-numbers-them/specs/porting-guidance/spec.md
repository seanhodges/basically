## ADDED Requirements

### Requirement: The program's lines are named as its listing numbers them

A finding that names a line of the reader's own program is naming it so that
the reader can find it, and what they have in front of them is a listing —
whose lines are numbered by the program, not counted by the editor. The two
numberings agree only for a program written from its lowest line in steps of
one with nothing blank between; for every other program an editor count names a
line that exists and is the wrong one, which reads as an answer rather than as
a mistake.

Wherever the comparison names a line of the program being ported, it SHALL name
it by the line number the program itself carries, in every place a line is
named — the narrowed findings and the same findings handed to the assistant
alike, since one program discussed in two numberings is a program the reader
has to reconcile.

A line carrying no number of its own SHALL NOT be named: there is nothing in
the listing to match it against, and the machines refuse such a program in any
case.

#### Scenario: A program not numbered from one in steps of one

- **WHEN** the comparison reports a finding against a line of a program whose
  line numbers do not match its position in the editor
- **THEN** the line is named by the number the program carries, which is the
  number its listing shows

#### Scenario: The same finding handed to the assistant

- **WHEN** the same finding is carried into a request to convert the program
- **THEN** it names the line by the same number the comparison named it by
