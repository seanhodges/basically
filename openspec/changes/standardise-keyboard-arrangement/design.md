## Context

Every registered machine's virtual keyboard sits on the shared five-band
template (`src/keyboard/templateRows.ts`: 40-column grid, span-4 keycaps) and
builds its legends with the shared kit (`src/keyboard/legendKit.ts`), but the
*arrangement* differs from mobile convention and, in places, between
machines: Enter is the home row's 10th key (except the PMD 85 and Altair
8800, which park it on the bottom row), Shift/Backspace live on the bottom
row, and six machines keep dedicated `, . /` keycaps in the bottom letter
row. The user wants every machine arranged like iOS/Android keyboards, with
the symbols moved to a SYM mode whose positions are fixed across machines
(transcribed from the Gboard symbol pages), and the arrangement captured as
rules future dialects follow. See `docs/contributing/architecture.md` for
the keyboard subsystem's structure; this design only names what changes.

## Goals / Non-Goals

**Goals:**

- One arrangement on every machine: number row · Q row · centred 9-key home
  row · `⇧ + 7 letters + delete` flanked row (spans 6/4×7/6) · bottom row of
  machine-specific keys, space, quote, wide Return at far bottom right.
- One fixed SYM map on every machine: position comes from the template,
  reachability (emits/insert) from the machine; unsupported symbols are
  blank, unmapped, unreserved.
- Rules enforceable by the registry-driven geometry test, so a new dialect
  cannot ship an off-template keyboard.

**Non-Goals:**

- No theme, glyph, ABC-legend, graphics-palette, or controller changes.
- No change to how keys reach the machine: every key and SYM legend presses
  matrix tokens through the existing input engine.
- No second arrangement for wide screens; one layout serves all viewports,
  as today.

## Decisions

- **Position from the template, reachability from the machine.** The
  canonical SYM map lives beside the geometry in `templateRows.ts` as two
  page constants aligned with the three letter bands (10/9/7 slots). A
  machine's layout supplies only a table of the symbols it supports —
  `symbol → { emits, insert? }` — and a shared builder welds SYM-layer
  legends onto the row keys positionally. A symbol absent from the table
  leaves its slot blank. Alternative considered: token-keyed maps per
  machine — rejected because the Commodores use their own token vocabulary,
  and because it would let a machine drift a symbol's position.
- **SYM legends press real combinations via per-legend `emits`** — the
  mechanism `cursorKey` already uses (`['Comma']` where the machine has the
  key, `['SymShift','KeyO']`-style combos where it reaches the symbol
  through a modifier). The machine's own shifted corner legends stay
  untouched, so every displaced symbol also remains reachable the authentic
  way.
- **Page 2 rides the mode's `shiftedLayer`.** SYM mode pins layer `sym`;
  its `shiftedLayer` is `sym2`, so the sticky Shift key flips pages exactly
  where Gboard's `1/2` key sits — the C64 GRAPHICS-mode precedent, no new
  machinery. A machine whose table maps no page-2 symbol simply omits
  `sym2`/`shiftedLayer` and shows no toggle.
- **One additive schema field: `LayerDef.modeOnly?: boolean`.** The
  canonical SYM layers must not paint two extra corner legends on every
  keycap in ABC mode (the keyword/function layers are printed on the real
  keycaps; the canonical symbols are not). A `modeOnly` layer renders its
  legends only while pinned by the active editor mode; the renderer change
  is a few lines in `VirtualKeyboard.tsx`, and the compact-mode layer
  selector skips such layers. Alternative considered: inferring visibility
  from "layer referenced only by a mode" — rejected, the Sinclair keyword/
  function layers have exactly that shape and must stay visible.
- **One shift keycap per board, double-tap to lock.** The flanked shift is
  sticky and lockable (a tap shifts the next key, a second tap locks - the
  behaviour `ModifierDef` already models), and a second shift-like keycap
  whose only work the SYM mode now does gets no place: the Spectrum's
  SYMBOL SHIFT keycap is removed, its red legends staying printed as a
  display-only layer while the SYM cells press its combinations. Modifiers
  that do their own work (C=, CTRL) keep their bottom-left keycaps.
- **Existing SYM/SYMBOL modes are re-pointed, not removed.** Spectrum, C64,
  Atom, CPC and BBC keep their mode tab; it pins the new canonical layers.
- **Symbols are the SYM mode's alone; the display is "Layered".** The full
  key display (formerly "Authentic") is renamed Layered and normalised: the
  shift layers carry no symbol or keyword legends any more (only the letter
  case pairs and the Sinclair arrows), each letter-band key shows its SYM
  cell as a small theme-ink hint, cursor layers are `modeOnly` so arrows
  appear only in CURSOR mode, and a machine with both letter cases shows
  one case-following letter per key. The editor types symbols only through
  SYM cells and the quote key; an engaged SHIFT still reaches whatever the
  hardware matrix makes of it on the machine target.
- **An overlay mode owns the letter bands.** CURSOR pins a `modeOnly` layer
  the way SYM does, so `withSymbolMode` finishes it the same way: between
  the number row and the bottom row, a key the overlay leaves unlabelled is
  blanked - inert, like an unmapped SYM cell - rather than falling back to
  typing its letter. The mode shows only its arrows; the number row (home
  of the Sinclairs' arrows) and the bottom row keep their normal function.
- **KEYWORD/FUNCTION modes are removed on zx80/zx81/zxspectrum(+128)** —
  tabs only; the layers and their printed legends stay, and
  `compactDefaultLayer: 'keyword'` remains valid. Keyword entry is the
  editor autocomplete's job.
- **The flanked row is asserted, not conventioned.** `templateRows.ts`
  gains a `flankedRow(shift, letters, del)` helper (validates 7 letters,
  fixes spans 6/4/6), and `layoutGeometry.test.ts` is re-pinned: home row =
  9 centred span-4 keys; band 3 = shift flank + 7 letters + delete flank;
  bottom row's last printing key acts `newline` with the quote key at its
  left; every `sym`-layer legend's text matches the canonical symbol for
  its slot. This is what turns the arrangement into a rule for future
  dialects.
- **Dialect/MachineEmulator seam impact: none beyond the additive
  `LayerDef.modeOnly` field.** `Dialect.keyboardLayout`'s type gains one
  optional boolean; no emulator, tokenizer, or store surface changes, and
  every emitted token vocabulary is unchanged.

## Risks / Trade-offs

- [A symbol's per-machine combo is wrong (e.g. `<` isn't Shift+Comma on
  some machine)] → derive each entry from the shifted legends already in
  that machine's layout data and charset tests, and pin SYM reachability in
  the dialect's `keyboardLayout.test.ts` (legend text, emits, and editor
  insert per mapped symbol).
- [Hidden coupling to removed keycaps: samples, e2e, or controller configs
  referencing `Comma`/`Period`/`Slash` key ids] → grep before deleting;
  controller bindings reference `Space`/`Enter`/digit ids only today, and
  the geometry test will catch a dangling binding id if one appears.
- [ABC mode loses one-tap `, .` — DATA lists and decimals cost a mode
  switch] → accepted by the user (strict symbol-mode punctuation); the SYM
  page keeps the number row functional, so numeric lists type without
  flipping back.
- [`modeOnly` rendering interacts with compact mode's layer selector and
  `--vk-max-len` font sizing] → exclude `modeOnly` layers from the
  selector and from the max-length scan unless their mode is active; covered
  by a `keyboardTheme`/`VirtualKeyboard` unit assertion and the extended
  touch-input e2e journey.
- [Twelve layout files change at once] → migrate one machine per commit on
  top of the shared helpers, mirroring the legend-kit migration; each
  commit passes the full quality gate.

## Open Questions

None — arrangement, SYM positions, and the adaptation decisions ($ on page
1, `.` in the `?` slot, `!` dropped, unmapped-slot rule) were settled with
the user during exploration.
