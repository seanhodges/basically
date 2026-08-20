## ADDED Requirements

### Requirement: The machine's screen can be saved as an image

Wherever the IDE shows a machine's screen, the user SHALL be able to save what
that machine has drawn as an image file.

The saved image SHALL be the machine's own picture and nothing else: its own
pixels, at its own display size, with no interpolation, no surrounding chrome —
no bezel, no panel, no on-screen input device — and no display treatment the IDE
draws over the screen, whatever the user's display settings. It SHALL be
enlarged by a whole number, so that every machine pixel remains a square block
of the same size and the file is legible at ordinary viewing sizes rather than
arriving as a thumbnail.

The saved image SHALL be named after the program it came from, and SHALL be
distinguishable from an image saved of the same program a moment earlier.

A machine that has stopped SHALL still yield the last frame it drew. Asking for
an image of a machine that has not yet drawn a frame SHALL tell the user there
is nothing to save, rather than saving an empty picture.

#### Scenario: Save what a program drew

- **WHEN** the user asks to save a screenshot while a program is running
- **THEN** an image file of the machine's screen is saved, at a whole-number
  enlargement of the machine's own pixels

#### Scenario: The picture is the machine's and nothing else

- **WHEN** the user saves a screenshot on any machine
- **THEN** the image shows what that machine drew, without anything that
  surrounds the screen in the IDE or is drawn over it

#### Scenario: A display treatment does not reach the file

- **WHEN** the user saves a screenshot while the IDE is drawing a display effect
  over the screen
- **THEN** the image is the machine's untreated output

#### Scenario: Saving after the program stops

- **WHEN** the user stops a program and then asks to save a screenshot
- **THEN** the last frame the machine drew is saved

#### Scenario: Nothing has been drawn yet

- **WHEN** the user asks to save a screenshot before the machine has drawn a
  frame
- **THEN** they are told there is nothing to save, and no file is produced

#### Scenario: Two screenshots of the same program

- **WHEN** the user saves a screenshot of a program and then saves another
- **THEN** both files are kept, each identifiable as a screenshot of that
  program
