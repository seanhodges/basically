## Why

Five machines spend a bottom-row keycap on their case key: the BBC, the Atari,
the CPC and the Spectrum each carry a `CAPS`, and the Commodores an `a/A` for
the character-set switch. Every one of them does the same thing — a tap that
latches the case inside the machine — and every one of them sits beside a shift
key that already taps sticky and locks on a second tap, exactly as a phone
keyboard's does.

A phone keyboard has no caps key. The lock is the shift key's second tap, and
that is the gesture a reader arriving at this keyboard already knows. Spending a
keycap on the same idea a second time costs the bottom-left machine region — the
row that holds `Esc`, `CTRL` and `C=` — and asks the reader to learn a second
rule for something their thumb already does.

The locked shift on those machines is also wrong today: it pins the SHIFT matrix
cell down, which on the BBC and the Atari gives capitals they are already in, and
on the Commodores gives graphics rather than the other case. So the state exists,
is reachable, and does nothing a case lock does.

Separately, a keycap's legend is sized from the keycap it sits on. That reads
well for a letter and badly for a word: the machine keys are half again as wide
as a letter key, so `CTRL` and `Esc` are drawn *larger* than the letters beside
them, while `SHIFT` and `NEW LINE` are pinned small by a style of their own.

## What Changes

- **The case keycaps go.** No machine offers a `CAPS` or `a/A` key; the
  bottom-left region keeps only keys that do something of their own.
- **Locking the shift latches the case.** A second tap on the shift key releases
  the shift cell, presses the machine's own case key, and stays latched until the
  shift is tapped again — the machine's real route, on every machine that has
  one: `CAPS LOCK` on the BBC and the CPC, `CAPS`/`SHIFT+CAPS` on the Atari,
  `CAPS SHIFT + 2` on the Spectrum, `SHIFT + C=` on the Commodores.
- **A latched lock pins no layer.** The letters have already changed case, so the
  keyboard shows the base legends in the latched case rather than the shift
  layer's, and keeps the latch when everything else is released (a blur, a stop)
  because it holds no key down.
- **A word legend takes one fixed size**, the size `SHIFT` and `NEW LINE`
  already use, wherever it is printed — so a machine key's word is never drawn
  larger than the letters beside it, and one word no longer shrinks every key in
  the single-legend display.
- One tap on shift is unchanged: it shifts the next key only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `virtual-input`: three requirements change — *Both letter cases are reachable
  where the machine has them* (the lock is the shift's second tap, not a keycap),
  *Standard key arrangement* (what the second tap does, and that no case keycap
  is offered), and *The layered key display* (a word legend's fixed size).

No other capability is affected. The keyboard's output — the characters typed
and the matrix cells pressed — is the same set as before; only the gesture that
reaches the case lock changes.

## Non-goals

- **Changing what any machine's case lock is.** The tokens pressed are the ones
  already proved on the booted ROMs; this moves which gesture presses them.
- **Giving a machine a case route it does not have.** A machine whose character
  generator has no lower case still offers neither, and the PET still reaches its
  set switch only by `POKE`.
- **Reworking the shift's single-tap behaviour**, the sticky/consumed rules, or
  any other modifier. `CTRL`, `C=` and `SYMBOL SHIFT` lock as they always did.
- **Retiring the layered display's keycap-relative sizing.** A character legend
  is still sized from the keycap it sits on; only words take a fixed size.
- **A new indicator for the latched state.** The locked keycap already inverts,
  and the letters redraw in the latched case.

## Impact

- The keyboard layout schema: a modifier can declare the machine's case lock;
  the per-key case-lock flag goes, having no user left.
- The virtual keyboard's input engine: the sticky→locked transition, the layer
  the latched state pins, and what a global release keeps.
- The five layouts that carried a case keycap, and the six that derive from them.
- The keycap renderer and its stylesheet, for the word size.
