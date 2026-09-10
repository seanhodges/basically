## MODIFIED Requirements

### Requirement: Completion offers what the machine understands

The server SHALL offer completions drawn from the bound machine's own keywords,
the block constructs that machine has, and the variables the program has in scope
at that point. It SHALL offer nothing the machine does not have, and SHALL NOT
offer completions inside a string literal.

A completion SHALL carry what the product knows about it — how the keyword is
written and what it does — so that the editor can show it beside the name. A
completion SHALL say which of these it is, so that an editor showing a kind
beside each one distinguishes a variable the program declared from a keyword the
machine has. A completion for a block construct SHALL insert the whole construct,
with the places the user must fill in offered in order. On a machine whose ROM
matches keywords greedily without needing spaces between them, a completion
accepted part way through such a run SHALL replace the part the user meant and
not the whole run — and where what the user meant differs between a keyword and a
variable, each completion SHALL replace what it was offered for.

#### Scenario: Completing a keyword

- **WHEN** the user begins typing a keyword
- **THEN** the editor offers that machine's keywords beginning that way, each with
  what it does, and offers no keyword that machine lacks

#### Scenario: Completing a block construct

- **WHEN** the user accepts a completion for a construct that spans several lines
- **THEN** the whole construct is inserted and the user is offered each place to
  fill in, in order

#### Scenario: Completing a variable in scope

- **WHEN** the user begins typing a name in a program that already uses variables
- **THEN** the editor offers the names in scope at that point, marked as
  variables, alongside the machine's own keywords

#### Scenario: A variable out of scope

- **WHEN** the program defines a procedure with names local to it, and the user
  is typing outside that procedure
- **THEN** those local names are not offered

#### Scenario: Inside a string

- **WHEN** the cursor is inside a string literal
- **THEN** no keyword completion is offered

#### Scenario: A variable name inside a string

- **WHEN** the cursor is inside a string literal in a program that uses variables
- **THEN** no variable is offered either

### Requirement: A keyword explains itself where it is written

The server SHALL explain the keyword, function or operator under the cursor where
the user is reading it: how it is written, and what it does on the bound machine.
A keyword written in one of the short spellings the machine accepts SHALL be
explained as the keyword it stands for. Where the product's reference has nothing
for a keyword the machine has, the server SHALL still explain it from what the
machine itself declares, rather than saying nothing.

Where the explanation comes from the product's reference, it SHALL offer a way to
read that entry in full, at the reference the bound machine reads from and opened
at the keyword being explained — so that a reader who wants more than the
explanation has somewhere to go without leaving what they were reading to search
for it. An explanation the reference has nothing behind SHALL offer no such way,
rather than one that would arrive nowhere.

#### Scenario: Reading a keyword

- **WHEN** the user rests the cursor on a keyword
- **THEN** the editor shows how it is written and what it does on that machine

#### Scenario: Reading a short spelling

- **WHEN** the user rests the cursor on a short spelling the machine accepts
- **THEN** the editor explains the keyword that spelling stands for, and offers
  the full entry for that keyword rather than for the spelling

#### Scenario: Reading on to the full entry

- **WHEN** the user rests the cursor on a keyword the product's reference covers
- **THEN** the explanation offers a way to open that keyword's entry in the
  reference for the machine the listing is for

#### Scenario: A keyword the reference does not cover

- **WHEN** the user rests the cursor on a keyword the machine has and the
  product's reference has no entry for
- **THEN** it is still explained from what the machine declares, and no way to
  read further is offered
