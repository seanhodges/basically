---
title: Dartmouth BASIC reference
---

<script setup>
import { dartmouthReference } from '../../src/reference/dartmouth';
</script>

# Dartmouth BASIC reference

Every command, function and operator in **Dartmouth BASIC** as the GE-235
compiled it in February 1965 — the first BASIC there was, and the ancestor of
every other one on this site.

There are no strings, no graphics, no sound and no way to reach the hardware:
what is here is arithmetic, loops, subroutines and a teletype.

**In this reference:** [Hardware](./dartmouth/hardware) · [Escape codes](./dartmouth/escapes) · [File formats](./dartmouth/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

- **`LET` is never optional.** A line opening with a letter matches no
  statement, so `10 A=1` is rejected as a bad instruction. This is the single
  most common thing to trip on when bringing a program back to this machine.
- **There are no strings at all** — no string variables, no `A$`, no string
  functions, no string expressions. The only text a program can produce is a
  literal inside `PRINT`, and a literal is never a value. Strings arrive in the
  fourth edition of the language, three years later.
- One statement to a line: there is no `:` separator and no shorthand for any
  keyword. Line numbers run 0 to 99999, a program may be 240 lines long, and
  `END` is mandatory and must be the highest-numbered line.
- A variable name is one letter, optionally followed by one digit: `A`, `A1`,
  `Z9`. `A12` is not a name. An array is named by a bare letter, so `A` and
  `A(0)` are two different places to put a number.
- Blanks are deleted before a line is read, so `FORI=1TO10` is a loop and
  `P R I N T` is `PRINT`. The usual companion trap does not arise: no name is
  long enough to contain a keyword.
- **A comparison is not a value.** The six relations exist only between `IF` and
  `THEN`; `=<` and `=>` are refused. `THEN` takes a line number and nothing
  else, and there is no `ELSE`. There is no `AND`, `OR` or `NOT` either, no
  integer division and no remainder — write `A-B*INT(A/B)`.
- Every fault stops the program. The compiler lists what is wrong with the whole
  program and refuses to run it; the run-time reports one fault, names the line,
  and stops. Nothing resumes — there is no `CONT` and no error trapping.

<ReferenceTable :data="dartmouthReference" />
