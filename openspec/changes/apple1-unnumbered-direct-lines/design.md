## Context

Every dialect tokenizer in the project splits source on newlines, matches
`/^(\s*)(\d+)(.*)$/`, and pushes a fatal `Missing line number` when that fails.
The Apple I is the first registered machine whose own listings break that
assumption: Integer BASIC has nine commands the interpreter takes only at the
`>` prompt, and a listing carries them on unnumbered lines - a `SCR` /
`LOMEM=768` / `HIMEM=4096` preamble that sizes the workspace, and often a
trailing `RUN`.

Two pieces of the Apple I toolchain already anticipate this and are dead code
today. `buildBasicImage(program, { lomem, himem })` writes the declared bounds
into the zero-page housekeeping block the machine boots from, and nothing
passes the options; `Apple1Machine.loadProgram()` already reads LOMEM/HIMEM back
out of the image and honours them when they describe a workspace that fits. So
the machine side of this is finished - what is missing is a tokenizer that can
read the declaration and the paths that carry it into the image.

The codebase already has one answer to "a physical source line with no line
number": the `#BIN` opaque-binary directive, gated by `Dialect.supportsBinaryLines`
and special-cased at every generic line-number site. That is the shape this
change follows. See `docs/contributing/architecture.md` for how the dialect seam
and the editor pipeline fit together.

## Goals / Non-Goals

**Goals:**

- Tokenize an Apple I listing that holds unnumbered direct-mode lines, and make
  `LOMEM=`/`HIMEM=` actually size the workspace the program is built into.
- Stop the dialect-agnostic editor and AI machinery destroying lines it cannot
  key by line number - today an AI merge would silently delete a user's
  preamble.
- Change nothing observable for the other registered dialects.

**Non-Goals:**

- Making the nine commands executable inside a numbered line. The interpreter
  refuses them there and so does the tokenizer, unchanged.
- Extending line-number-keyed features (breakpoints, outline, profile heat, the
  POKE/address scan) to unnumbered lines.
- Honouring `RUN <line>` by starting the program there. `loadProgram` already
  takes an `autoStart` it ignores on this machine; wiring it up would retire
  dead API, and is worth its own change.
- A `TokenizeError` severity the run gate ignores (see the note policy below).

## Decisions

### The rule is "parses as a direct-mode command", not "sits at the top"

An unnumbered line is accepted iff it parses as one of the nine commands, and it
is accepted anywhere in the source.

The alternative - a positional "preamble" of unnumbered lines before the first
numbered line - was rejected for two reasons. Real listings also end with a bare
`RUN`, which a head-only rule cannot take. And a positional concept would need
new positional logic at every generic guard site, whereas a position-free
predicate is exactly the shape of the `isBinaryDirective` guard those sites
already carry, so the change becomes "consult one more predicate" rather than
"learn about document structure".

Numbered lines keep their own ascending-order rule; unnumbered lines contribute
no program bytes and take no part in it.

### One optional `Dialect` member, not a syntactic convention

The generic code needs to know whether a given physical line is legitimately
unnumbered, and the answer is machine-specific. `#BIN` could be a pure
syntactic predicate because its `#` prefix is the project's own invention; these
lines are the machine's real syntax, so a dialect must answer.

`Dialect` gains one optional member. Absent - as it is on every other machine -
the editor behaves exactly as it does today, which is what keeps a ZX81 user
typing `PRINT 1` on row 1 getting an auto-numbered line. The Apple I implements
it from the same command table the tokenizer parses with, so the two cannot
disagree about what is acceptable.

Rejected alternatives: a shared syntactic `directLine.ts` predicate applied to
every dialect (would regress auto-numbering everywhere), and threading the whole
`Dialect` into `lineNumbering.ts` (that module is deliberately dialect-free; a
predicate parameter keeps it so).

**Seam impact:** one optional, additive member on `Dialect`. `MachineEmulator`
is untouched - the Apple I machine already honours the bounds in the image it is
handed, and every other machine's `loadProgram` sees exactly what it saw before.

### Only `LOMEM=`/`HIMEM=` reach the image, so only they are reconstructed

Seven of the nine leave no trace in the built image, and that is fine: the
import round trip compares images, not text, so a listing's `SCR` and `RUN`
being absent from the recovered source changes nothing about the bytes.

The two that do reach it are a different matter. Their bounds live in the dump's
zero-page block and the text form's only way of carrying them is the preamble
the machine's own listings write - so `detokenize` restates them. Without that,
importing a program that asked for a larger workspace would rebuild it into the
stock one: a different image, and for a program that needed the room, a
different program. The existing round-trip requirement is what makes this
mandatory rather than a nicety.

### The declared workspace rides on the tokenizer's result

`tokenizeProgram` returns the declared bounds alongside the program bytes and
errors, and the two callers that build an image from it - the dialect's
`tokenize()` and the cassette encoder - pass them to `buildBasicImage`. Nothing
else in the app needs to know: the bounds travel inside the image, which is
already the contract with the emulator and with the cassette format.

The program's RAM budget is checked against the declared workspace rather than
the stock 2048 bytes, so a program is only reported as too large when it does
not fit what it asked for. The dialect's static `programRamBytes` stays the
stock figure - it describes the machine, not a particular program, and the
registry test pins it.

### The no-op commands are accepted in silence

Seven of the nine cannot affect a stored program: the image is built already
scratched and with no variables, and the IDE issues `RUN` itself. The obvious
move is a `fatal: false` error on each - the project's convention for "keeps its
editor squiggle, never stops `tokenize` producing a runnable image".

That convention does not mean what it looks like it means. `countProgramErrors`
counts `dialect.lint(source).length` - every error, fatal or not - and the Play
button refuses a program with any of them, with the lint gate on by default. A
note on a trailing `RUN` would therefore make a pasted listing unrunnable until
the user deleted the line that made it a listing, which is the exact failure
this change exists to remove.

So they are accepted in silence, and what each does on an unnumbered line is
said in the language reference instead. `SCR` after a numbered line is the one
case with a real divergence - on the machine it would have erased the lines
above it - and it is documented rather than flagged, for the same reason.

Distinguishing "tell the user without blocking the run" would need a new
severity on `TokenizeError` that the run gate ignores. That is a bigger change
than this one and would want its own proposal.

### AI merge preserves by anchoring, not by numbering

The merge is a `Map<lineNo, text>` union, so an unnumbered line has no key. It
is carried through the same side-channel `#BIN` directives use, anchored to the
line number of the next numbered line below it in the source (or past the end,
for a trailing line), and sorted ahead of that line. As with `#BIN`, the
existing program's lines win over a fragment's, so a partial merge can neither
drop nor duplicate them.

The Apple I gets its own line-number wording in the AI profile - that is already
a per-dialect table - telling the model these are the only lines that may lack a
number and to leave them alone in a partial reply. The shared
`RETURNING_CODE_RULES` prompt text is deliberately left alone: it is
machine-independent and byte-stable so the prompt cache prefix is shared across
dialects, and the merge rule above makes a change to it unnecessary.

## Risks / Trade-offs

- **A block the program's own workspace covers.** `LOMEM=768` puts the BASIC
  workspace on top of the `$0300-$07FF` machine-code block window, and
  `MemoryBlocksSupport.programArea` was handed only a byte size, so the
  collision lint could not see it. → `programArea` takes the program text
  optionally and the Apple I reads its declared bounds from it. A one-parameter
  implementation still satisfies the wider signature, so no other dialect
  changes. It runs on every lint pass, which is why the bounds are read by
  scanning the unnumbered lines rather than by tokenizing the program.

- **The cassette instructions name fixed monitor ranges.** The user types them
  verbatim at a real machine's monitor, so a moved workspace does not make them
  vague, it makes them load the wrong bytes. → `loadInstructions` may now be a
  function of the program text; the Apple I renders the range its bounds
  describe, and every other dialect keeps a plain string. `saveInstructions`
  stays static and is reworded to say how to read the bounds off the machine
  instead - the IDE has never seen that machine, so computing a range for it
  would be a lie dressed as precision.

- **A malformed image could move the workspace under the monitor's input
  buffer.** `loadProgram`'s guard had a ceiling but no floor. → It now has both;
  a workspace reaching below `$0280` is refused in favour of the cold start's.

- **Threading a predicate through `lineNumbering.ts` touches functions every
  dialect uses.** → Every new parameter is optional and defaults to today's
  behaviour, and the existing tests in that module are the regression net; each
  one must still pass unchanged.

- **No sample gains a preamble.** Two Apple I samples deliberately use the free
  RAM below LOMEM that a `LOMEM=768` would swallow, and the starter sample must
  stay the simplest listing on the machine. → The feature is covered by
  tokenizer, image and real-ROM tests and by a worked example in the language
  reference, which is where a reader meets it anyway.
