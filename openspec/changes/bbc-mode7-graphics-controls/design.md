## Context

Two dialects are in scope, BBC Micro and BBC Master, and the Master reuses the
Micro's charset and keyboard layout wholesale, so one implementation moves
both. See `docs/contributing/architecture.md` for the layering and
`docs/contributing/semigraphics-support.md` for the derived matrix; the
`bbc-mode7-semigraphics` change built the mosaics this one makes drawable.

The hardware facts this change is built on are derived from the SAA5050
implementation the IDE itself ships (`jsbeeb/src/teletext.js`), not from
memory:

- `fetchData` stores `data & 0x7f` — the chip has seven data lines, so `0xA1`
  and `0x21` are the same character to it.
- `handleControlCode` sets `gfx = true` only for codes 17–23 (`0x91`–`0x97`)
  and sets `gfx = false` for codes 1–7 (`0x81`–`0x87`, the text colours).
- `setDISPTMG` resets `gfx`, `sep`, `col` and the held character at the start
  of every character row.

Together: a mosaic byte draws as a mosaic only while a graphics colour is in
force on its own row.

## Impact on the Dialect / MachineEmulator seam

`Dialect` gains one optional data field, `displayControls` — a table of the
dialect's display-control escapes and how to draw each. It is data of the same
kind as `keyboardLayout` and `supportsBinaryLines`: the editor and the palette
read it, nothing machine-specific leaks past it, and a dialect without it
behaves exactly as today.

`MachineEmulator` is untouched. Palette cells still emit the ordinary
`EditorKeyAction { insert }`, so nothing downstream distinguishes a chip cell
from a key press, and `GraphicEntry.chip` is presentation only — `char` remains
the inserted text and the byte's canonical form.

## Decisions

### The chip is drawn from the escape text, not instead of it

A control cell keeps `char: '{GRAPHICS RED}'` and adds `chip` for how to draw
it. Keeping `char` as the full escape is what preserves the palette's existing
guarantees without special-casing: `charset.toMachine(entry.char)` is still the
single byte `entry.code`, and `charset.toUnicode([code])` is still exactly
`entry.char`. The alternative — a one-character stand-in glyph plus a separate
`insert` field — would have silently exempted every control cell from those
assertions.

The same holds in the editor. The chip is a CodeMirror replace-decoration over
the escape's range; the document still contains `{GRAPHICS RED}`, so
tokenizing, exporting, sharing and the AI path all see the text they always
saw. This is the `#BIN` chip's pattern (`src/editor/binaryLineWidget.ts`),
including `atomicRanges` so the cursor treats the escape as one unit.

### Chips are inline SVG, sized to the line

A chip must not change the height or alignment of the line it sits in, which
the `code-editor` capability already requires of machine graphics. Inline SVG
in a `1em` box with `vertical-align: text-bottom` satisfies that without
depending on a font, and needs no asset — the same self-contained constraint
the bundled graphics faces satisfy for characters.

Pale fills (white, yellow, cyan) need a border to read on the editor's paper
and on the palette's white cells, and the symbol is knocked out in black or
white by the fill's luminance, so every chip stays legible either way.

### The editor decorates string literals only

Escapes are recognised by the tokenizer inside strings, `REM`, `DATA` and
`*`-command lines. The editor decorates only double-quoted strings: that is
where the palette inserts and where MODE 7 output is written, and it needs
nothing more than quote parity per line. Recognising the other three contexts
would mean re-implementing the tokenizer's keyword scan in the editor, with a
wrong answer showing as a chip over text that is not an escape. An escape in a
`REM` stays spelled out, which is correct if verbose.

### Graphics colours lead the palette; graphics styles close it

The first section is a precondition — you must use one of these — so it sits
above the mosaics with the rule under its title. `{CONTIGUOUS}`, `{SEPARATED}`,
`{HOLD GRAPHICS}` and `{RELEASE GRAPHICS}` refine mosaics that already work, so
they go last; `{HOLD GRAPHICS}` in particular only makes sense once the user
has seen that a control code occupies a screen cell.

The text colours `{RED}`…`{WHITE}` are deliberately absent: they clear `gfx`.
A test derives the palette's colour set from jsbeeb — exactly the codes for
which the chip turns graphics on — so adding them later fails.

### Rejected: a lint diagnostic

A "mosaic with no graphics colour before it" warning was considered and
rejected. The display state spans statements and lines: `maze.bas` sets its
colour with `VDU 31,0,R%,150` and then prints bare mosaic strings, so the IDE
would flag its own bundled sample. `VDU 150`, `CHR$(150)`, a colour held in a
variable and direct screen pokes all defeat it too. Teaching the rule in the
palette and the docs carries no false positives.

### Rejected: a colour swatch as the palette cell's character

Drawing the cell as a plain colour block was rejected before the chip design:
the palette is specified as ink on paper and a filled colour cell reads as the
inverse of what it inserts. A bordered chip with a symbol is a picture of the
control code, not a character in the machine's colours.
