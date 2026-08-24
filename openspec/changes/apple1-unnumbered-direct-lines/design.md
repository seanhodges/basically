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
- Making `MemoryBlocksSupport.programArea` source-aware.

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

### The no-op commands get a non-blocking note

Seven of the nine cannot affect a stored program: the image is built already
scratched and with no variables, and the IDE issues `RUN` itself. Rather than
accept them and do nothing silently, each carries a `fatal: false` error - the
project's existing convention for "keeps its editor squiggle, never stops
`tokenize` producing a runnable image". `SCR`/`CLR` are noted only when they sit
*after* a numbered line, where on the real machine they would have erased what
is above them and here they do not.

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

- **The block/program collision lint still assumes the stock workspace.**
  `MemoryBlocksSupport.programArea` is handed only a byte size, so it cannot see
  a declared `LOMEM=768` that puts the BASIC workspace on top of the `$0300-$07FF`
  machine-code block window. → The tokenizer emits a non-fatal note whenever the
  declared lower bound is below the stock one, naming the window it now covers.
  Making that seam source-aware would change it for every registered dialect to
  serve one machine, and belongs in separate work.

- **The cassette instructions name fixed monitor ranges.** They are static
  strings on the dialect and are typed verbatim by the user at a real machine's
  monitor; a moved workspace makes them wrong. → Reword them to say the range
  comes from the program's own bounds and give the stock pair as the example.
  The dump itself stays self-describing, so import still round-trips. A
  source-aware signature would change the seam for all dialects; not worth it
  here.

- **Threading a predicate through `lineNumbering.ts` touches functions every
  dialect uses.** → Every new parameter is optional and defaults to today's
  behaviour, and the existing tests in that module are the regression net; each
  one must still pass unchanged.

- **A sample gaining a preamble could mislead.** Two Apple I samples
  deliberately use the free RAM below LOMEM that a `LOMEM=768` would swallow. →
  Only the sample that uses no low RAM gains a preamble; the other two are left
  alone, and the collision they would suffer is exactly what the note above
  names.
