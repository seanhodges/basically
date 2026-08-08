## Context

Statement-shape validation is inlined into each tokenizer's character loop —
there is no shared statement splitter, and none is proposed here (see the
proposal's non-goals). `docs/contributing/architecture.md` covers how the
`Dialect` seam and the editor's lint layer relate; the short version is that
`dialect.lint(source)` returns the tokenizer's own `TokenizeError[]`, and
`dialectLinter()` renders whatever it is given.

Two properties of `TokenizeError` carry this change. `fatal: false` marks
heuristic statement-shape lint, which `hasFatalErrors()` excludes so the image
still builds and hardware export still runs. `column`/`endColumn` are offsets
into the physical editor line, and every dialect already computes them as
`lineColumnOffset + absoluteBodyIndex`, so they stay correct past a separator.

The archived `fix-spectrum-inline-statement-lint` change added per-statement
lint to the Spectrum but deliberately left the first statement on the fatal
path it had always been on, gating every new check on `firstWordChecked` so the
two could not both fire. That gate is what this change removes.

## Goals / Non-Goals

**Goals**

- One rule for statement-shape reports across every dialect: non-fatal, once
  per offending statement opener, wherever on the line it sits.
- Say something on a machine that takes one statement per line, where the IDE
  currently says nothing.
- Stop the Atom's scan from treating a `;` inside end-of-line text as a break.

**Non-goals**

- Expression parsing, a shared splitter, or unifying the tokenizer designs.
- Any change to emitted bytes.

## Decisions

### Impact on the Dialect seam: none

No signature, no new field, no new capability flag. `statementSeparator` already
records which character separates statements and is `null` for the ZX81/ZX80 —
the ZX81/ZX80 check is that fact finally being enforced in the editor rather
than only in the porting comparison. Every change is inside a tokenizer.

### The Spectrum's first statement joins the others

`firstWordChecked` stays as the line-framing latch it is (it decides whether a
line ever opened a statement, which the end-of-line check and the
leading-escape allowance both read). What changes is the *report* it drives:
instead of `fail()` — which returns null and drops the line — a first statement
that does not open with a command keyword takes the same `flagStatement()` path
as a later one, and tokenization continues.

The latch is set once a statement opener has been seen **or reported**, which
is what keeps the count at one report per line-with-no-statement: the
end-of-line "line has a number but no statement" check then sees a line that
has already had its say and stays quiet. This is why the `!firstWordChecked`
gates on the string and float-override branches can go — with the first
statement reported through the same path, there is no second path to collide
with.

The lone-control-escape allowance is untouched. A line whose only content is an
embedded control byte (`9007 {BRIGHT 0}`, as real tapes save and the
detokenizer reproduces) is valid and silent, and a control escape still leaves
the statement opener armed so `PRINT 1:{INK 2}PRNT 2` reports `PRNT`.

`fail()` keeps every other caller: unterminated string, charset errors, number
out of range, and the line-number rules. Those lines genuinely cannot be
framed, and dropping them is the honest outcome.

### The ZX81/ZX80 colon is reported once per line, and still stored

Reporting every colon on a pasted six-statement line would bury the user in
squiggles that all say the same thing, so the check latches after the first.
The character is emitted exactly as today — a colon is a perfectly
representable ZX81 character, and an imported `.P` that contains one inside a
string or `REM` must keep round-tripping — so this is purely additive lint,
`fatal: false` like every other statement-shape report.

Placement matters more than the check: the branch sits after the string branch
(which consumes to the closing quote) and below `REM` (which consumes to end of
line), so a colon that reaches it is genuinely at statement level. The
alternative — scanning the line separately for a top-level colon — would
duplicate the string/`REM` knowledge the loop already has.

### The Atom's `;` is not always a statement break

`skipStatement()` is right for assignments and ordinary commands and wrong
wherever `;` means something else. Two cases:

- **`*` COS commands** are handed the rest of the line by the OS, so the scan
  stops there — the same rule the BBC tokenizer already applies to its own `*`
  commands.
- **PRINT** separates its items with `;` ("no gap"). Telling `PRINT "A";B` (one
  statement, two items) from `P."HI";G.20` (two statements) needs the ROM's
  expression parser, which is a non-goal. So once a line has opened a PRINT,
  statement-head reporting stops for the rest of that line: a misspelling after
  such a `;` goes unreported, which is the right way round for a heuristic —
  reporting correct programs is the worse failure. Lower-case keyword warnings
  are unaffected, since those fire only on words the table recognises.

The spelled-out `REM` already stops the scan, and a dot-abbreviation resolving
to `REM` now stops it too, alongside the PRINT case, resolved by the rule the
abbreviation branch already uses (the first command word starting with the
letters typed). Prefix matching itself stays — the ROM matches keyword text
against what follows, which is why `PRINTA` and `REMARK` work as they do.

## Risks / Trade-offs

**A Spectrum line the ROM editor would never accept now builds.** `10 A=1`
tokenizes to bytes and the program runs up to that line, where the machine
reports its own error — which is what every other dialect in the tree already
does, and what the `code-editor` capability asks for. The squiggle is still
there; only the block is gone.

**Bare-colon lines on the ZX81 that came from a real tape.** A `.P` whose line
genuinely contains a top-level colon (nothing legitimate produces one, but an
importer cannot rule it out) now shows a squiggle where it showed none. It
still loads, still runs, and still exports, because the report is non-fatal.
