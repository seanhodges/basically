---
title: BBC escape codes
---

<script setup>
import { bbcEscapes } from '../data/escapes/bbc';
</script>

# BBC escape codes

Every escape that can be typed in BBC BASIC source (Micro and Master share the notation), and the byte it stores. Escapes are recognised in string literals, REM and DATA bodies and `*`-command lines - the contexts where raw bytes live in a real program. On a MODE 7 screen the named teletext escapes are the colour/effect control bytes. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [BBC BASIC reference](../bbc) and
[file formats](../file-formats#escape-notation).

## MODE 7: turn graphics on first

A mosaic character is not a shape the teletext chip always draws. Every screen
line starts in **text** mode, and the chip only has seven bits of each stored
byte to work with — so a mosaic printed with nothing in front of it comes out
as the character its low seven bits name. `PRINT CHR$(161)` on its own gives
`!`, not a block.

What makes it a block is a **graphics colour** earlier on the same line:

```basic
10 MODE 7
20 PRINT "{GRAPHICS WHITE}🬂🬎🬂"
30 PRINT "{GRAPHICS YELLOW}🬀🬁🬂"
```

Three things follow from that, and all three bite:

- **It resets every line.** A graphics colour holds only to the end of the
  screen line it is on. The next line starts in text mode again and needs its
  own.
- **The plain colours turn graphics off.** `{RED}`, `{WHITE}` and the rest are
  _text_ colours: they change the colour and go back to letters. Use
  `{GRAPHICS RED}` … `{GRAPHICS WHITE}` to change colour and stay in graphics.
- **A control code takes a character cell**, showing as a space. That is what
  `{HOLD GRAPHICS}` is for: it repeats the last mosaic under the next control
  code, so a colour change mid-picture does not punch a hole in it.

The on-screen keyboard's GRAPHICS palette offers the graphics colours ahead of
the mosaics for this reason — take a colour first, then the shapes.

In the editor these control codes are drawn rather than spelled out: a small
box in the colour the code selects, carrying a symbol for what it does — a
mosaic cell for the graphics colours, an `A` for the text colours, and a
matching mark for the rest. Hover one to see its name and character code. It
is only the drawing that changes: the program still holds the escape exactly as
written, it still exports byte-for-byte, and one delete removes the whole code.

<EscapeTable :data="bbcEscapes" />
