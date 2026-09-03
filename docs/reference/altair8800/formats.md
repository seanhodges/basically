---
title: Altair 8800 file formats
---

# Altair 8800 file formats

The Altair had no single program container, so it exports the three things the
hardware actually offered: the **`.bin`** `CSAVE` image, a cassette **`.wav`**
carrying the same bytes as audio, and a plain-ASCII paper tape as **`.txt`**.
The `.bin` is also an import format and round-trips back to editable source; a
paper tape is text, so it opens through the ordinary text file path. No Altair
export carries [memory blocks](../file-formats#machine-code-data-blocks) —
`CSAVE` wrote the program area and nothing else — though an import can bring one
back (below). The Transfer dialog names the blocks an export would leave behind before it writes the file.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the [file formats
overview](../file-formats). See also the [Altair 8K BASIC
reference](../altair8800) and its [escape codes](./escapes).

## Altair `.bin`

The byte stream `CSAVE` wrote and `CLOAD` read back, which is the closest thing
the machine has to a native program file. `.bin` because there is no documented
extension to claim, and a raw byte stream is what an Altair simulator feeds to a
virtual cassette board.

There is almost nothing to it: three `0xD3` marker bytes, one character of
program name, then the tokenized program exactly as it sits in memory, ending in
its own `0x0000` end-of-program link. No leader, no sync byte, no load address,
no length field, no checksum and no trailer. Saving an empty program writes the
four header bytes and the link and stops — which is what the manual's "reading
continues until 3 consecutive zeros" describes.

The **name is a single character**. BASIC takes the first character of whatever
string you give it, so `CSAVE"HELLO"` and `CSAVE"H"` write the same tape, and
`CLOAD` has to be given that one letter back. A tape holding a file named `B` in
front of the wanted `A` is skipped rather than loaded.

Import accepts the header or no header: a saved image and a bare program image
both open, and a program can never be mistaken for a header because its first
two bytes are a line link. Bytes found after the end-of-program marker are what
would have been written straight after the program, so they come back as a
[memory block](../file-formats#machine-code-data-blocks) at the address they
followed the program at.

The three `0xD3` bytes are where Microsoft's tokenized-BASIC marker starts. The
TRS-80 puts the same three behind a sync byte (see [TRS-80 file
formats](../trs80/formats)) and MSX writes ten of them; the Altair needs none in
front, because the cassette board's idle tone already gives the receiver
something to lock onto.

## Altair paper tape `.txt`

How a program left a machine with no cassette board at all: `LIST` with the
Teletype's paper-tape punch running, and BASIC re-reads the listing line by line
on the way back in. The export is the listing as bytes rather than as editor
text — `{0xNN}` escapes are punched as the bytes they name, and lines end with
carriage return and line feed as a Teletype needs, not with the editor's bare
line feed.

A real punch also interleaved null bytes after each line ending, which is what
BASIC's `NULL` command sets, giving the carriage time to return. They are left
out here: BASIC ignores them on the way back in, and without them the file stays
a plain readable listing.

## Cassette audio

The Altair exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1 kHz. The
cassette `.wav` carries exactly the bytes of the `.bin` above.

The encoding is the MITS 88-ACR board's own, and it is **not** the Kansas City
Standard other machines here use: it is 2400 Hz for a `1`, 1850 Hz for a `0`, at
300 baud. Those are the frequencies MITS settled on in March 1976, having
widened the split from the original pair because tapes would not interchange
between machines. Above the tones it is ordinary asynchronous serial, because
the board is a serial card with a modulator bolted on: each byte is a start bit,
eight data bits least-significant first, and a stop bit, with the line idling on
the 2400 Hz tone before, between and after — which is what gives the receiver
its leader.

Because a bit lasts a fixed 1/300 s whatever tone carries it, bit boundaries do
not fall on whole cycles, and the decoder times each half-cycle and samples the
bit cells at their centres rather than counting cycles. That is also what lets
it read a recording made at a different sample rate, or one played back by a
recorder running slightly off speed.

On a real Altair, type `CSAVE"A"` and start the recorder to save, and `CLOAD"A"`
and start playback to load; BASIC returns to `OK` when the program is in, and
`RUN` starts it. The emulated machine has no cassette board fitted — as most
Altairs did not — so those two commands wait at its console for hardware that
never answers. Import and export here work on the file and the audio directly,
without going through the emulator, so neither needs the board.
