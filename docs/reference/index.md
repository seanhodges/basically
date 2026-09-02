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

## Argument notation

Every reference page writes a keyword's arguments the same way, so once you can read
one page you can read them all:

| Notation               | Meaning                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<number>`             | Anything in angle brackets is a value you supply. Each page lists what its own placeholders mean, under **Argument notation** below its table.                                 |
| `PRINT`                | Anything not in angle brackets is typed exactly as shown, including punctuation such as `#`, `(` and `,`.                                                                      |
| `[<line>]`             | Square brackets mark an optional part. Nested brackets mean the inner part needs the outer one: `[<first>[, <last>]]` allows a first argument alone, but not a last one alone. |
| `<number> \| <string>` | A vertical bar separates alternatives — write one or the other.                                                                                                                |
| `<var>[, <var>]…`      | An ellipsis means the bracketed part before it can repeat, so this reads "one variable, then as many more as you like".                                                        |

Where a machine genuinely requires something the notation would otherwise smooth away
— a quoted filename, no space around an `=` — the page shows what the machine
actually wants.

The two assembly references use the conventional per-processor operand notation
instead, explained on each of those pages.

## BASIC dialects

One page per family of BASIC, naming the machines it covers and the version
each of them runs:

- [Applesoft BASIC](./applesoft) — Apple II Plus
- [Atari BASIC](./atari) — Atari 800, Atari 400
- [Atom BASIC](./atom) — Acorn Atom
- [BASIC-G](./pmd85) — Tesla PMD 85-2
- [BBC BASIC](./bbc) — BBC Micro (BASIC II), BBC Master (BASIC IV)
- [Commodore BASIC](./commodore) — PET (4.0), VIC-20 and Commodore 64 (V2)
- [Dartmouth BASIC](./dartmouth) — GE-235, running the February 1965 language
- [Integer BASIC](./integer-basic) — Apple I, Apple II
- [Locomotive BASIC](./cpc) — Amstrad CPC 464 (1.0), CPC 664 and CPC 6128 (1.1)
- [Microsoft BASIC](./altair8800) — MITS Altair 8800, running Altair 8K BASIC
- [MSX BASIC](./msx) — Sony HB-10P, running MSX BASIC 1.0
- [Sinclair BASIC](./sinclair) — ZX81, ZX Spectrum 48K, ZX Spectrum 128K
- [TRS-80 Level II BASIC](./trs80) — TRS-80
- [ZX80 BASIC](./zx80) — ZX80

## Assembly language

Machine-code blocks are written in assembly, using the same searchable-table
treatment for every instruction and directive the built-in assembler
understands. The instruction set is per-CPU, not per-machine, so there is one
reference for each processor — cross-linked from every dialect that uses it:

- [Z80 assembly](./z80-assembly) — ZX81, ZX80, ZX Spectrum, TRS-80, Amstrad CPC, Sony HB-10P, Altair 8800 (8080), PMD 85 (8080)
- [6502 assembly](./6502-assembly) — Commodore 64/VIC-20/PET, BBC Micro/Master, Acorn Atom, Apple I, Apple II, Atari 800/400
