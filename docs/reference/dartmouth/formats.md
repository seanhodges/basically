---
title: Dartmouth BASIC file formats
---

# Dartmouth BASIC file formats

Neither machine had a cassette deck, a disc a user could reach or a native
program container. What each had was the punch and reader built into the
Teletype Model 33 ASR, so there is exactly one export apiece — a **paper tape**,
written as plain text in a `.txt` file. It is text, so it opens straight back
through the ordinary file path and needs no import format of its own. No export
here carries [memory blocks](../file-formats#machine-code-data-blocks), because
both machines are offered as BASIC only and neither has any.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine format overview, see the [file formats
overview](../file-formats). See also the [Dartmouth BASIC
reference](../dartmouth) and its [escape codes](./escapes).

## The GE-235

### GE-235 paper tape `.txt`

How a program left a machine with no storage of its own: `LIST` with the
Teletype's punch running, and the reader feeds the tape back a line at a time.

The export is the listing as the tape carries it rather than as the editor shows
it — the line number, one space, then the body with its blanks removed, since
the compiler deletes them before it reads a line anyway. Blank editor lines are
gone, and the lines are in the order they were typed. Each line ends with a
carriage return and a line feed, as a Teletype needs; the editor's own bare line
feed would leave the carriage where it was.

Two things a reader coming from the Altair's paper tape will notice, and both
follow from this machine's codes not being ASCII:

- **`{0oNN}` escapes stay spelled out.** On a machine whose codes are ASCII an
  escape can resolve to the byte it names, because that byte is what the punch
  wrote. Here it would be a six-bit code no text file could show, and the file
  would stop being openable. Spelled out, it survives the round trip.
- **Nothing closes the file.** The tape's own terminator is the end-of-message
  code, which has no printable form; the end of the file says the same thing.

The power operator is written as the up arrow `↑` it is typed as. That is the
character the Teletype's keyboard had, and the revision of ASCII that spells it
`^` is two years younger than the machine — so the tape carries the character
the machine had, which is also the one the editor reads back.

### Cassette audio {#ge235-cassette-audio}

There is none. The GE-235 had no tape interface to model: a user reached it over
a telephone line from a teletype, and the only thing that recorded a program was
that teletype's paper-tape punch, described above. The IDE offers no `.wav`
export and no cassette import for this machine.

## The GE-635

### GE-635 paper tape `.txt`

The same procedure on the same terminal, and the manual gives it in full:
`LISTNH` with the paper-tape unit switched on to punch one, then `NEW`, the file
name, `TAPE` and `KEY` to read one back.

The export is again the listing as the tape carries it — the line number, one
space, the trimmed body — with blank editor lines gone, the lines in the order
they were typed, and each closed by the carriage return and line feed a Teletype
needs. `↑` is written as itself here too: it is code 94, the character the
ASR-33's key face carries and this BASIC raises to a power with, rather than the
`^` a later ASCII puts there.

Two things follow from that, and only the second is a difference from the
GE-235's tape:

- **A `{0xNN}` escape stays spelled out**, exactly as the GE-235's `{0oNN}`
  does. This machine's codes are ASCII, so unlike its sibling it _could_ put the
  byte itself on the tape — but a `.txt` is opened again as text, and a code the
  Teletype cannot print is not a character that can be typed back in. Spelled
  out, it survives the round trip; resolved, it would make a file the IDE could
  no longer read. The same goes for `↑` and `←`, whose codes a later ASCII reads
  as `^` and `_`.
- **Nothing closes the file**, and for a different reason from the GE-235's:
  there is no end-of-message code to leave out. ASCII has none and the manual
  names none, so the end of the file says the same thing.

### Cassette audio {#ge635-cassette-audio}

There is none, for the same reason as on the GE-235. The machine had no tape
interface to model — a user reached it over a telephone line — and the only
thing that recorded a program was the teletype's own paper-tape punch. The IDE
offers no `.wav` export and no cassette import for this machine.
