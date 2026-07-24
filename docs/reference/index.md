---
title: Language reference
---

# Language reference

A reference page for each BASIC dialect Basically supports, with a searchable,
sortable table of every command, function and operator, plus sub-pages for the
machine's hardware, escape codes and file formats.

## BASIC dialects

Each dialect powers one or more of the emulated machines:

- [ZX81 BASIC](./zx81) — ZX81
- [ZX80 BASIC](./zx80) — ZX80
- [ZX Spectrum BASIC](./zxspectrum) — ZX Spectrum 48K, ZX Spectrum 128K
- [BBC BASIC](./bbc) — BBC Micro, BBC Master
- [Commodore BASIC V2](./commodore64) — Commodore 64, VIC-20
- [Commodore BASIC 4.0](./pet) — Commodore PET
- [Atom BASIC](./atom) — Acorn Atom
- [TRS-80 Level II BASIC](./trs80) — TRS-80
- [Locomotive BASIC](./cpc) — Amstrad CPC 464

## Assembly language

Machine-code blocks are written in assembly, using the same searchable-table
treatment for every instruction and directive the built-in assembler
understands. The instruction set is per-CPU, not per-machine, so there is one
reference for each processor — cross-linked from every dialect that uses it:

- [Z80 assembly](./z80-assembly) — ZX81, ZX80, ZX Spectrum, TRS-80, Amstrad CPC
- [6502 assembly](./6502-assembly) — Commodore 64/VIC-20/PET, BBC Micro/Master, Acorn Atom
