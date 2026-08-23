# virtual-input Delta

## ADDED Requirements

### Requirement: Standard key arrangement

Every machine's on-screen keyboard SHALL arrange its keys identically, on
the arrangement of familiar mobile (iOS/Android) keyboards: below the
mode/function strip, the machine's number row; a ten-key letter row; a
centred nine-key home row offset by half a key; a seven-key bottom letter
row flanked by SHIFT at its left and the machine's delete key at its right,
each half again as wide as a letter key; and a bottom row. The letter rows
SHALL carry only the machine's letters — dedicated punctuation keycaps are
offered through the symbol mode instead.

The SHIFT flank SHALL be one sticky shift key, as on a phone keyboard: a
tap shifts only the next key, and a second tap locks it until it is tapped
again. The board SHALL NOT offer a second shift-like keycap whose only
work the symbol mode already does - a modifier earns a keycap by doing
something of its own, like a control key or a graphics modifier - so the
Spectrum's SYMBOL SHIFT has no keycap: its combinations are sent by the
symbol-mode cells, and its red legends stay printed on the keys.

On the bottom row, the Enter/Return key SHALL sit at the far bottom right,
wider than a letter key, with the quote key immediately to its left, and
the space bar between the quote key and the bottom-left region. The
bottom-left region SHALL be reserved for machine-specific keys (such as
Escape, Control, Break, or the C64's C= graphics modifier); a machine with
none SHALL leave it empty rather than filling it with invented keys.

The mode strip SHALL NOT offer keyword or function-name entry modes:
keyword entry is the editor's completion feature. A machine whose keycaps
carry keyword or function legends SHALL keep them printed on the keys.

#### Scenario: The same arrangement on every machine

- **WHEN** the user switches target machine with the virtual keyboard open
- **THEN** every letter, the shift key, the delete key, the space bar, and
  the Return key are in the same positions as before, and only the legends,
  colours, and machine-specific keys change

#### Scenario: Return sits at the bottom right

- **WHEN** the user opens the on-screen keyboard for any machine
- **THEN** the Return key is the bottom-right key, with the quote key
  immediately to its left

#### Scenario: Machine-specific keys keep to the bottom left

- **WHEN** the user opens the on-screen keyboard for a machine with extra
  machine keys (Escape, Control, Break, a graphics modifier)
- **THEN** those keys sit in the bottom-left region, and a machine without
  them shows empty space there instead of invented keys

#### Scenario: Shift locks on a double tap

- **WHEN** the user taps the SHIFT key twice and then types several letters
- **THEN** every letter is shifted, until SHIFT is tapped once more to
  release it

#### Scenario: Keyword legends without a keyword mode

- **WHEN** the user opens the on-screen keyboard for a machine whose keys
  carry keyword or function legends
- **THEN** the mode strip offers no keyword or function mode, and the
  legends remain printed on the keycaps

### Requirement: Symbols at fixed positions

The on-screen keyboard SHALL offer a symbol mode that places symbols at the
same fixed positions on every machine, arranged as on familiar mobile
keyboards: the common symbols on the first page, the rarer ones on a second
page. A position is occupied only by a symbol at least one registered
machine supports; a slot whose symbol a machine lacks SHALL be blank on
that machine — no legend, no effect when tapped — and a slot no machine
uses SHALL stay unassigned rather than being filled with an invented
symbol.

Tapping a mapped symbol SHALL insert it into the code editor when the
editor has focus, and SHALL press the machine's own key or key combination
for that symbol when the emulator has focus. Where a machine reaches a
symbol only through a mode sequence that no single key combination can
send, the cell SHALL still insert into the editor but SHALL press nothing
on the machine, rather than a key that would type something else. Every
character that was offered by a dedicated punctuation keycap before SHALL
be reachable in symbol mode, and the shifted legends reachable through the
board's own SHIFT key SHALL remain usable alongside it.

The number row and the bottom row SHALL keep their normal function while
symbol mode is active. Where a machine maps a symbol on the second page,
the SHIFT key position SHALL act as the page toggle in symbol mode; a
machine with nothing mapped on the second page SHALL offer no toggle.

#### Scenario: A symbol is where it was on the last machine

- **WHEN** the user selects symbol mode, notes where `,` sits, and switches
  target machine
- **THEN** `,` sits at the same position on the new machine's symbol mode

#### Scenario: A symbol presses the machine's own combination

- **WHEN** the user runs a program that reads the keyboard, gives the
  emulator focus, and taps a symbol in symbol mode
- **THEN** the machine sees the same key or combination its own keyboard
  would send for that symbol

#### Scenario: A machine without a symbol leaves its key blank

- **WHEN** the user opens symbol mode on a machine that does not support
  one of the mapped symbols
- **THEN** that key shows no legend and tapping it does nothing

#### Scenario: Numbers and the bottom row stay live in symbol mode

- **WHEN** the user types a list like `1,2,3` in symbol mode with the
  editor focused
- **THEN** the digits, the comma, space, quote, and Return all work without
  leaving symbol mode

#### Scenario: The second page appears only when needed

- **WHEN** the user opens symbol mode on a machine that maps no symbol on
  the second page
- **THEN** no page toggle is offered

## MODIFIED Requirements

### Requirement: Authentic per-machine keyboard

The on-screen keyboard SHALL carry the active machine's authentic key
legends and glyphs (including shifted layers and keyword legends where the
machine has them), and pressing a key SHALL drive the emulated machine's
own key matrix. Key positions follow the standard arrangement rather than
the machine's physical board, so authenticity lives in the legends, the
theme, and the matrix wiring — never in an invented key: the keyboard SHALL
NOT offer a key or symbol the machine does not have.

The machine's function keys SHALL be offered as a single row above the keys, and
a function key SHALL be drawn the size of a letter key on the board below it,
however many function keys the machine has. Where a machine has more function
keys than the width of the board holds, the row SHALL scroll sideways rather
than wrap or shrink them, every function key SHALL be reachable by scrolling,
and the keyboard SHALL show that there are more than can be seen. Scrolling the
row SHALL NOT press a key: a key is pressed by a touch that stays on it, not by
one that drags across it. A function key held without moving SHALL stay held,
because the machines that read function keys read them as held state.

Where the machine's character set contains graphics characters, the on-screen
keyboard SHALL offer them as a palette rather than as key legends: every
graphics character the machine can express, each shown large enough to
distinguish from the others, and each labelled with how the machine itself
reaches it — the physical key it lives on, or, where the machine printed no
graphics on its keyboard, the character code its BASIC would use — so the
palette teaches the machine rather than the IDE. The palette SHALL adapt the
number of characters it shows per row to the space available, without changing
how large each character is drawn.

Where the machine displays its graphics characters as graphics only after a
display control code, the palette SHALL also offer those control codes, placed
ahead of the characters they enable, and SHALL say that the characters need
one — so a user who takes a character from the palette can make it appear. A
control code SHALL be offered as a picture of what it does rather than as its
name spelled out, and SHALL be labelled with the character code that produces
it, like any other cell on such a machine. The palette SHALL NOT offer a
control code that would stop the machine displaying those characters as
graphics.

The palette SHALL draw every machine's graphics characters the same way round as
the editor draws them - dark ink on light ground - whatever colours that
machine's own screen uses, because the palette is a preview of the text that
lands in the editor. A cell SHALL NOT read as the inverse of the character it
inserts.

Where the palette holds more characters than fit at once, it SHALL scroll, and
scrolling it SHALL NOT insert anything: a character is inserted by a tap that
stays on it, not by touching it.

#### Scenario: Machine-specific legend

- **WHEN** the user switches target machine with the virtual keyboard open
- **THEN** the keyboard redraws with the new machine's legends and theme

#### Scenario: A machine with more function keys than fit

- **WHEN** the user raises the on-screen keyboard on a machine with more
  function keys than the width of the board holds
- **THEN** the function keys are one row of keys the size of the letter keys,
  and the ones past the edge are reached by scrolling the row

#### Scenario: Scrolling the function row does not press a key

- **WHEN** the user drags sideways across the function keys to reach the ones
  past the edge
- **THEN** the row scrolls and no function key is pressed on the machine

#### Scenario: A function key can be held

- **WHEN** the user presses and holds a function key on a machine whose programs
  read the function keys as held state
- **THEN** the machine sees the key held for as long as the touch stays on it

#### Scenario: Inserting a graphics character

- **WHEN** the user selects the graphics palette with the editor focused and
  picks a character
- **THEN** that character is inserted into the source, and the program still
  tokenizes

#### Scenario: A palette cell reads the same way as the editor

- **WHEN** the user compares a half-block character in the graphics palette with
  the same character after inserting it, on any machine that has a palette
- **THEN** the same half of the cell carries the ink in both

#### Scenario: Scrolling past the characters that do not fit

- **WHEN** the user drags the graphics palette to reach the characters below
  the ones on screen
- **THEN** the palette scrolls and nothing is inserted into the source

#### Scenario: The palette shows where a character lives

- **WHEN** the user looks at a character in the graphics palette on a machine
  whose keyboard produces it
- **THEN** it is labelled with the key, and any modifier, that produces it on
  the real machine

#### Scenario: The palette shows how to reach a character with no key

- **WHEN** the user looks at a character in the graphics palette on a machine
  that printed no graphics on its keyboard
- **THEN** it is labelled with the character code that machine's BASIC uses to
  produce it

#### Scenario: The palette offers the control code a graphics character needs

- **WHEN** the user opens the graphics palette on a machine whose graphics
  characters display as graphics only after a display control code, and picks
  that control code and then a graphics character
- **THEN** both are inserted into the source, and running the program shows the
  graphics character as graphics

#### Scenario: The palette says a graphics character needs a mode set first

- **WHEN** the user looks at the graphics characters of such a machine in the
  palette
- **THEN** the palette states that they display as graphics only after one of
  the control codes it offers ahead of them

#### Scenario: The palette adapts to the space available

- **WHEN** the user opens the graphics palette on a narrow screen and on a wide
  one
- **THEN** fewer characters appear per row on the narrow screen, and the
  characters are drawn at a comparable size on both
