---
title: Amstrad CPC Locomotive BASIC reference
---

# Amstrad CPC Locomotive BASIC reference

The **Amstrad CPC 464** runs **Locomotive BASIC 1.0** on a 4 MHz Z80. It is a
full-featured Microsoft-era BASIC with real structured keywords — `IF … THEN …
ELSE`, `WHILE … WEND`, `GOSUB`, and the `AFTER`/`EVERY` interrupt timers — plus
the CPC's colour graphics and three-channel sound.

## Screen modes

Pick a mode with `MODE`:

| Mode     | Text       | Graphics  | Inks |
| -------- | ---------- | --------- | ---- |
| `MODE 0` | 20 columns | 160 × 200 | 16   |
| `MODE 1` | 40 columns | 320 × 200 | 4    |
| `MODE 2` | 80 columns | 640 × 200 | 2    |

All three render into one display; graphics always use a 640 × 400 coordinate
space with the origin at the bottom-left, moved with `ORIGIN`.

## Colour

The CPC has **27 hardware colours** (0–26). `INK p,c` assigns colour `c` to pen
`p`; a second argument (`INK p,c1,c2`) flashes between two colours. `PEN` selects
the text ink, `PAPER` the text background and `BORDER` the surround.

## Graphics

`PLOT x,y[,pen]` lights a point, `DRAW x,y[,pen]` draws a line from the last
position, and `MOVE`/`DRAWR`/`MOVER` reposition or draw relatively. In BASIC 1.0
the plotting ink is the optional third argument to `PLOT`/`DRAW` (the `GRAPHICS
PEN`/`GRAPHICS PAPER` statements are BASIC 1.1 only and are not available on the
464).

## Sound

`SOUND channel,period,duration[,volume[,volenv[,toneenv[,noise]]]]` plays a tone;
`period` is `62500 / frequency`. `ENV` and `ENT` define volume and tone
envelopes.

## Language notes

- Line numbers 1–65535, strictly ascending; multiple statements per line with
  `:`. `?` is shorthand for `PRINT`, `'` for `REM`, and `LET` is optional.
- Variable names are up to 40 characters, all significant, with `$` (string),
  `%` (integer) and `!` (real) type suffixes.
- Numbers may be written in decimal, hex (`&7F00`) or binary (`&X1010`);
  operators include `^` (power), `\` (integer divide) and `MOD`.
- Read the keyboard in games with `INKEY(n)` — it returns `-1` while a key is up.
  The cursor keys are `INKEY(0)` up, `INKEY(2)` down, `INKEY(8)` left and
  `INKEY(1)` right.

> Locomotive BASIC 1.1 (as shipped on the CPC 6128) adds `FILL`, `FRAME`,
> `GRAPHICS PEN`/`PAPER`, `MASK`, `DERR` and more; those keywords are rejected on
> the BASIC 1.0 464.
