---
title: GE-235 hardware
---

<script setup>
import { ge235MemoryMap } from '../../../src/dialects/ge235/memoryMap';
</script>

# GE-235 hardware

The terminal, the paper it printed on and the core store behind it, for the
machine that runs [Dartmouth BASIC](../ge235).

## GE-235

### Screen modes

The GE-235 has no video hardware, and neither did anything attached to it. The
machine sat in a basement; the user sat at a **Teletype Model 33 ASR**, a
printing terminal on the end of a telephone line, and what it produced was ink
on a paper roll. There is one "mode", it is text, and it only ever moves
forwards.

The roll is drawn here as a fixed window 72 columns wide — the Model 33's own
line — by 24 lines deep. Output scrolls up it, and what leaves the top is gone,
exactly as paper rolling past the platen is gone. Nothing can be redrawn: there
is no cursor addressing, no clear-screen, no screen memory to write into, and no
way to ask where the carriage is. The smallest repaint this machine has is
printing the whole picture again.

`PRINT` lays a line out in five fifteen-column zones, so a comma moves to column
0, 15, 30, 45 or 60; a comma that finds the carriage already inside the fifth
zone starts a new line rather than looking for a sixth. A semicolon prints
nothing at all — every number already carries two trailing blanks — except past
column 66, where it starts a new line to keep the carriage off the margin. The
terminal acts on three codes and no others — carriage return, line feed and the
bell — while tab and the tape-framing codes pass through unprinted. All of them
are listed on the [escape codes](./escapes) page.

### Colour

The GE-235 has no colour hardware. The output is ink on paper, and the ribbon
was black.

### Graphics

The GE-235 has no graphics hardware, and Dartmouth BASIC has no graphics
keywords: no plotting, no block-graphics characters, no user-definable
characters. The printable alphabet is 57 characters — capitals, digits and
punctuation — and that is the whole of what can appear on the paper.

A picture is therefore built as characters and printed. The shape that works is
to fill a numeric array, then print it a row at a time; because a printed
character is taller than it is wide, halve the vertical axis to keep a circle
round. Printing a whole picture is slow, and on a shared machine it was slower
still — this is where the era's programs earn their reputation for asking a
question and then thinking about it for a while.

### Sound

The GE-235 has no sound hardware. The only noise in the room came from the
teletype: the print head, and the bell code, which struck a physical gong to
tell the typist a long run had finished. Nothing is audible here.

### Memory

The whole of the machine's core store, region by region. Zoom in to open a band
into the parts it groups, and select a region for its addresses and what sits
there.

<MemoryMapSingle machine="ge235" :map="ge235MemoryMap" />

**Every address in that map is a word, not a byte.** The GE-235's store is
twenty bits wide and is addressed a word at a time, three characters to a word
and two words to a number. It is the one machine here that is not
byte-addressed, so a span looks eight times smaller than the equivalent span on
any other page and every figure in a region's note is a word count. The viewer's
Int / Hex toggle is there for the same reason it is everywhere else, but the
machine's own listings are octal throughout and the notes quote them that way.

Only 8,192 words are mapped, which is half the store and the right half. That is
what one instruction's address field reaches, and what belongs to the user. The
second bank holds whichever language the time-sharing system last read in —
BASIC's own compiler is assembled to run there — and a compiled program cannot
reach it at all, which is why the run-time subroutines it does need are copied
down into the mapped bank before it starts. Everything from word 2,112 upwards
is the "6K area", the part written out to disk when the next user's turn comes;
below it the executive stays resident.

The user's program sits at the top of that: compiled code grows up from the
program area while the source text waits above it to be read, and variables grow
down from the top of core to meet it. When they meet, the compilation stops and
says the program is too long. Three of the language's limits are the same
arithmetic seen from another side — 240 lines, 128 `DATA` constants and 162
nested `GOSUB`s are each an allocation in that map divided by what one entry
costs.

There are **no memory blocks on this machine**, and no assembly-language
reference to send you to. The GE-235 is offered here as BASIC only: the language
has no `PEEK`, no `POKE` and no way to call a subroutine that is not a BASIC
line, so there is nothing a block of machine code could be loaded for. The
cross-dialect [Machine code & data blocks](../file-formats#machine-code-data-blocks)
overview describes what the machines that do have them do with them.
