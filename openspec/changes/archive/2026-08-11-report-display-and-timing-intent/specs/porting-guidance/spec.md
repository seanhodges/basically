## ADDED Requirements

### Requirement: The program's positions are checked against the target's screen

Text screens run from 22 columns to 80 among the machines, and a program's
layout is written in positions aimed at one of them. A position beyond the
target's screen ports without an error and lands off the edge or wrapped; a
position given as a single offset from the screen's start encodes the source
machine's width itself, so the same number is a different place on the
target. No command list carries any of this: the commands port, the numbers
are wrong.

Where the reader's own program is at hand, the comparison SHALL check the
positions the program states as constants — row-and-column arguments, single
offsets, and position control codes — against the columns and rows of the
screen the target machine boots into, and SHALL name the positions the
target's screen does not contain. Where the program positions by single
offset and the two screens differ in width, the comparison SHALL say the
offsets encode the source's width and must be recomputed for the target's,
whether or not any offset is out of bounds.

The comparison SHALL pose the decision the positions force — reflow the
layout for the target's screen, or clip what falls outside — once, not per
position.

A position the program computes SHALL NOT be judged: doubt reports nothing,
and the posed decision covers what the text does not fix. Where the program
selects screen modes other than the boot mode, the comparison SHALL say its
check describes the boot screen rather than judge a geometry it cannot know.

Where every stated position fits and the screens' widths agree, or where
there is no program, nothing SHALL be reported about positions.

#### Scenario: A position beyond the target's screen

- **WHEN** the open program prints at a constant position that lies beyond
  the columns or rows of the target machine's boot screen
- **THEN** the comparison names the position and what the target's screen
  holds, and poses the reflow-or-clip decision once

#### Scenario: Offsets that encode the width

- **WHEN** the open program positions by single offset and the two machines'
  boot screens differ in width
- **THEN** the comparison reports that the offsets encode the source's width
  and must be recomputed for the target's

#### Scenario: A layout that fits

- **WHEN** every constant position in the open program lies within the target
  machine's boot screen, and the machines' widths agree
- **THEN** nothing is reported about positions

#### Scenario: A computed position

- **WHEN** the open program computes a position rather than stating it
- **THEN** that position is not reported as out of bounds

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about positions

### Requirement: Loops that only pass time are reported with the machines' measured speeds

An empty counting loop is a delay tuned to the speed of the machine it was
written on — the count *is* the source machine's speed, written into the
program. Ported verbatim to a machine that runs BASIC several times faster or
slower, every pause changes by that factor and a playable program stops being
one. Nothing fails, nothing tokenizes differently, and no command changes.

Each machine SHALL carry a speed measured by running the same counting loop
in this product's own emulators, and the comparison SHALL quote any ratio as
measured there, never as a fact about the original hardware.

Where the reader's own program contains empty counting loops and the two
machines' measured speeds differ materially, the comparison SHALL report that
the program's delays are tuned to the source machine's speed, quote the
measured ratio, and pose the decision: retune the counts, or move the delays
onto the target machine's own clock — which the report SHALL name, each
machine having its own idiom for waiting.

A loop with a body SHALL NOT be called a delay: only loops that do nothing
but count are reported, and a program with none produces nothing. Where the
measured speeds are close, nothing SHALL be reported however many delay
loops the program has. Where there is no program, nothing SHALL be reported
about delays.

#### Scenario: Delay loops moving to a much faster machine

- **WHEN** the open program contains empty counting loops and the target
  machine's measured speed is several times the source's
- **THEN** the comparison reports the delays as tuned to the source, quotes
  the measured ratio as this product's emulators', names the target's own way
  of waiting, and poses the retune-or-reclock decision

#### Scenario: A program with no empty loops

- **WHEN** the open program contains no empty counting loops
- **THEN** nothing is reported about delays, whatever the machines' speeds

#### Scenario: Two machines of similar speed

- **WHEN** the two machines' measured speeds are close
- **THEN** nothing is reported about delays

#### Scenario: The ratio is the emulators' own

- **WHEN** the comparison quotes a speed ratio
- **THEN** the ratio is stated as measured in this product's emulators, not
  as a fact about the original hardware

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** nothing is reported about delays

### Requirement: Colour and sound the program leans on are posed as decisions

A program uses colour and sound two ways: as decoration, which a port can
drop, and as information — the colour that tells the player's piece from the
wall, the beep that says the key registered — which a port must re-encode or
the program stops working in a way no listing shows. Which of the two a given
program is doing is not decidable from its text, and the target's written
advice for the lost capability is only half an answer until it is decided.

Where the open program uses colour and the target machine has no colour, the
account that reports the lost colour commands SHALL pose the decision: where
the colour decorated, drop it; where it told things apart, re-encode it by
the means the target's own advice names. Sound SHALL be treated the same way
where the program uses sound and the target has none.

The decision SHALL be posed only where the program actually uses the
capability, riding the narrowing the accounts already have, and SHALL add
nothing where the target provides the capability or the program does not use
it. Where there is no program, the accounts report as they do today and no
decision is posed.

#### Scenario: A colour-using program moving to a monochrome machine

- **WHEN** the open program uses colour commands and the target machine has
  no colour
- **THEN** the lost-colour account poses the decoration-or-information
  decision, with the re-encoding means the target's advice already names

#### Scenario: A sound-using program moving to a silent machine

- **WHEN** the open program uses sound commands and the target machine has no
  sound
- **THEN** the lost-sound account poses the same decision for each effect —
  drop it, or re-encode the cue

#### Scenario: A program that never uses the capability

- **WHEN** the target machine lacks colour or sound but the open program uses
  no such command
- **THEN** no account of that capability is reported, as the narrowing
  already provides

#### Scenario: Reading the comparison with no program

- **WHEN** a user reads the comparison on its own, or with nothing open
- **THEN** the lost-capability accounts read as they do today, with no
  decision posed
