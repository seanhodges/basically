## Why

The on-screen keyboard cannot press a cursor key on any machine. A physical
arrow key reaches every machine that has one, so on a desktop the gap is
invisible; on touch, where the on-screen keyboard is the only keyboard, the
machine's own screen editor cannot be driven at all. Retyping a line because the
cursor cannot be moved back is the whole of the problem.

Five machines already offer a CURSOR mode that overlays the four arrows on the
W/A/S/D keys, and it is worse than nothing when the emulator has focus: the
legends are editor-caret actions only, so the keys still press W, A, S and D
into the running program. The keyboard shows arrows and types letters.

The rest never got the keys at all. The Commodore machines and the PMD 85 drop
them outright; the Sinclair machines can reach them, because their cursor keys
are a SHIFT chord the modifier already produces, but nothing on the keyboard
says so.

One machine's delete key suffers from the same borrowing. The PMD 85 has no
backspace at all - its keycap presses the real delete-at-cursor cell but wears a
`⌫` legend, because until now there was no way to move the caret back and a
delete-at-cursor key would have been useless. Working cursor keys remove the
reason for the disguise.

## What Changes

- A machine's own cursor keys SHALL be pressable from the on-screen keyboard,
  on every machine whose keyboard has them.
- A cursor key SHALL reach the same matrix cells the machine's own arrow keys
  do, including the shift combination on the machines that produce their cursor
  keys that way.
- A keycap SHALL NOT show a cursor legend while pressing a different key.
- A machine with no backspace key SHALL offer its delete key under its own
  legend, and that key SHALL delete at the cursor on the code editor as well as
  on the machine.
- The Altair 8800 keeps no cursor keys: it is a teletype, and has none.

Affected capability spec: `openspec/specs/virtual-input/spec.md`.

## Non-goals

- **No dedicated arrow keycaps or D-pad cluster.** The five-band template has no
  free columns, which is why these keys were dropped in the first place. The
  CURSOR mode already exists; this change makes it true rather than replacing
  it.
- **No new cursor keys on machines that have none.** The Altair is excluded, and
  the PMD 85 gets the three its keyboard actually carries - the Monitor's own
  key-code table gives the fourth cell no code.
- **No revival of the Sinclair number-row arrow legends as editor actions.**
  They stay display-only; the CURSOR mode is where the chord becomes pressable.
- **No change to the TRS-80's editing key.** It has no delete key either, but
  its `←` is a destructive backspace - the machine's own screen driver reads the
  code it sends as "backspace and erase" - so a DEL legend there would be the
  same borrowing in the other direction.
- **No new gamepad or assistant bindings.** A legend's tokens are not a key the
  controller can bind to; extending that is a separate concern.
