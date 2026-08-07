## Context

Preserved from `docs/contributing/memory-blocks-edit-export-and-plan.md`
(Stage 5) — a plan removed from the tree once the rest of it shipped, and
readable in git history. Everything the stage
depended on is now in place — blocks are created, edited, assembled, run,
exported and shared — and this is the last piece of it that was never built.

See `docs/contributing/architecture.md` for the dialect seam and the store
conventions.

## Goals / Non-Goals

**Goals**

- A BASIC program can name a block, and moving that block cannot break it.
- Exactly one implementation of the substitution, used by every path that turns
  source into bytes. Two implementations would mean a program that runs and
  exports differently.
- No tokenizer changes, in any dialect.
- Diagnostics land on the character the user typed, not on the character the
  substituted text happens to have.

**Non-Goals**

- Expressions, offsets, or naming anything but blocks (see the proposal).

## Decisions

### Substitution lives above the seam, not inside the tokenizers

Every dialect would otherwise need to learn `@name`, and each would learn it
slightly differently — that is a dozen implementations of one rule, in the
component of the system where a bug is hardest to see.

**Decision: resolve `@name` to a number in an app-level pre-pass, then hand
ordinary BASIC to `dialect.tokenize` exactly as today.** Tokenizers stay
untouched, the feature arrives on every machine at once, and the rule has one
test suite.

The cost is that the substitution point must be genuinely single. There are
several `dialect.tokenize` call sites — run, export, share, stats, import,
vocabulary — plus each dialect's `BuildTarget.build`, which re-tokenizes the
source it is handed. Substituting in a helper that all of them call, rather than
at each site, is what keeps run and export honest. **Enumerate the call sites
from the tree when implementing; do not trust a list written earlier.**

### The scanner is dialect-neutral and skips strings and REM

`@` appears inside string literals and comments in real programs, and must not
be touched there. Every dialect quotes strings with `"` and has a `REM`-alike
whose tail is free text.

**Decision: one scanner, using those two shared facts, rather than per-dialect
lexing.** A dialect whose comment keyword differs declares it; the scanner does
not guess.

### Errors carry a column map back to the original text

A substituted line is a different length from the line the user typed — often
several times over, with multiple refs. A diagnostic computed against the
substituted text and reported verbatim lands on the wrong character, which is
worse than no diagnostic.

**Decision: the resolver returns a column mapping alongside the substituted
source, and the lint integration remaps every diagnostic through it.** This is
the part of the design most likely to be subtly wrong, so it gets the heaviest
tests: several refs on one line, refs of differing name lengths, a ref at the
start and at the end of a line.

### An unknown name is fatal; an unmatched address is a warning

`@nosuchblock` cannot be turned into bytes, so it is an error at its own
position, in the `TokenizeError` shape the editor already renders.

A plain `USR 32768` that matches no block, by contrast, is perfectly legal BASIC
that might be deliberate — calling a ROM routine, or an address the user knows
about. **Decision: warn, never refuse.** It exists to catch the stale copies that
predate this feature, not to police numeric addresses.

### Lint reads blocks imperatively, not through the extension

Rebuilding a CodeMirror extension on every block edit would churn the editor
while the user is typing in the *other* tab.

**Decision: the debounced lint callback reads the current blocks from the store
when it runs.** The extension is built once per dialect, as it is today.

## Risks / Trade-offs

- **The column map is the sharp edge.** An off-by-one puts every squiggle in a
  program with refs one character out. Mitigated by making the map part of the
  resolver's return value — so it is tested directly, not inferred — and by
  covering the multi-ref cases explicitly.
- **A missed substitution point is invisible until it matters.** If export
  substitutes and share does not, a program runs for its author and fails for a
  recipient. Mitigated by routing every path through one helper, and by a test
  that asserts a document with refs produces identical bytes through run, export
  and share.
- **`@` is a real character on some of these machines.** The scanner's
  string-and-comment immunity is what keeps `PRINT "@"` working; that is a test,
  not an assumption.
- **The feature is invisible until a user knows it exists.** Completion after the
  call keyword is what surfaces it — it is not decoration, it is the discovery
  path, and should not be deferred to a follow-up.

## Migration Plan

None needed. `@name` is new syntax; no existing program contains it outside a
string or comment, where the scanner does not look. Programs using plain numeric
addresses keep working unchanged, and gain at most a warning.

## Open Questions

- Should a block rename offer to update the references that name it? The
  proposal says the IDE does not rewrite the user's BASIC, and an error at each
  stale ref is the honest minimum. An offered, explicit rename-with-refs is a
  reasonable follow-up once the errors exist.
- Which keyword each dialect declares as its machine-code call, and whether the
  keyword capability domains added for the porting guide already record it.
  Check before adding a field to the seam.
