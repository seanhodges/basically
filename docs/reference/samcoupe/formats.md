---
title: SAM Coupé file formats
---

# SAM Coupé file formats

The SAM Coupé exports one native binary — the **`.tap`** tape image SimCoupe and
libspectrum read — plus a cassette **`.wav`** carrying the same tape as audio.
Both round-trip back to editable source on import. Neither carries
[memory blocks](../file-formats#machine-code-data-blocks), for a reason peculiar
to this machine, described under the tape container below; blocks travel with
the document through the [project bundle](../file-formats#project-bundle-zip)
and share links instead.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the
[file formats overview](../file-formats). See also the
[SAM BASIC reference](../samcoupe), its [hardware notes](./hardware) and its
[escape codes](./escapes).

## SAM Coupé `.tap`

The blocks a real tape carries, each framed by a little-endian **length word**
and then written out as it would be recorded: a **type byte**, the payload, and
a **parity byte** that is the exclusive-or of everything before it, the type
byte included.

The type byte is where the SAM parts company with the Spectrum whose pulse
scheme it borrows:

| Type   | Block                                               |
| ------ | --------------------------------------------------- |
| `0x01` | a SAM header                                        |
| `0xFF` | a data block                                        |
| `0x00` | a Spectrum header, which the SAM ROM will also read |

One saved program is two blocks: a header and the data that follows it. A SAM
header is **80 bytes**, not the Spectrum's 17:

| Bytes     | What they hold                                                                    |
| --------- | --------------------------------------------------------------------------------- |
| `0`       | File type: 16 program, 17 numeric array, 18 string array, 19 `CODE`, 20 `SCREEN$` |
| `1`–`10`  | The file name, padded with spaces                                                 |
| `11`–`14` | Four more name characters, for devices whose names run longer                     |
| `15`      | Flags: bit 0 an invisible name, bit 1 protected code                              |
| `16`–`18` | Program length, excluding variables                                               |
| `19`–`21` | Program length plus the numeric variables                                         |
| `22`–`24` | Program length plus everything but the string and array variables                 |
| `25`–`30` | Directory entry and spares                                                        |
| `31`–`33` | Start address — ignored when a program is loaded, which always goes to `PROG`     |
| `34`–`36` | Data length                                                                       |
| `37`–`39` | Auto-run: `0xFF` in the first byte for none, else a zero and the line number      |
| `40`–`79` | A comment, which the ROM leaves uninitialised                                     |

Every three-byte number above is in the ROM's **page form**: a 16 KB page
number, then the two bytes of the address that page appears at in the
`0x8000`–`0xBFFF` window. The three length fields are what makes a load work —
the loader deletes everything from the program area up to the edit line and
rebuilds it to those three boundaries, so a header claiming no variable areas
leaves a machine with none, and the first `RUN` or `CLEAR` afterwards walks off
into memory that is no longer there. A freshly reset Coupé keeps 92 bytes in the
first variable area and 512 in the second, which is why a program that never
declares a variable still has areas to save.

The stored program ends in a `0xFF` standing where a line number's high byte
would be. It is part of the program area rather than a delimiter around it — the
ROM's own line walk stops on it — so it is saved with the program and counted in
every length the header carries.

**Why no memory blocks.** A SAM `CODE` file's header names its destination as a
page number the ROM adds the _saving_ machine's own low page register to, and
the loader shifts it again by a page offset it keeps in a system variable. A
`CODE` file's address is therefore only meaningful beside the paging it was
written under, which an exported file cannot carry. The IDE's emulator writes a
block into the processor's window directly instead, and the Transfer dialog asks
before dropping blocks from an export that cannot hold them.

Disc images — `.mgt`, `.sad` and `.dsk` — are not read.

## Cassette audio

The SAM exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1 kHz, and the
audio carries exactly the blocks of the `.tap` above.

The scheme is the Spectrum's: a square wave whose level flips on every pulse, a
long leader tone to lock onto, two short sync pulses, then **two equal pulses per
data bit** — short for `0`, twice as long for `1`, most significant bit first.

The timing is not a round number, because the ROM makes it out of a delay loop
rather than a table. The saver reads a speed register — `DEVICE T<n>` sets it,
and the value the machine boots with is 112 — uses it as the short-pulse count
`L`, derives the long-pulse count as `2 × (L + 1) + 1`, and spends `13 × R + 33`
T-states of a 6 MHz Z80 on a data pulse counted with `R`. That works out at 248 µs
and 497 µs for the two data pulses, within 2% of the Spectrum's 244 µs and
489 µs — so a SAM tape written at the default speed plays back at very nearly
Spectrum speed, rather than the 50% faster the machine's manual quotes for it.
`DEVICE T74` is the setting that gives the manual's 2250 baud.

Nothing downstream depends on the absolute figure. The ROM's loader locks onto
the leader and measures every later pulse against its running average, which is
why a SAM reads Spectrum tapes as happily as its own — and why the IDE's decoder
recovers a tape written at any speed the machine can be set to.

On a real SAM Coupé, type `LOAD ""` — or press **F7**, which types it for you —
and press ENTER before starting playback. To save, type `SAVE "NAME"` and press
ENTER; the machine asks you to start the tape and press a key, and the tone then
plays from the tape socket.
