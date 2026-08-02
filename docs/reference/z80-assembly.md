---
title: Z80 assembly reference
---

<script setup>
import { z80AssemblyReference } from '../../src/reference/z80-assembly';
</script>

# Z80 assembly reference

Every documented Z80 instruction, plus the assembler directives, understood by
the built-in assembly editor. This one reference covers every Z80 machine
Basically supports — the **ZX81**, **ZX80**, **ZX Spectrum** (48K & 128K),
**TRS-80** and **Amstrad CPC** all share the identical instruction set and
assembler syntax. What differs between them is only the memory map (where a
block may live and the entry addresses you call), which stays on each machine's
own hardware page.

Use the search box to filter by mnemonic, the buttons to show only
**Instructions** or **Directives**, and the **Name** / **Kind** headers to
re-sort. Undocumented opcodes (SLL, the IXH/IXL register halves) are not
assembled and disassemble back as `DB` data.

<ReferenceTable :data="z80AssemblyReference" />

## Operand notation

The **Syntax** column uses the conventional Z80 placeholders:

| Symbol | Means                                                         |
| ------ | ------------------------------------------------------------- |
| `r`    | 8-bit register — `A B C D E H L`                              |
| `s`    | an 8-bit source — a register, `n`, `(HL)`, `(IX+d)`, `(IY+d)` |
| `n`    | 8-bit immediate value; `nn` a 16-bit immediate                |
| `ss`   | 16-bit register pair — `BC DE HL SP` (or `AF`, `IX`, `IY`)    |
| `d`    | signed index displacement inside `(IX+d)` / `(IY+d)`          |
| `e`    | relative jump target (the label you jump to)                  |
| `cc`   | condition — `NZ Z NC C PO PE P M`                             |
| `b`    | bit number, `0`–`7`                                           |
| `p`    | restart vector — `$00 $08 $10 $18 $20 $28 $30 $38`            |

Registers, condition codes and index expressions like `(IX+5)` are recognised as
such, so they can't be used as label names.

## Numbers, labels & comments

The assembler accepts several number spellings, in any case:

- **Hex** — `$FF`, `0xFF`, or a leading-digit `0FFh`
- **Binary** — `%1010` or `0b1010`
- **Decimal** — `65535`

Disassembly always writes hex with a `$` sigil (two digits for a byte, four for a
word), so `$` never means "current address".

A **label** is a name followed by a colon at the start of a line (`loop:`); refer
to it by name in a jump or as an address. Operands may use simple `+`/`-`
expressions (`table+2`). Everything after a semicolon (`;`) is a comment.

## Directives

Four pseudo-ops control layout and data:

- `ORG nn` — set the origin. It must match the block's own load address, which
  the block editor fixes from where the block's `REM`/record sits in the
  listing, so you rarely change it by hand.
- `DB n[,n…]` — emit literal bytes (data tables, text).
- `DW nn[,nn…]` — emit little-endian 16-bit words.
- `DS n` — reserve `n` zero-filled bytes.

## Where blocks live on each machine

The address ranges a routine may occupy, the default load address, and the entry
points you call from BASIC are machine-specific — see the **Memory** section on
each machine's hardware page: [ZX81](./zx81/hardware),
[ZX80](./zx80/hardware), [ZX Spectrum](./zxspectrum/hardware),
[TRS-80](./trs80/hardware) and [Amstrad CPC](./cpc/hardware).

See also the [machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
