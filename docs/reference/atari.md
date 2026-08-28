---
title: Atari BASIC reference
---

<script setup>
import { atariReference } from '../../src/reference/atari';
</script>

# Atari BASIC reference

Every command, function and operator in Atari BASIC, shared by the Atari 800 and
the Atari 400.

## Notes and caveats

- **A keyword is matched before a name, and matched greedily.** `LOGO` is read
  as `LOG` followed by `O`, and `LETTER = 1` assigns to a variable called `TER`.
  The machine reports nothing — it runs the line it read — so the editor flags a
  name that opens with a keyword instead.
- **A program may name at most 128 variables**, and a name is kept once it has
  been typed, even after the line using it is deleted. `CLR` forgets the values;
  only `NEW` gives the names back.
- **Statements are separated by `:`, and everything after `THEN` belongs to the
  `THEN`.** There is no `ELSE`, no `WHILE` and no `REPEAT`, so a statement
  written after an `IF` on the same line cannot be reached unconditionally.
- **There are no string functions but `LEN`.** A string is sliced by
  subscripting it — `A$(3, 5)` is characters 3 to 5 and `A$(3)` is from 3 to the
  end — and two strings are joined by assigning the second past the end of the
  first, `A$(LEN(A$) + 1) = B$`. `+` is arithmetic only, and there are no string
  arrays.
- **Every string and array must be `DIM`ensioned before use**, to a fixed size
  that never grows. A string is a buffer of that length; `LEN` reports how much
  of it is currently in use.
- **Numbers are ten-digit decimal floating point and there is no integer type.**
  There is also no hexadecimal, which is why every address in the table below
  and everywhere else on this machine is written in decimal.
- **`COLOR` and `SETCOLOR` are a pair, and the naming is the reverse of most
  machines here.** `COLOR` chooses _which_ of the five colour registers later
  drawing uses; `SETCOLOR` says _what colour_ a register holds. See the
  [hardware](./atari/hardware) page.
- **`?` is accepted for `PRINT`** and has a token of its own, but the machine
  lists it back as `PRINT`, so it is an entry spelling rather than a keyword and
  has no row below. The punctuation that separates the parts of a line — `(`,
  `)`, `,`, `;` and `:` — has no row either.

<ReferenceTable :data="atariReference" />

The machine hardware — screen modes, colour, graphics, sound and memory — is on
the [hardware](./atari/hardware) page; the control codes and graphics bytes
you can embed in source are on the [escape codes](./atari/escapes) page; the
native file containers and cassette encoding are on the
[file formats](./atari/formats) page.
