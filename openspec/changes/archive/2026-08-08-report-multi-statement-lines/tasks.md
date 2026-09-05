## 1. A statement-shape report never blocks the build

- [x] 1.1 `src/dialects/bbcmicro/tokenizer.ts`: add `fatal: false` to the error
      `flagStatement` pushes, matching every other dialect and the comment above
      it that already claims tokenization continues unchanged. `bbcmaster` picks
      it up through the same `tokenizeProgram`.
- [x] 1.2 `src/dialects/bbcmicro/tokenizer.test.ts`: the bad-statement-after-a-
      colon case also asserts `fatal === false`, plus a new case asserting
      `bbcmicro.tokenize('10 PRINT "X":PRNT "Y"\n')` returns a non-empty image —
      that is what exercises the `hasFatalErrors` gate in `index.ts`.
- [x] 1.3 `src/dialects/bbcmaster/bbcmaster.test.ts`: the same image assertion,
      since the Master inherits the tokenizer.

## 2. The Spectrum's first statement is reported like any other

- [x] 2.1 `src/dialects/zxspectrum/tokenizer.ts`: replace the two fatal
      first-statement `fail()` calls (a non-statement keyword; a bare name,
      number or symbol) with the existing non-fatal `flagStatement`, and let the
      line finish tokenizing. Set the `firstWordChecked` latch once the opener
      has been reported as well as when it has been accepted, so the end-of-line
      "line has a number but no statement" check does not report the same line a
      second time.
- [x] 2.2 Same file: drop the `!firstWordChecked` gates that existed only to
      prevent that double report (the string branch, the float-override branch,
      and the trailing statement-opener block), and rewrite the flag comments
      that describe the old fatal/non-fatal split.
- [x] 2.3 Same file: leave `fail()` in place for unterminated strings, charset
      errors, `Number out of range` and the line-number rules, and leave the
      lone-control-escape allowance exactly as it is.
- [x] 2.4 `src/dialects/zxspectrum/tokenizer.test.ts`: `10 PRNT 1`, `10 SIN(1)`
      and `10 A=1` each report exactly one non-fatal error and still emit the
      line's bytes; `zxspectrum.tokenize('10 PRNT 1\n')` returns a non-empty
      image; the existing leading-string / float-override cases stay at exactly
      one error each and are now non-fatal; `9007 {BRIGHT 0}` stays clean and
      byte-identical.
- [x] 2.5 Check nothing else depended on a bad line being dropped:
      `src/dialects/zxspectrum/foreignRoundTrip.test.ts`, the emulator tests
      under `src/dialects/zxspectrum/emulator/`, and `src/dialects/zxspectrum128/`.

## 3. The ZX81 and ZX80 report a second statement

- [x] 3.1 `src/dialects/zx81/tokenizer.ts`: in the body loop, after the string
      branch and before keyword matching, report a colon once per line —
      `fatal: false`, `endColumn` one past the colon, message saying the machine
      takes one statement per line — and keep emitting the character exactly as
      today so the bytes are unchanged.
- [x] 3.2 `src/dialects/zx80/tokenizer.ts`: the same, worded for the ZX80.
- [x] 3.3 `src/dialects/zx81/tokenizer.test.ts` and
      `src/dialects/zx80/tokenizer.test.ts`: a colon-separated line reports once
      at the colon's column with `endColumn === column + 1` and emits the same
      bytes as before; a colon inside a string and after `REM` reports nothing;
      several colons still report once; an indented line's column owes the
      indent.

## 4. The Atom's `;` is not always a statement break

- [x] 4.1 `src/dialects/atom/tokenizer.ts`: in `validateStatements`, a `*` OS
      command consumes to end of line instead of stopping at the next `;`.
- [x] 4.2 Same file: once a line has opened a PRINT (spelled or abbreviated),
      stop reporting statement heads for the rest of it — PRINT's own item
      separator is `;`, and telling an item from a statement needs the
      expression parsing this change does not attempt. A dot-abbreviation that
      resolves to `REM` stops the scan like the spelled-out `REM` does.
- [x] 4.3 `src/dialects/atom/tokenizer.test.ts`: `*LOAD"X";3`, `*FS 3;12`,
      `PRINT "A";B`, `PRINT $A;3` and `P."HI";3` all report nothing and still
      store the body verbatim.
- [x] 4.4 Confirm `src/reference/atom.ts` agrees with `statementSeparator: ';'`
      about whether the Atom takes one statement per line, and correct whichever
      of the two is wrong — from the keyword table and the ROM's behaviour, not
      from memory.

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npx openspec validate --specs`
- [x] 5.3 `npm run e2e:chromium -- e2e/code-editor`
