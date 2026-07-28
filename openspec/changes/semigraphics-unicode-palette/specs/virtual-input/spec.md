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

#### Scenario: Machine-specific legend

- **WHEN** the user switches target machine with the virtual keyboard open
- **THEN** the keyboard redraws with the new machine's layout and legends

#### Scenario: Inserting a graphics character

- **WHEN** the user selects the graphics palette with the editor focused and
  picks a character
- **THEN** that character is inserted into the source, and the program still
  tokenizes

#### Scenario: The palette shows where a character lives

- **WHEN** the user looks at a character in the graphics palette
- **THEN** it is labelled with the key, and any modifier, that produces it on
  the real machine

#### Scenario: The palette adapts to the space available

- **WHEN** the user opens the graphics palette on a narrow screen and on a wide
  one
- **THEN** fewer characters appear per row on the narrow screen, and the
  characters are drawn at a comparable size on both
