---
title: Exidy Standard BASIC reference
---

<script setup>
import { sorcererReference } from '../../src/reference/sorcerer';
</script>

# Exidy Standard BASIC reference

Every command, function and operator in **Exidy Standard BASIC**, the 8K
Microsoft BASIC the Exidy Sorcerer runs from its ROM PAC cartridge.

**In this reference:** [Hardware](./sorcerer/hardware) · [Escape codes](./sorcerer/escapes) · [File formats](./sorcerer/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- Spaces are thrown away outside strings, `REM` and `DATA`, so `FORI=1TO10` is
  valid — and the other side of that rule is that a keyword is recognised
  inside a name. A variable called `TOTAL` contains `TO` and mis-runs without
  an error of its own; the editor's linter catches the common ones before you
  run.
- Only the first two characters of a name are significant, so `COUNT` and
  `COUNTER` are the same variable. `$` is the only type suffix: `%`, `!` and
  `#` are later Microsoft additions, and `X%=1` is a syntax error here.
- `GOTO` is one word. `GO TO` with a space — accepted by several of this
  BASIC's relatives — answers `?SN ERROR`.
- `^` is the power operator, and it folds left to right, so `2^3^2` is `64`.
  `AND`, `OR` and `NOT` combine their operands bit by bit over sixteen bits,
  and a true comparison answers `-1`. There is no integer-division, remainder
  or exclusive-OR operator: use `INT(a/b)` and `a-b*INT(a/b)`.
- `PEEK`, `POKE`, `INP`, `OUT` and `WAIT` all take a **signed** 16-bit number
  in decimal. Everything from 32768 up has to be written negative — screen RAM
  at `0xF080` is `-3968` — and the positive form answers `?FC ERROR`. There is
  no hexadecimal notation anywhere in this BASIC.
- String space is 50 bytes until a program says `CLEAR n`. Assigning a literal
  (`A$="*"`) costs nothing; joining strings does, and a string may be at most
  255 characters long.
- Several statements share a line with `:`, and `?` is shorthand for `PRINT`
  that lists back as `PRINT`. There is no `'` shorthand for `REM`.

<ReferenceTable :data="sorcererReference" />

## The ROM PAC

BASIC is not firmware on this machine. The Sorcerer's own 4 KB Monitor is what
starts, and Exidy Standard BASIC arrives in a **ROM PAC**, an 8 KB cartridge the
Monitor finds in the cartridge window and enters without being asked. That is
why the machine signs on in BASIC, and why
`BYE` has somewhere to go: it leaves the interpreter for the Monitor's own
command line, and `PP` there comes back with the program intact.

The consequence for a program is the 4 KB of firmware underneath. Everything
the screen does — the cursor moves, the clear, the scroll — is the Monitor's
screen driver rather than the interpreter's, which is why those are control
codes sent through `PRINT` and not keywords. The [escape codes](./sorcerer/escapes)
page lists each of them.
