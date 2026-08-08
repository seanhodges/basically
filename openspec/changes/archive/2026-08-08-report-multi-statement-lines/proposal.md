## Why

Every dialect decides for itself what to say about a line carrying several
statements. Auditing all of them against the same set of lines — a valid
multi-statement line, a misspelled second statement, the separator inside a
string, a `REM` and a `DATA`, empty and trailing separators, a statement after
`THEN`/`ELSE` — shows the bytes are right everywhere and the reporting is not,
in four different ways:

- **The BBC Micro and Master refuse to build the program.** Their
  statement-shape lint is the only one in the tree that is fatal, so
  `10 PRINT "X":PRNT "Y"` produces an empty image: the user cannot run or
  export a program because one statement after a colon is misspelled. Every
  other machine squiggles and carries on, and the `code-editor` capability
  already requires exactly that ("A statement-shape error still runs").

- **The ZX Spectrum grades the same typo two ways.** A statement that does not
  open with a command keyword is fatal when it is the first on the line — the
  line is dropped and the build blocked — and a non-fatal squiggle when it
  comes after a colon. `10 PRNT 1` cannot run; `10 PRINT 1: PRNT 2` can.

- **The ZX81 and ZX80 say nothing at all.** Neither machine has a statement
  separator — one statement per line is all the ROM editor would accept — but
  a line like `10 LET A=1: PRINT A: GOTO 10` tokenizes with no errors. Someone
  pasting a Commodore or BBC program in gets silence, and a program that could
  never have been typed on the machine it is aimed at.

- **The Acorn Atom invents statement breaks.** Its statement scan ends every
  statement at the next `;`, but `;` is not always a statement break: a `*` OS
  command is handed the rest of the line, and PRINT uses `;` between its own
  items ("no gap"). Whatever follows one of those is then checked as if it were
  a statement, so an ordinary correct line — `10 PRINT "A";B`, `10 *FS 3;12` —
  is reported as a bad statement.

The through-line: what the IDE says about a multi-statement line should depend
on the machine's rules, not on which dialect happened to implement the check.

## What Changes

- **A statement-shape report never blocks the build, on any machine.** The BBC
  lint becomes non-fatal like every other dialect's, and the Spectrum reports a
  bad first statement the same non-fatal way it already reports a bad second
  one — one report per offending statement opener, the line still stored.
- **The ZX81 and ZX80 report a second statement on a line.** A colon outside a
  string or `REM` is marked where it appears, once per line, saying the machine
  takes one statement per line. The bytes are unchanged: the colon is still
  stored, so an imported program stays runnable.
- **The Atom stops reporting a `;` that is not a statement break.** A `*` OS
  command takes the rest of the line, and once a line has opened a PRINT there
  is no telling a print item from a new statement without parsing expressions,
  so statement-head reporting stops for the rest of that line. A misspelling
  after a `;` that follows a PRINT goes unreported; flagging correct programs
  is the worse failure.

No program that tokenizes cleanly today changes by a single byte.

## Capabilities

### Modified Capabilities

- `code-editor`: one requirement modified — *Inline diagnostics while typing* —
  adding what the linter reports on a machine that takes only one statement per
  line, and stating that a statement-shape report is raised once per offending
  statement whether it is the first on the line or a later one.

`dialect-toolchain` is **not** affected: tokenization already reports errors
without throwing and already produces bytes for lines it objects to. What
changes is which reports are fatal, which that capability does not fix.

## Non-goals

- **Expression checking.** The lint still looks only at how a statement opens.
  `10 PRINT 1: PRINT 2 +` stays clean, as it does today.
- **A shared statement splitter.** Each tokenizer keeps its own inlined scan;
  unifying them is a refactor with its own risks and no user-visible payoff.
- **Changing any emitted byte.** Every fix here is about what is reported, not
  what is stored — including on the ZX81/ZX80, where the colon keeps being
  stored exactly as it is now.
- **The Spectrum's genuinely fatal errors.** An unterminated string, an
  unmappable character, a number out of range and the line-number rules stay
  fatal: those lines cannot be framed at all.

## Impact

Affected code:

- `src/dialects/bbcmicro/tokenizer.ts` — the statement-shape error gains
  `fatal: false` (inherited by `bbcmaster`).
- `src/dialects/zxspectrum/tokenizer.ts` — the two fatal first-statement paths
  become the existing non-fatal report; the gates that existed only to stop
  double-reporting collapse (inherited by `zxspectrum128`).
- `src/dialects/zx81/tokenizer.ts`, `src/dialects/zx80/tokenizer.ts` — a
  once-per-line report at a colon outside a string or `REM`.
- `src/dialects/atom/tokenizer.ts` — `*` commands consume to end of line in the
  statement scan, and a line that has opened a PRINT stops reporting statement
  heads; `src/reference/atom.ts` — the `IF` entry claimed the Atom takes one
  statement per line, which its own `;` separator contradicts.
- Colocated tokenizer tests for each of the above.

No dependency changes, no storage or share-format changes.
