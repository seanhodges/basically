## Context

Editor diagnostics reach CodeMirror through `dialectLinter()`
(`src/editor/lintIntegration.ts`), which renders whatever `dialect.lint(source)`
returns; for every dialect that is the tokenizer's own `TokenizeError[]`, with
the per-dialect variable lint appended. See
`docs/contributing/architecture.md` for how the `Dialect` seam and the editor
layer relate.

Statement-shape validation is inlined into each tokenizer's character loop —
there is no shared statement splitter, and none is proposed here. Two designs
exist in the tree today:

- **Re-armable flag.** `commodore64` (`stmtStart`, shared by `vic20`/`pet`),
  `trs80`, `bbcmicro` (shared by `bbcmaster`), `cpc464` (shared by `cpc6128`)
  and `atom` each keep a `statementStart`-style boolean that is set true again
  at the machine's separator (`:`, or `;` on the Atom) and after `THEN`/`ELSE`.
  Each statement therefore gets checked, and each raises a non-fatal error with
  an `endColumn` so the editor underlines exactly the offending token.
- **One-shot latch.** `zxspectrum` (and `zxspectrum128`, a thin binding over the
  same code), `zx81` and `zx80` use `firstWordChecked`, which is set the moment
  the line's first keyword is accepted and never reset. On the Spectrum — the
  only one of the three whose ROM has a `:` separator — this means no statement
  after the first is ever checked. The Spectrum's `:` branch is itself guarded
  on `!firstWordChecked`, so past the first statement a colon is not recognised
  as a separator at all; it falls through to the generic character emitter.

`firstWordChecked` is not purely a lint flag on the Spectrum. It also gates the
leading-`:` allowance (a line may open with an empty statement, as real tapes
do), the `leadingControlEscape` / `leadingOtherContent` bookkeeping, and the
end-of-line "line has a number but no statement" framing check. Its diagnostic
is fatal: the line is dropped from the image and the build fails.

## Goals / Non-Goals

**Goals:**

- Check the statement opener at every statement position on a Spectrum line,
  not only the first.
- Leave the first-statement check — its wording, its position, its fatality,
  and the framing behaviour built on it — byte-for-byte as it is.
- Emit no different bytes for any program that tokenizes cleanly today.
- Report accurate columns on indented lines, across the Sinclair tokenizers.

**Non-Goals:**

- Expression parsing, a shared statement splitter, or unifying the two
  tokenizer designs. See the proposal's Non-goals.
- Any change to ZX80/ZX81 statement checking.

## Decisions

### Add a second flag rather than re-arm the existing one

`firstWordChecked` keeps its exact present meaning and stays fatal. A separate
`statementStart` flag governs *only* the new check: it is set true at every `:`
and after `THEN`, and cleared once a statement opener has been seen or flagged.

**Every new check is additionally gated on `firstWordChecked` being true**, so
the new lint can only fire on the second and later statements of a line. This
is not belt-and-braces: the first statement's diagnostics travel a different
path with a different message and different fatality, and several existing
tests assert exact error *counts* for lines whose first statement is bad
(a string or a `{…}` override opening the line, caught by the end-of-line
framing check). Without the gate those lines would be reported twice.

The alternative — making `firstWordChecked` itself re-armable and deriving both
checks from it — was rejected because that flag is load-bearing for line
framing, not just for lint. Re-arming it would make the end-of-line "no
statement" check and the leading-escape allowances re-trigger mid-line, and
would drag the fatal path into positions that have never been fatal. Two flags
keep the change strictly additive: every code path that exists today runs
exactly as before, and the new check only fires where nothing fires now.

### Newly-checked statements are non-fatal

They carry `fatal: false` and an `endColumn`, like every other dialect's
statement-shape lint, so they squiggle in the editor without blocking
`tokenize()` from producing a runnable image or `fatalErrors()` from clearing
hardware export. The rationale — heuristic narrower than the ROM's parser,
round-trip obligations against detokenized tape output — is recorded in the
proposal.

Worth stating plainly, because "non-fatal" understates the reach:
`countProgramErrors()` counts every tokenizer error regardless of `fatal`, so a
new diagnostic still increments the status-bar error count and still blocks Run
under the default "Block Run on lint errors" setting. That is exactly how the
C64's non-fatal statement lint already behaves, so it is consistent
cross-dialect rather than a Spectrum-specific regression — but it does mean the
false-positive rate has to be effectively zero. The bundled Spectrum samples
all contain colon-separated lines and their tests assert an empty error list,
which makes them the primary guard.

### The Spectrum's check is simpler than the C64's

Two special cases other dialects need do not apply:

- **No LET-less assignment.** The Spectrum ROM requires `LET`, so there is no
  assignment-shape lookahead to write — a bare name opening a statement is
  always wrong. `zxspectrum128/targets.test.ts` already pins `10 x=5` as
  invalid.
- **No `DATA` mode.** Unlike Commodore BASIC, Spectrum `DATA` items tokenize
  normally and a `:` legitimately ends the statement, so no verbatim-until-colon
  state is needed. `REM` already consumes to end of line and string literals
  already swallow colons, so colons inside comments and strings stay safe
  without new handling.

A third simplification: the C64's `lineNoOk` state has no counterpart here.
Spectrum BASIC has no `IF … THEN <line-number>` form — `THEN` must be followed
by a statement, so the jump is written `THEN GO TO n` (as the repo's own
round-trip fixture does). A bare number after `THEN` is therefore just another
invalid statement opener and is flagged like any other.

### Control escapes do not open a statement

`{…}` control/colour directives and `\a`-`\u` UDG escapes are handled before
the statement guard and must neither raise a diagnostic nor clear
`statementStart` — mirroring how the per-line code already treats a leading
control escape as carrying bytes rather than opening a statement.

### The `:` byte is unchanged

A mid-line colon currently reaches the generic character emitter, which encodes
it through the charset to `0x3a` and records it as the previous significant
character. The new separator branch emits the same byte and records the same
previous character, so the tokenized image is identical. A byte-identity test
pins this.

## Seam impact

None. All changes are inside `src/dialects/<name>/tokenizer.ts` files behind the
`Dialect` interface; `lint()` and `tokenize()` keep their signatures and the
editor, store, and export paths are untouched.

## Risks

- **A false positive blocks Run** for a program that is actually fine, since
  non-fatal errors still count toward the Run gate. Mitigated by the sample
  suites (which exercise real colon-separated lines and assert zero errors) and
  by the foreign round-trip suites (which re-tokenize detokenizer output built
  from real tape byte patterns).
- **The column fix shifts existing expectations.** Any test asserting a column
  on an indented Sinclair line would change. Lines in the bundled samples and
  fixtures are not indented, so the blast radius is expected to be nil, but the
  full suite is the check.
