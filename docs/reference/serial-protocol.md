# Serial bridge protocol

The IDE can push a built program to real hardware over WebSerial via a
microcontroller bridge (Arduino, Pi Pico, ESP32…). The bridge firmware is out
of scope for this repo; this document specifies the wire protocol it must
implement, plus notes on delivering the program to each machine.

The "Send via serial bridge" button is offered for **every** dialect, not just
the ZX81. The payload is always the active dialect's native binary image — the
exact bytes it exports as `.P` / `.O` / `.TAP` / `.bbc` / `.prg` / `.cas` /
`.atm` (see `docs/reference/file-formats.md`). The protocol below is dialect-agnostic; the
magic and command name are historical (the ZX81 was the first machine
supported). It's the bridge's job to know which machine is attached and how to
turn that image into something the machine loads — § Delivering the image
sketches the options.

## Link

- 115200 baud, 8 data bits, no parity, 1 stop bit (8N1).
- The IDE is always the initiator.

## Frame layout

```
+-------------+------+----------------+
| magic       | cmd  | length         |
| "Z81!" (4B) | u8   | u32 little-end |
+-------------+------+----------------+
| payload, in 256-byte blocks:        |
|   block bytes (<=256)               |
|   CRC32 of block bytes, u32 LE      |
|   ... wait for ACK/NAK ...          |
+-------------------------------------+
| EOT (0x04)                          |
+-------------------------------------+
```

| Field  | Value                                                          |
| ------ | -------------------------------------------------------------- |
| magic  | `5A 38 31 21` ("Z81!")                                         |
| cmd    | `0x01` = LOAD_P (payload is the active dialect's native image) |
| length | payload byte count                                             |

Despite the name, a `LOAD_P` payload is **not** always a ZX81 `.P` — it is
whatever native image the selected dialect builds (`dialect.tokenize().image`),
so the bridge should determine the target machine out of band (a DIP switch,
config, a separate handshake) rather than from the command byte.

The final block may be shorter than 256 bytes; its CRC32 still follows it.
CRC32 is the standard reflected polynomial `0xEDB88320` (same as zlib).

## Handshake

After each block (bytes + CRC) the bridge replies with a single byte:

- `0x06` ACK — block accepted, send the next one.
- `0x15` NAK — CRC mismatch, the IDE resends the same block (up to 3 times).

After the last block is ACKed the IDE sends `0x04` (EOT). The transfer is
complete; the bridge now owns delivery to the machine.

## Delivering the image

The payload reaches the bridge as a single native image; turning it into
something the attached machine loads is the bridge's responsibility. Two
families of design work across every dialect:

1. **Cassette signal synthesis (no machine modification).** The bridge
   re-encodes the image as the machine's tape signal on a GPIO pin wired to the
   tape / EAR input (through a voltage divider to a safe level), and the user
   types the machine's load command first. The per-machine tape encodings are
   the same ones the IDE's `.wav` export uses — fully specified in
   `docs/reference/file-formats.md` § Cassette audio (pulse counts/lengths, framing,
   block layout, checksums) for the ZX81/ZX80, Spectrum (and 128), BBC, C64,
   TRS-80 and Atom. The native image the bridge receives is exactly the input
   those encoders take.

2. **RAM injection (requires bus access).** Bridges with access to the
   machine's bus can DMA the image straight into memory and fix up the BASIC
   pointers, skipping the tape path entirely. This is hardware-specific and not
   specified here. Examples per machine:

   - **ZX81** — DMA to 0x4009 and patch NXTLIN (ZXpand-style).
   - **ZX80** — DMA to 0x4000 and patch the system variables.
   - **ZX Spectrum / 128** — load the `.TAP` program block to PROG and set
     PROG/VARS/E_LINE.
   - **BBC Micro / Master** — copy the tokenized image to PAGE and set TOP.
   - **Commodore 64** — copy past the 2-byte load address to $0801 and fix the
     BASIC link pointers / end-of-program (a `.prg`-style load).
   - **TRS-80** — write the tokenized program to 0x42E8.
   - **Acorn Atom** — write the `#2900` image to memory at #2900.

### Per-dialect load commands and payloads

| Dialect            | Native payload | User types first (tape path)           |
| ------------------ | -------------- | -------------------------------------- |
| ZX81               | `.P`           | `LOAD ""`                              |
| ZX80               | `.O`           | `LOAD`                                 |
| ZX Spectrum / 128  | `.TAP`         | `LOAD ""`                              |
| BBC Micro / Master | `.bbc`         | `*TAPE` then `LOAD ""` (or `CHAIN ""`) |
| Commodore 64       | `.prg`         | `LOAD` (datasette) then `RUN`          |
| TRS-80             | `.cas`         | `CLOAD`                                |
| Acorn Atom         | `.atm`         | `LOAD ""`                              |

Each payload is exactly the file the IDE exports for that dialect (see
`docs/reference/file-formats.md` § Native binary formats).
