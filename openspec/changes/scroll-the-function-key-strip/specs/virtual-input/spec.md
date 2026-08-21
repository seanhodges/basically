## MODIFIED Requirements

### Requirement: Authentic per-machine keyboard

The on-screen keyboard SHALL reproduce the active machine's real key layout,
legends, and glyphs (including shifted layers and keyword legends where the
machine has them), and pressing a key SHALL drive the emulated machine's own
key matrix.

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
reaches it.

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
