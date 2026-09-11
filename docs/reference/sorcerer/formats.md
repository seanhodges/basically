---
title: Exidy Standard BASIC file formats
---

# Exidy Standard BASIC file formats

The Sorcerer had one thing to write to and it was a cassette, so both of its
exports are the same tape in different wrappers: **`.tape`**, the records as
bytes, which is what an emulator reads directly; and a cassette **`.wav`**
carrying the same records as audio for a real machine listening on its tape
port. Both are also import formats and round-trip back to editable source, and
both carry the document's
[memory blocks](../file-formats#machine-code-data-blocks) — a tape holding a
BASIC program with a memory-range file beside it is the ordinary shape of a
Sorcerer tape rather than something invented here.

For the shared editor `.txt`, `.zip` project bundle, escape notation and the
cross-machine machine-code overview, see the
[file formats overview](../file-formats). See also the
[Exidy Standard BASIC reference](../sorcerer), its [hardware notes](./hardware)
and its [escape codes](./escapes).

## Sorcerer `.tape`

A tape is a stream of **Exidy cassette records**, one after another to the end
of the file, with nothing wrapped around them — no signature, no directory, no
count. That is what the machine itself writes, and it is why a tape may hold
several files: a loader reads past every record whose name does not match.

One file is two leads and two kinds of payload:

```text
  <lead> <16 header bytes> <checksum>
  <lead> <256-byte block> <checksum>  … <short final block> <checksum>
```

A `<lead>` is 100 bytes of `0x00` followed by a single `0x01`, which is what
marks the start of what follows. The header is sixteen bytes:

| Offset | Size | Field                                               |
| ------ | ---- | --------------------------------------------------- |
| 0      | 5    | name, space padded                                  |
| 5      | 1    | file type, `0x55`                                   |
| 6      | 1    | `0xC2` for a `CSAVE`d BASIC program, otherwise zero |
| 7      | 2    | file length, little endian                          |
| 9      | 2    | load address, little endian                         |
| 11     | 2    | execution address, little endian                    |
| 13     | 3    | zero padding                                        |

The data then follows in 256-byte blocks, each with its own checksum, the last
of them short. The checksum is the Monitor's own and it is neither a sum nor a
CRC, despite the machine calling a bad one a `TAPE CRC ERROR`: it starts at
zero and, for each byte, subtracts the running value from that byte and inverts
every bit of the result. Writing a lead resets it, so the header's checksum
covers exactly the sixteen header bytes and a block's covers exactly that block.

**The name is five characters.** That is all the header has room for, so a
longer document name is cut to its first five letters — which is also all
`CLOAD "NAME"` can ask for.

**A saved program is one byte longer than the program.** `CSAVE` hands the
Monitor's save routine the start of the program text and the first byte past it
as an _inclusive_ end, and `CLOAD` sets the variable pointer back from that
length. A record one byte shorter would leave that pointer inside the program's
own end-of-program link, and the first variable assigned would overwrite it.

On import, the record stamped `0xC2` is the one that opens in the editor and
every other record becomes a memory block at its own load address. A tape
written entirely by the Monitor's own `SA`ve carries no stamp at all, so there a
record loading at the program base is taken as the program — which is what the
machine's `CLOAD` would do with it.

Neither export generates an auto-loader. Pulling a memory-range file off tape is
a Monitor command (`BYE`, then `LO NAME`, then `PP`), not something a BASIC
program can do to itself, so there is nothing a generated loader could usefully
say.

## Cassette audio

The Sorcerer exposes a `.wav` export (and "play through speakers") **and** a
cassette-audio import — listening on the mic / line-in, or decoding a `.wav`
recording, back into editable source. The encoder emits mono 44.1 kHz. The
cassette `.wav` carries exactly the records of the `.tape` above.

The modulation is the Computer Users Tape Standard, which at its slower rate is
Kansas City Standard exactly: a `0` bit is a whole number of 1200 Hz cycles and
a `1` bit is twice as many cycles at 2400 Hz, so both bits last the same time
and the baud rate is only the cycle count. The Sorcerer offers two of them —
**1200 baud**, one cycle a `0`, which is what the machine signs on set to; and
**300 baud**, four cycles a `0`, which the Software Manual offers as the
reliable one.

Above the modulation it is ordinary asynchronous serial, because a serial chip
is what drives it: each byte is a `0` start bit, eight data bits
least-significant first, and **two** `1` stop bits. An unbroken 2400 Hz carrier
is an idle line with no start bit in it, which is what the leader between
records is.

"Robust" mode is the machine's own answer to a temperamental recorder rather
than a longer leader alone: it records at 300 baud, and the listening machine
has to be told first — `BYE` to the Monitor, `SE T=1`, then `PP` to come back.

To load on a real Sorcerer, type `CLOAD "NAME"` and press RETURN before starting
playback; `READY` comes back when the program is in. To save, start the recorder
and type `CSAVE "NAME"` — the tape tone plays from the cassette port.
