---
title: Dartmouth BASIC reference
---

<script setup>
import { dartmouthReference } from '../../src/reference/dartmouth';
</script>

# Dartmouth BASIC reference

Every command, function and operator in **Dartmouth BASIC** — the first BASIC
there was, and the ancestor of every other one on this site. Two machines ran
it here: the **GE-235**, compiling the February 1965 language, and the
**GE-635**, compiling the fourth edition of January 1968.

The GE-235 has nothing the GE-635 has not, so rows badged **4th edition only**
are what the later machine added — strings, matrices, `ON`, `RESTORE`,
`RANDOMIZE`, `TAB` and the rest. Rows both machines have but read differently —
`INT`, `RND`, `FOR`, `PRINT`, `DATA` — say how in the row itself.

**In this reference:** [Hardware](./dartmouth/hardware) · [Escape codes](./dartmouth/escapes) · [File formats](./dartmouth/formats) · [Argument notation](./#argument-notation)

## Notes and caveats

### Shared by both

- **`LET` is never optional.** A line opening with a letter matches no
  statement, so `10 A=1` is rejected as a bad instruction. This is the single
  most common thing to trip on when bringing a program back to either machine.
- One statement to a line: there is no `:` separator and no shorthand for any
  keyword. `END` is mandatory and must be the highest-numbered line.
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
- Neither machine has a file statement of any kind, and neither can name an
  address: there is no `PEEK`, no `POKE` and no `USR`.

### On the GE-235

- **There are no strings at all** — no string variables, no `A$`, no string
  functions, no string expressions. The only text a program can produce is a
  literal inside `PRINT`, and a literal is never a value.
- Line numbers run 0 to 99999 and a program may be 240 lines long. There is no
  `RESTORE`, so the `DATA` pointer never rewinds, and no `RANDOMIZE`, so every
  run deals the same sequence.
- Every fault stops the program. The compiler lists what is wrong with the whole
  program and refuses to run it; the run-time reports one fault, names the line,
  and stops. Nothing resumes — there is no `CONT` and no error trapping.
- `INT` walks towards zero from both sides, so `INT(-2.35)` is `-2` and
  `INT(X+.5)` trims rather than rounds. `RND` requires an argument and ignores
  it. A `FOR` tests its limit at the `NEXT`, so the body always runs once.

### On the GE-635

- **Strings arrive, and almost nothing to do with them.** There is no
  concatenation operator and no string function: `CHANGE` moves a string to a
  numeric vector of character codes and back, and that is the whole of the
  machinery. String vectors exist; string matrices do not.
- Numeric and string `DATA` are separate blocks, matched to variables by type.
  A string constant needs no quotes if it starts with a letter, and must have
  them otherwise or if it contains a comma.
- **Most run-time faults do not stop the program.** A division by zero, an
  overflow, an underflow, `LOG` or `SQR` of a negative number each print a
  message, supply a value and carry on, so a program can reach its `END` with
  faults printed above the answers. Only running out of `DATA`, a bad
  subscript, a `GOSUB` fault, a dimension clash and an out-of-range `ON` stop
  the run.
- `INT` floors, so `INT(-2.35)` is `-3` and `INT(X+.5)` rounds. `RND` takes no
  argument at all — write `INT(10*RND)`. A `FOR` tests its limit on entry, so
  `FOR Z = 2 TO -2` with no negative step never runs its body.
- An apostrophe at the end of a working line starts a remark — except on a line
  that ends inside a string, which swallows it.

<ReferenceTable :data="dartmouthReference" />
