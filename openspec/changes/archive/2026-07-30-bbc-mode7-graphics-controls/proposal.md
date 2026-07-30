## Why

The BBC graphics palette inserts MODE 7 mosaics into the editor perfectly, and
then the program prints letters and punctuation. `PRINT` a mosaic byte with no
graphics-colour control code earlier on the same screen line and the SAA5050
shows the character its low seven bits name: `CHR$(161)` is `!`.

That is the machine, not the IDE. The chip has a seven-bit data bus, it starts
every screen line in text mode, and only a graphics-colour code
(`{GRAPHICS RED}`…`{GRAPHICS WHITE}`) switches the rest of that line to
mosaics. The emulator reproduces it exactly, the charset already spells those
control codes, and the tokenizer already encodes them.

What is missing is the seam between the two: the palette hands the user 63
mosaic characters, offers no way to reach the one byte that makes them draw,
and says nothing about needing it — its section titles (`CHR$(161)–CHR$(191)`)
positively suggest `PRINT CHR$(161)` is enough. A user following the palette
writes a program that cannot work, and nothing in the IDE tells them why.

The escapes are also expensive to read: `{GRAPHICS WHITE}` is sixteen columns
of a forty-column line, so a line of teletext is mostly punctuation about
colour rather than the picture.

## What Changes

- **The BBC palette gains the MODE 7 control codes.** A graphics-colour
  section (`0x91`–`0x97`) leads the palette, ahead of the mosaics it enables,
  and a graphics-style section (`{CONTIGUOUS}`, `{SEPARATED}`,
  `{HOLD GRAPHICS}`, `{RELEASE GRAPHICS}`) closes it.
- **The palette states the rule** it previously left the user to discover: a
  mosaic draws as a letter until a graphics colour appears earlier on the same
  screen line. The mosaic sections are retitled so a bare code range no longer
  implies `CHR$(n)` alone will do.
- **Control codes are drawn, not spelled.** In the palette and in the editor a
  teletext control escape shows as a small chip — a box in the colour the code
  selects, carrying a symbol for what it does — instead of its name in full.
  One character cell instead of sixteen, and the colour is legible at a glance.
  The source text and the stored byte are unchanged; the chip is presentation,
  and it is one unit for the cursor, so a single backspace removes the whole
  escape.
- **The rule is documented** on the BBC escape-codes and hardware pages, with a
  worked example.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `virtual-input`: the palette requirement gains the case of a machine that
  only displays its graphics characters after a display control code — the
  palette offers those codes too, ahead of the characters they enable, and says
  they are needed.
- `code-editor`: a new requirement for display control codes shown as chips,
  beside the existing opaque-binary-line chips.

`dialect-toolchain` gains no delta. The charset, tokenizer and detokenizer are
untouched: `{GRAPHICS WHITE}` already encodes to `0x97` and `0x97` already
renders back to `{GRAPHICS WHITE}`.

## Non-goals

- **No emulator change.** The BBC emulator is faithful. Program bytes reach
  screen memory unaltered, and the SAA5050's seven-bit bus and per-row graphics
  flag are the real chip's behaviour. Nothing in the emulator or the machine
  adapter changes, and no test asserts a different screen.
- **No context-aware decoding.** The `bbc-mode7-semigraphics` change ruled that
  out and it still holds: a mosaic byte's editor spelling does not vary with
  the control codes around it. A chip changes how a control escape is drawn,
  never which byte a character means.
- **No lint for a mosaic with no graphics colour.** The display state is not
  line-local — the bundled `maze.bas` sets its colour with a `VDU` in an
  earlier statement — and the check is defeated by `VDU 150`, `CHR$(150)`,
  strings assembled in variables and screen pokes. It would flag correct
  programs, including one the IDE ships.
- **The text colours stay out of the palette.** `{RED}`…`{WHITE}` turn graphics
  *off*; a cell for them beside the mosaics would manufacture the bug this
  change fixes. They still draw as chips in the editor, because imported
  programs contain them.
- **No new sample program.** The canonical sample set is unchanged.
- **Only the BBC pair gets chips.** The mechanism is dialect data, so another
  machine's control codes can opt in later; none do here.
