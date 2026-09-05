---
title: GE-235 file formats
---

# GE-235 file formats

The GE-235 had no cassette deck, no disc a user could reach and no native
program container. What it had was the punch and reader built into the Teletype
Model 33 ASR, so there is exactly one export here — a **paper tape**, written as
plain text in a `.txt` file. It is text, so it opens straight back through the
ordinary file path and needs no import format of its own. No GE-235 export
carries [memory blocks](../file-formats#machine-code-data-blocks), because this
machine is offered as BASIC only and has none.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine format overview, see the [file formats
overview](../file-formats). See also the [Dartmouth BASIC
reference](../dartmouth) and its [escape codes](./escapes).

## GE-235 paper tape `.txt`

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

## Cassette audio

There is none. The GE-235 had no tape interface to model: a user reached it over
a telephone line from a teletype, and the only thing that recorded a program was
that teletype's paper-tape punch, described above. The IDE offers no `.wav`
export and no cassette import for this machine.
