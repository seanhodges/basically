---
title: Language reference
---

# Language reference

A reference page for each BASIC dialect Basically supports, with a searchable,
sortable table of every command, function and operator, plus sub-pages for the
machine's hardware, escape codes and file formats.

Porting a program between machines? The [Porting guide](./compare)
summarises the keyword, control-code and hardware differences between any two
dialects.

## BASIC dialects

Each dialect powers one or more of the emulated machines:

- [Altair 8K BASIC](./altair8800) — MITS Altair 8800
- [Atom BASIC](./atom) — Acorn Atom
- [BBC BASIC](./bbc) — BBC Micro, BBC Master
- [Commodore BASIC](./commodore) — Commodore 64, VIC-20, PET
- [Locomotive BASIC](./cpc) — Amstrad CPC 464, Amstrad CPC 6128
- [TRS-80 Level II BASIC](./trs80) — TRS-80
- [ZX Spectrum BASIC](./zxspectrum) — ZX Spectrum 48K, ZX Spectrum 128K
- [ZX80 BASIC](./zx80) — ZX80
- [ZX81 BASIC](./zx81) — ZX81

## Assembly language

Machine-code blocks are written in assembly, using the same searchable-table
treatment for every instruction and directive the built-in assembler
understands. The instruction set is per-CPU, not per-machine, so there is one
reference for each processor — cross-linked from every dialect that uses it:

- [Z80 assembly](./z80-assembly) — ZX81, ZX80, ZX Spectrum, TRS-80, Amstrad CPC, Altair 8800 (8080)
- [6502 assembly](./6502-assembly) — Commodore 64/VIC-20/PET, BBC Micro/Master, Acorn Atom
