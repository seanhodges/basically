---
title: Language reference
---

# Language reference

Searchable, sortable tables of every command, function and operator in each BASIC
dialect Basically supports. Use the search box to filter by name, syntax or
description, the buttons to narrow by kind, and the **Name** / **Kind** headers to
re-sort.

Each dialect also has three sub-pages: a **hardware** page covering each
machine's screen modes, colour, graphics, sound and memory (including where
machine-code blocks live); an **escape codes** page - the same searchable-table
treatment for every embedded control code, block graphic and raw-byte escape
its editor notation supports; and a **file formats** page detailing its
native binary(s), disc image and cassette encoding (see the cross-machine
[file formats overview](./file-formats)).

- [ZX81 BASIC](./zx81) · [hardware](./zx81/hardware) · [escape codes](./zx81/escapes) · [file formats](./zx81/formats)
- [ZX80 integer BASIC](./zx80) · [hardware](./zx80/hardware) · [escape codes](./zx80/escapes) · [file formats](./zx80/formats)
- [ZX Spectrum BASIC (48K & 128K)](./zxspectrum) · [hardware](./zxspectrum/hardware) · [escape codes](./zxspectrum/escapes) · [file formats](./zxspectrum/formats)
- [BBC BASIC (Micro & Master)](./bbc) · [hardware](./bbc/hardware) · [escape codes](./bbc/escapes) · [file formats](./bbc/formats)
- [Commodore 64 & VIC-20 BASIC](./commodore64) · [hardware](./commodore64/hardware) · [escape codes](./commodore64/escapes) · [file formats](./commodore64/formats)
- [Commodore PET BASIC 4.0](./pet) · [hardware](./pet/hardware) · [escape codes](./commodore64/escapes) · [file formats](./commodore64/formats)
- [Acorn Atom BASIC](./atom) · [hardware](./atom/hardware) · [escape codes](./atom/escapes) · [file formats](./atom/formats)
- [TRS-80 Level II BASIC](./trs80) · [hardware](./trs80/hardware) · [escape codes](./trs80/escapes) · [file formats](./trs80/formats)
- [Amstrad CPC Locomotive BASIC](./cpc) · [hardware](./cpc/hardware) · [escape codes](./cpc/escapes) · [file formats](./cpc/formats)

## Assembly language

Machine-code blocks are written in assembly, using the same searchable-table
treatment for every instruction and directive the built-in assembler
understands. The instruction set is per-CPU, not per-machine, so there is one
reference for each processor — cross-linked from every dialect that uses it:

- [Z80 assembly](./z80-assembly) — ZX81, ZX80, ZX Spectrum, TRS-80, Amstrad CPC
- [6502 assembly](./6502-assembly) — Commodore 64/VIC-20/PET, BBC Micro/Master, Acorn Atom
