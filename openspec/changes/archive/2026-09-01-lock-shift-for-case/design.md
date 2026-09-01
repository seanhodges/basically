## Context

The on-screen keyboard is described entirely as data (a layout per dialect) and
driven by one input engine; see `docs/contributing/architecture.md` for the
dialect seam these layouts hang off. The engine already models a modifier as
`off → held → sticky → locked`, and every shift flank in the tree is declared
`sticky` and `lockable`. What it has never modelled is a *latch*: a key that is
tapped, whose effect lives in the machine afterwards.

That was why the case keys were keycaps with a flag of their own rather than a
modifier state. The flag was right about the mechanism and wrong about the
gesture — the two have to be separated, not swapped.

## Goals / Non-Goals

**Goals**

- One rule for letter case on every machine: shift shifts, shift-lock latches.
- The machine's own case key is what gets pressed, with the tokens already
  proved on the booted ROMs.
- A latched lock behaves like a latch, not like a held key: nothing stays down,
  nothing pins a layer, and a global release does not silently undo it.
- A word legend is one size wherever it appears.

**Non-Goals**

- Any change to what the machines do (see the proposal's non-goals).

## Decisions

### The case lock belongs to the modifier, not to a key

A layout declares the lock on the modifier that carries it, with the tokens for
latching and — where the machine's route back differs, as the Atari's does — for
releasing. The alternative, keeping a hidden key and synthesising presses of it,
would leave two descriptions of one machine fact in one layout.

The per-key flag is removed rather than left unused: with no machine declaring
it, two mechanisms for one behaviour is exactly what this change is removing.

### A latched lock releases the modifier's own cell and pins no layer

A case lock on every machine here is the inverse of a held modifier: a momentary
press whose effect is latched inside the ROM. So on the second tap the shift cell
comes back up and the machine's case key is tapped in its place, and while the
lock is latched the modifier's layer is not the active one — the letters have
already changed case, and drawing the shift legends over them would show one case
while typing the other.

For the same reason a global release (window blur, stop, machine swap), which
exists to let go of held matrix cells, leaves a latched lock alone: it holds
none, and clearing it would draw an unlocked shift over a machine still in the
other case.

### The lock is a timed pulse, not a hold

The old keycap was held for as long as a thumb held it. The engine now times the
press itself, and holds it for the same five frames every case lock in the tree
is proved at against its ROM — long enough for a keyboard scan to see it, on the
machine target; ended where it began on the editor target, which counts no
frames.

### A word is sized by what it is, not by which key it is on

The renderer marks a legend of more than one character, and the stylesheet gives
those the fixed size the wide keys already used. Deriving it from the legend
rather than from a per-key style means a new machine's `BREAK` or `RESET` is
right without the layout saying anything, and the single-legend display stops
letting one word shrink every key on the board.

## Seam impact

None. `Dialect` and `MachineEmulator` are untouched: a layout is data behind the
seam, and the engine reaches the machine through the same `setKey` it always
did — with the same tokens the case keycaps pressed.

## Risks / Trade-offs

- **A machine that powers up caps-locked shows lower case when the shift is
  locked** (the BBC, the Atari). That is the machine's truth — its lock's only
  destination is lower case — and the keycaps say so, but it is the opposite of
  what a phone keyboard's locked shift suggests.
- **The Commodores lose a held-shift graphics lock.** Locking the shift there now
  switches the character set. Shift still holds per key, and the graphics palette
  is the route to the set.
