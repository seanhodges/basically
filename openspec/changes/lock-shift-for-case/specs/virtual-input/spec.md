## MODIFIED Requirements

### Requirement: Both letter cases are reachable where the machine has them

On every machine whose character generator can draw lower case, the on-screen
keyboard SHALL be able to type both cases, by the route the machine itself uses:
a shifted letter where that is how the machine gives the other case, or the
machine's own case lock where it has one. A machine whose character generator
has no lower case SHALL NOT be given a way to type one.

A keycap SHALL show the case it will type. Where the machine's case changes what
an unshifted letter key produces, the keycaps SHALL follow, so the keyboard never
shows one case while typing the other.

A machine's case lock SHALL be reached by locking the shift key - its second tap,
as a phone keyboard's is - and SHALL NOT be offered as a keycap of its own. That
tap SHALL press the machine's own case key rather than holding the shift down,
and its effect SHALL persist after the tap until the shift is tapped again. While
the lock is latched the keyboard SHALL show the base legends in the latched case
rather than the shifted ones, since the letters have already changed case; and
because the lock holds no key down, releasing the keyboard's keys - a lost focus,
a stopped machine - SHALL leave it latched.

The case a keyboard offers before anything is pressed SHALL be the case the
machine produces when it has just started.

#### Scenario: A machine that gives its other case with shift

- **WHEN** the user presses shift and a letter key on the on-screen keyboard of a
  machine whose shifted letters are the other case
- **THEN** the other case is typed, and the keycap showed that case before it was
  pressed

#### Scenario: A machine with a case lock

- **WHEN** the user taps the shift key twice on a machine that has a case lock,
  and then presses a letter key
- **THEN** the letter is typed in the other case, the letter keycaps show that
  case, and the machine's own case key was pressed rather than the shift held

#### Scenario: The lock stays until it is tapped off

- **WHEN** the user locks the case, types several letters, and taps the shift key
  once more
- **THEN** every letter was typed in the locked case, and the keycaps and what
  they type return to the case the machine started in

#### Scenario: No machine offers a case keycap

- **WHEN** the user opens the on-screen keyboard for any machine
- **THEN** the bottom row carries no case-lock keycap, and the keys in its
  machine region are only keys that do something else

#### Scenario: A machine with no lower case

- **WHEN** the user opens the on-screen keyboard for a machine whose character
  generator has no lower case
- **THEN** the keyboard offers neither a case pair on its letter keys nor a case
  lock on its shift

#### Scenario: A machine whose unshifted letters are lower case

- **WHEN** the user opens the on-screen keyboard for a machine that produces
  lower case from an unshifted letter key when it has just started
- **THEN** the letter keycaps show lower case, and tapping one types lower case

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
again. On a machine with a case lock that second tap SHALL latch the
machine's case rather than hold the shift down, which is why no machine
offers a case keycap of its own. The board SHALL NOT offer a second
shift-like keycap whose only work the symbol mode already does - a modifier
earns a keycap by doing something of its own, like a control key or a
graphics modifier - so the Spectrum's SYMBOL SHIFT has no keycap: its
combinations are sent by the symbol-mode cells.

On the bottom row, the Enter/Return key SHALL sit at the far bottom right,
wider than a letter key, with the quote key immediately to its left, and
the space bar between the quote key and the bottom-left region. The
bottom-left region SHALL be reserved for machine-specific keys (such as
Escape, Control, Break, or the C64's C= graphics modifier); a machine with
none SHALL leave it empty rather than filling it with invented keys.

The mode strip SHALL NOT offer keyword or function-name entry modes:
keyword entry is the editor's completion feature. A machine whose keycaps
carry keyword or function legends SHALL keep them as markings of their own,
shown as the layered display shows any other marking.

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
- **THEN** the mode strip offers no keyword or function mode, and the keys
  carry those legends as markings the layered display can show

### Requirement: The layered key display

The keyboard's full key display SHALL be named "Layered". On it, a key SHALL
show its base legend, at most one of the machine's other markings, and its
symbol-mode hint - never several markings at once, whatever the size of the
screen. The marking shown is the one the selected mode pins or an engaged
modifier gives, drawn below the base legend in the ink the machine printed
that layer in, so it changes colour with the layer it carries; a key whose
selected layer is blank shows its base legend alone. A marking no mode or
modifier reaches - a keyword legend on a machine whose keys also carry a
shift marking - is not printed. A legend of a single character SHALL be sized
from the keycap, so the same key reads the same way on a phone and on a
desktop, only larger; a legend of a word SHALL take one fixed size wherever it
is printed, so a wide key's word is never drawn larger than the letters beside
it and one word never shrinks the rest of the board.

Each letter-band key SHALL show its symbol-mode character as a small hint in
the theme's own ink - the way a phone keyboard prints its long-press hints -
never in an authentic legend colour, and a key whose symbol-mode cell is
blank shows no hint. Cursor overlays SHALL appear only while cursor mode is
selected: in that mode a key carrying an arrow shows the arrow alone, and
every other key above the bottom row SHALL be blank and inert - no legend,
nothing typed, nothing pressed - like a symbol-mode key the machine leaves
unmapped. Only the bottom row keeps its normal function in cursor mode, and
outside it no key shows an arrow.

Where a machine's letters exist in both cases, a letter key SHALL show one
letter, in the case the shift key currently gives - switching when SHIFT is
pressed or locked and back when it is released, as the native mobile
keyboards do - rather than both cases at once.

#### Scenario: The same keycap on a phone and on a desktop

- **WHEN** the user opens the on-screen keyboard on a phone and then on a
  desktop
- **THEN** each key carries the same legends in the same places on both,
  drawn larger on the desktop

#### Scenario: A word reads at the same size as a letter

- **WHEN** the user looks at a machine key whose legend is a word, beside the
  letter keys
- **THEN** the word is drawn at the size the SHIFT and Return words are, rather
  than larger because its key is wider

#### Scenario: The mode chooses the marking and its colour

- **WHEN** the user selects a different mode from the strip
- **THEN** each key's one secondary marking becomes that mode's, in the ink
  the machine printed that marking in

#### Scenario: A key hints at its symbol

- **WHEN** the user looks at a letter key in the layered display
- **THEN** the symbol its symbol-mode cell holds shows as a small hint in
  the theme's ink, and a key with no symbol shows none

#### Scenario: Letter case follows the shift key

- **WHEN** the user taps SHIFT on a machine whose letters have both cases
- **THEN** the letter keys change case, and change back when the shift
  releases

#### Scenario: Arrows only in cursor mode

- **WHEN** the user reads the keys in ABC mode and then selects cursor mode
- **THEN** no arrow decorates a key in ABC mode, and in cursor mode the
  keys that carry arrows show the arrow alone

#### Scenario: Cursor mode blanks the keys it does not use

- **WHEN** the user selects cursor mode and taps a letter or number key
  that carries no arrow
- **THEN** the key is blank, nothing is typed and nothing is pressed on the
  machine, while the bottom row still works
