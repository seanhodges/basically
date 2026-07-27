## Why

The editor's inline diagnostics come straight from the active dialect's
tokenizer error list. Every dialect whose machine allows several statements on
one line re-arms a "we are at a statement opener" flag at each separator, so
each statement gets the same statement-shape check — except the ZX Spectrum
family, which latches the check after the line's *first* statement and never
re-arms it.

The practical effect on ZX Spectrum 48K and ZX Spectrum 128 is that
`10 PRINT 1: PRNT 2` reports nothing at all: `PRINT` is checked, `PRNT` is
silently accepted, and so is anything else after a colon. `10 IF a=1 THEN PRNT 2`
is unchecked for the same reason — nothing re-arms after `THEN` either. The
identical mistake at the start of a line *is* reported, so the editor's
behaviour is inconsistent within a single line, and a typo in a
multi-statement line reaches the emulator as a runtime report instead of an
editor squiggle.

## What Changes

- On dialects whose machines allow several statements per line, the editor's
  statement-shape diagnostic applies to **every** statement on the line, not
  only the first. In practice this closes the gap on ZX Spectrum 48K and
  ZX Spectrum 128; the other multi-statement dialects already behave this way.
- A statement opener after a conditional's `THEN` is checked too.
- Diagnostics raised for these newly-checked statements are advisory: they
  underline the offending token in the editor but do not prevent building a
  runnable image or exporting to hardware, matching how every other dialect
  reports statement shape.
- Diagnostics on an indented line now point at the right characters. The
  Sinclair tokenizers measured columns against the line with its leading
  whitespace stripped, so every diagnostic on an indented line was displaced
  by the width of the indent.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: the "Inline diagnostics while typing" requirement is refined
  to state that diagnostics are per-statement rather than per-line on dialects
  that allow multiple statements per line, and that a diagnostic's reported
  position accounts for leading indentation.

## Impact

- `src/dialects/zxspectrum/tokenizer.ts` — the statement-shape check gains a
  re-armable per-statement flag alongside the existing per-line one. The
  ZX Spectrum 128 tokenizer is a thin binding over this file and inherits the
  fix.
- `src/dialects/zx81/tokenizer.ts`, `src/dialects/zx80/tokenizer.ts` — column
  arithmetic only. Both machines' ROMs have no statement separator, so their
  per-line check is already correct and is left alone.
- Colocated `*.test.ts` for the affected dialects, plus the colon regression
  tests the Amstrad dialects were missing (their behaviour is already correct;
  only the tests are new).
- No change to the emitted byte stream for any program that tokenizes cleanly
  today, and no `Dialect` / `MachineEmulator` seam impact — this is entirely
  inside one dialect's tokenizer.

## Non-goals

- **Parsing expressions.** The check stays what it is on every other dialect:
  is the token opening this statement a command keyword (or, on dialects that
  permit it, an assignment)? Everything past the statement opener is still
  unvalidated, and a mistake there still surfaces at RUN.
- **Changing how the *first* statement on a line is reported.** Its check stays
  fatal — it doubles as the guard for a line that has a number but no statement
  at all, and hardware export depends on that. Only the newly-checked
  statements are advisory.
- **Statement separators for ZX80 / ZX81.** Neither ROM has one; their
  once-per-line check is correct and unchanged.
- **Matching the Spectrum ROM's check-at-ENTER strictness.** A real Spectrum
  refuses to accept a syntactically bad line at all. Reproducing that would
  mean a fatal diagnostic from a heuristic narrower than the ROM's parser, and
  a false positive would leave an imported tape unrunnable and unexportable.
  Advisory now; revisitable once the check has proven itself.
- **Reporting statement shape as a warning rather than an error.** The editor
  renders every diagnostic at error severity today, across all dialects;
  splitting severity is a separate, cross-cutting change.
