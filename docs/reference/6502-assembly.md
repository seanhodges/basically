---
title: 6502 assembly reference
---

<script setup>
import { m6502AssemblyReference } from './data/m6502-assembly';
</script>

# 6502 assembly reference

Every legal NMOS 6502 instruction, plus the assembler directives, understood by
the built-in assembly editor. This one reference covers every 6502 machine
Basically supports — the **Commodore 64**, **VIC-20** and **PET**, the **BBC
Micro** and **Master**, and the **Acorn Atom** all share the identical
instruction set and assembler syntax. What differs between them is only the
memory map (where a block may live and the entry points you call), which stays
on each machine's own hardware page.

Use the search box to filter by mnemonic, the buttons to show only
**Instructions** or **Directives**, and the **Name** / **Kind** headers to
re-sort. The 151 documented opcodes are listed here; illegal/undocumented
opcodes are not assembled and disassemble back as `DB` data.

<ReferenceTable :data="m6502AssemblyReference" />

## Addressing modes

Most instructions accept several addressing modes; the mode is written into the
operand:

| Form      | Mode             | Meaning                                  |
| --------- | ---------------- | ---------------------------------------- |
| _(none)_  | implied          | no operand — e.g. `TAX`, `RTS`           |
| `A`       | accumulator      | acts on A — e.g. `ASL A`                 |
| `#n`      | immediate        | the literal value `n`                    |
| `$nn`     | zero page        | address `$00`–`$FF` (shorter, faster)    |
| `$nn,X`   | zero page,X      | zero page indexed by X (`$nn,Y` for X/Y) |
| `$nnnn`   | absolute         | full 16-bit address                      |
| `$nnnn,X` | absolute,X       | absolute indexed by X (or `,Y`)          |
| `($nn,X)` | indexed indirect | pointer at `$nn+X` in zero page          |
| `($nn),Y` | indirect indexed | pointer at `$nn`, then add Y             |
| `($nnnn)` | indirect         | `JMP` only — jump through a pointer      |
| `label`   | relative         | branch target (`BNE`, `BEQ`, …)          |

A **narrow** literal (`$NN` or decimal under 256) selects the zero-page form; a
wide one (`$00FF`, a label, or an expression) selects absolute — so the
disassembler and assembler round-trip to the identical bytes.

## Numbers, labels & comments

Numbers may be written in any case as:

- **Hex** — `$FF`, `0xFF`, or a leading-digit `0FFh`
- **Binary** — `%1010` or `0b1010`
- **Decimal** — `65535`

Disassembly always writes hex with a `$` sigil (two digits for a byte, four for a
word). A **label** is a name followed by a colon at the start of a line
(`loop:`); refer to it by name in a branch, jump or address operand. Operands may
use simple `+`/`-` expressions (`sprite+1`). Everything after a semicolon (`;`)
is a comment.

## Directives

Four pseudo-ops control layout and data:

- `ORG $nnnn` — set the origin. It must match the block's own load address, which
  the block editor fixes from where the block sits, so you rarely change it by
  hand.
- `DB n[,n…]` — emit literal bytes (data tables, text).
- `DW nn[,nn…]` — emit little-endian 16-bit words.
- `DS n` — reserve `n` zero-filled bytes.

## Where blocks live on each machine

The address ranges a routine may occupy, the default load address, and the entry
points you call (`SYS`, `CALL`, `USR`, `LINK`) are machine-specific — see the
**Memory** section on each machine's hardware page:
[Commodore 64 & VIC-20](./commodore64/hardware),
[Commodore PET](./pet/hardware), [BBC Micro & Master](./bbc/hardware) and
[Acorn Atom](./atom/hardware).

See also the [machine code guide](../guide/machine-code) and the cross-dialect
[Machine code & data blocks](./file-formats#machine-code-data-blocks) overview.
