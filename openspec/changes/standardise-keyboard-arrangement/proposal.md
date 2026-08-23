## Why

The virtual keyboards share a uniform grid and legend kit, but their key
*arrangement* still follows each machine's period hardware: Enter sits on the
home row, Shift and Backspace on the bottom row, and six machines keep real
`, . /` keycaps in the bottom letter row — while two others ("the Altair
arrangement") deviate further. On the touch devices the keyboard exists for,
none of this matches the muscle memory users bring from iOS/Android
keyboards, and every machine differs slightly from the next. Arranging every
machine the same way — the mobile way — makes the keyboard instantly familiar
and gives future dialects a fixed set of rules to follow.

## What Changes

- Every machine's keyboard adopts the mobile-convention arrangement: number
  row, Q row, a centred 9-key home row (half-key stagger), a bottom letter
  row flanked by Shift (left) and the machine's delete key (right), and a
  bottom row of machine-specific keys, space, quote, and a wide Return at the
  far bottom right.
- Punctuation/symbol keycaps leave the letter rows (and ABC mode) entirely; a
  SYM editor mode offers every machine's symbols at **fixed canonical
  positions** shared by all machines (transcribed from the Gboard symbol
  pages), each pressing the machine's real key or combination. A machine that
  lacks a symbol leaves that key blank; a second symbol page (toggled where
  the mobile keyboard's `1/2` key sits, on the Shift keycap) carries the
  rarer symbols, and is offered only by machines that map something on it.
- **BREAKING (UI)**: the Sinclair KEYWORD and FUNCTION mode tabs are removed
  — inline editor autocomplete already covers keyword entry. The keyword and
  function keycap legends stay printed on the keys.
- The PMD 85 and Altair 8800 lose their deviant arrangement and follow the
  same rules; their extra symbol keys move into the SYM map.
- The arrangement rules become part of the virtual-input capability spec, so
  every future dialect's keyboard is authored to them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `virtual-input`: the "Authentic per-machine keyboard" requirement gains a
  standard key arrangement — authenticity stays in legends, matrix wiring,
  themes, and glyphs, while key *positions* follow one fixed
  mobile-convention template; a new requirement defines the SYM mode's fixed
  canonical symbol positions and the unmapped-symbol rule; the removal of
  the Sinclair KEYWORD/FUNCTION modes amends what the mode strip offers.

## Impact

- `src/keyboard/templateRows.ts`, `src/keyboard/legendKit.ts`: new
  flanked-row and symbol-map building blocks.
- All 11 authored `src/dialects/<name>/keyboardLayout.ts` files (4 variants
  inherit): row re-membership and SYM layer/mode; legends and matrix tokens
  unchanged.
- `src/keyboard/layoutGeometry.test.ts` re-pinned and extended to enforce
  the arrangement registry-wide; each dialect's colocated
  `keyboardLayout.test.ts` updated.
- `docs/contributing/adding-a-dialect.md`: keyboard-authoring rules updated.
- e2e: `e2e/virtual-input/` journey extended with one SYM-mode assertion.

## Non-goals

- No theme, glyph, or ABC legend content changes; keycaps keep their
  authentic markings.
- No graphics-palette changes; machine graphics characters stay in the
  GRAPHICS palette, not the SYM map.
- No new layout machinery beyond one additive schema flag (a layer that
  renders only while its mode is active); layers, modes, and per-legend
  emits carry the whole change.
- No controller-binding changes (bound key ids survive).
- No invented keys or symbols: a symbol no registered machine supports gets
  no slot — blank and unreserved.
