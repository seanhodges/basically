# File formats

## Editor source format (.bas)

Plain UTF-8 text, one BASIC line per text line: a line number (1–9999)
followed by exactly one statement. Keywords are written as words (`PRINT`,
`GOTO`, `INKEY$`, `**` for power). Lowercase input is folded to uppercase.

Special character conventions (zxtext2p-compatible where practical):

| Source               | Meaning                                                          |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `▘▝▀▖▌▞▛`            | quarter/half block graphics (codes 0x01–0x07)                    |
| `█▟▙▄▜▐▚▗`           | inverse block graphics (0x80–0x87)                               |
| `▒`                  | grey block (0x08)                                                |
| `\!!` `\!'` `\!.`    | grey full / top / bottom (0x08–0x0A)                             |
| `\|                  | ` `\|'` `\|.`                                                    | inverse grey full / top / bottom (0x88–0x8A) |
| `\' ` `\ '` `\''` …  | quadrant escapes: left+right column, `'`=top `.`=bottom `:`=full |
| `%A` … `%9`          | inverse video character                                          |
| `""` inside a string | the quote-image character (0xC0)                                 |
| `£`                  | pound sign (0x0C)                                                |

`#` and other characters outside the ZX81 set are tokenizer errors.

## Tokenized program area

Per line: `u16 BE line number`, `u16 LE length` (body + terminator),
tokenized body, `0x76` (NEWLINE). Numeric literals appear as their printable
characters followed by `0x7E` and the 5-byte ZX81 float (exponent+0x80,
then a 4-byte mantissa whose top bit is replaced by the sign).

## .P files

A `.P` file is the ZX81 memory dump from 0x4009 (VERSN) up to but not
including the address in E_LINE — identical to what the ROM's SAVE writes:

```
0x4009  system variables (0x74 bytes)
0x407D  tokenized program
        display file (this IDE writes a collapsed one: 25 x 0x76)
        variables area (terminated by 0x80)
```

The IDE sets `NXTLIN` to the first program line so loaded programs auto-run
(toggleable in `buildPFile`), and `CDFLAG` bit 6 for SLOW mode.

## Cassette audio

Dialects whose machines loaded from tape expose a `.wav` export (and "play
through speakers") via the optional `audio` field on the `Dialect` interface.
All encoders emit mono 44.1kHz and offer a "robust" mode that lengthens the
leader/pilot for temperamental hardware. Each machine uses its own tape
encoding:

- **ZX81 / ZX80** — see `docs/serial-protocol.md` § Delivering a .P image: bytes
  MSB-first, `0` = 4 pulses, `1` = 9 pulses, ~1300µs inter-bit gap, 2s leader
  (4s robust). Code: `src/dialects/zx81/audio/cassetteEncoder.ts`.
- **ZX Spectrum** — the standard ROM tape format, derived from the same two tape
  blocks the `.TAP` export uses (`tapBlocks()` in `zxspectrum/tapfile.ts`). Each
  block is a pilot tone (2168 T-state pulses; 8063 for the header block, 3223 for
  data), a 667 T + 735 T sync pair, then data bytes MSB-first where bit `0` = two
  855 T pulses and bit `1` = two 1710 T pulses (1 T-state = 1/3.5MHz). Code:
  `src/dialects/zxspectrum/audio/cassetteEncoder.ts`.
- **BBC Micro / Master** — the cassette filing system (CFS) over Kansas City
  Standard FSK at 1200 baud: `0` = one 1200 Hz cycle, `1` = two 2400 Hz cycles,
  each byte framed 8N1 (start `0`, 8 data bits LSB-first, stop `1`), with a 2400 Hz
  carrier tone leading in and between blocks. The program is split into ≤256-byte
  CFS blocks, each with a `*` (0x2A) sync byte, a header (filename, load/exec
  addresses, block number/length/flag, spare) protected by a CRC-16/CCITT, the
  data, and a data CRC-16. The last block sets bit 7 of the flag. Code:
  `src/dialects/bbcmicro/audio/cassetteEncoder.ts` (shared by both BBC dialects).
