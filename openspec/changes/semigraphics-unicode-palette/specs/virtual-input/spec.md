## MODIFIED Requirements

### Requirement: Authentic per-machine keyboard

The on-screen keyboard SHALL reproduce the active machine's real key layout,
legends, and glyphs (including shifted layers and keyword legends where the
machine has them), and pressing a key SHALL drive the emulated machine's own
key matrix.

Where the machine's character set contains graphics characters, the on-screen
keyboard SHALL offer them as a palette rather than as key legends: every
graphics character the machine can express, each shown large enough to
distinguish from the others, and each labelled with the physical key it lives on
so the palette teaches the machine's own keyboard. The palette SHALL adapt the
number of characters it shows per row to the space available, without changing
how large each character is drawn.

Each character SHALL be drawn in the palette the same way round as the editor
draws it - ink for ink, background for background - so that a cell cannot read
as the inverse of the character it inserts.

Where the palette holds more characters than fit at once, it SHALL scroll, and
scrolling it SHALL NOT insert anything: a character is inserted by a tap that
stays on it, not by touching it.

#### Scenario: Machine-specific legend

- **WHEN** the user switches target machine with the virtual keyboard open
- **THEN** the keyboard redraws with the new machine's layout and legends

#### Scenario: Inserting a graphics character

- **WHEN** the user selects the graphics palette with the editor focused and
  picks a character
- **THEN** that character is inserted into the source, and the program still
  tokenizes

#### Scenario: A palette cell reads the same way as the editor

- **WHEN** the user compares a half-block character in the graphics palette with
  the same character after inserting it
- **THEN** the same half of the cell carries the ink in both

#### Scenario: Scrolling past the characters that do not fit

- **WHEN** the user drags the graphics palette to reach the characters below
  the ones on screen
- **THEN** the palette scrolls and nothing is inserted into the source

#### Scenario: The palette shows where a character lives

- **WHEN** the user looks at a character in the graphics palette
- **THEN** it is labelled with the key, and any modifier, that produces it on
  the real machine

#### Scenario: The palette adapts to the space available

- **WHEN** the user opens the graphics palette on a narrow screen and on a wide
  one
- **THEN** fewer characters appear per row on the narrow screen, and the
  characters are drawn at a comparable size on both
