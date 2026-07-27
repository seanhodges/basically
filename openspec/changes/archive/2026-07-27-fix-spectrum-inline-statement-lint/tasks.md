## 1. Column offsets on the Sinclair tokenizers

Independent of the statement work, and done first so the new lint tests can
assert columns on indented source.

- [x] 1.1 In `src/dialects/zxspectrum/tokenizer.ts`, capture the line's leading
      indent width before trimming and add it to the `colOffset` passed to
      `tokenizeBody` and to every `column:` raised in `tokenizeProgram`
      (the line-number errors currently hardcode `column: 0`). Follow
      `src/dialects/commodore64/tokenizer.ts`'s `lead` handling.
- [x] 1.2 Same in `src/dialects/zx81/tokenizer.ts` and
      `src/dialects/zx80/tokenizer.ts`, including the `#BIN` directive errors,
      whose column is measured against the already-trimmed text.
- [x] 1.3 Colocated tests: an indented line reports the true column, in
      `src/dialects/zxspectrum/tokenizer.test.ts` and the ZX81/ZX80 suites
      (including a `#BIN` case). Nothing else about ZX81/ZX80 changes.

## 2. Per-statement lint on the ZX Spectrum

All in `src/dialects/zxspectrum/tokenizer.ts`; `zxspectrum128` is a thin
binding and inherits it.

- [x] 2.1 Add a re-armable `statementStart` flag beside the existing
      `firstWordChecked`, and a `flagStatement(at, end, got)` helper that
      records a non-fatal error with an `endColumn` (mirror
      `src/dialects/commodore64/tokenizer.ts`). Gate every new check on
      `firstWordChecked` so first-statement reporting is untouched.
- [x] 2.2 Make the `:` branch unconditional (it is currently guarded on
      `!firstWordChecked`) and re-arm `statementStart` there. Keep the emitted
      byte and the recorded previous-significant character exactly as the
      generic character path produces them today.
- [x] 2.3 In the keyword branch, flag a non-command keyword opening a
      statement, then re-arm after `THEN`. Match on the canonical keyword, not
      the typed word, so aliases resolve correctly.
- [x] 2.4 Flag the remaining statement openers — a string, a numeric literal,
      an identifier (Spectrum BASIC requires `LET`, so a bare name is always
      wrong), a `{=…}` override, or any other character. Leave control/UDG
      escapes armed and unflagged: real tapes open statements with colour
      codes.
- [x] 2.5 Colocated tests in `src/dialects/zxspectrum/tokenizer.test.ts`: a bad
      statement after a colon and after `THEN`; an inline assignment without
      `LET`; a non-command keyword after a colon; zero errors across a table of
      valid multi-statement lines (empty statements, trailing colon, colons
      inside a string and a REM, DATA, an inline control escape); the new
      errors are non-fatal and still build; the colon separator byte is
      unchanged; a detokenize→re-tokenize round trip stays clean and
      byte-identical.
- [x] 2.6 Colocated tests in `src/dialects/zxspectrum128/tokenizer.test.ts`:
      the 128 inherits the check, and it is driven by the 128 keyword table
      (a 128-only command opening an inline statement is clean there and
      flagged on the 48K table).

## 3. The colon regression tests the Amstrad dialects were missing

Behaviour is already correct on both; these are tests only.

- [x] 3.1 `src/dialects/cpc464/tokenizer.test.ts`: a bad statement after a
      colon is flagged non-fatally with an `endColumn`, and a valid
      multi-statement line is clean.
- [x] 3.2 `src/dialects/cpc6128/cpc6128.test.ts`: the same through the dialect
      surface, as the rest of that file does.

## 4. Quality gates

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm test` — in particular the bundled-sample suites for both
      Spectrums (which assert an empty error list and do contain
      colon-separated lines), the foreign round-trip suites, and
      `src/dialects/zxspectrum128/targets.test.ts` (first-statement fatality
      unchanged).
- [x] 4.3 `npm run lint`
- [x] 4.4 `npm run format:check`
- [x] 4.5 `npm run e2e:chromium -- e2e/code-editor`
