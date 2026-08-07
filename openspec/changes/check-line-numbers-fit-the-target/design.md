## Context

`PortingFacts` splits into fields with a structured source in `src/dialects/`
(pinned by `facts-crosscheck.test.ts`) and hand-authored prose with no such
source. `lineNumberRange` is in the second group and renders as a fact row.
`statementLayoutForProgram` already reports which of the program's lines carry
several statements and whether the target requires them **split** (one statement
per line) or merely **re-separated**. The `split` case is the only thing the
guide describes that changes the number of lines in the program.

The seam rules are in `docs/contributing/architecture.md`: `src/reference/` is
pure and never reaches the registry or an emulator core, so anything read from
the program's text arrives as plain data via `ProgramVocabulary`.

## Goals / Non-Goals

**Goals**

- One comparable, machine-checkable line-number range per machine.
- Report the program's own numbers against the target's range.
- Join the two halves the guide already holds: a split creates lines, and lines
  need numbers the target will accept.

**Non-Goals**

- Renumbering, or picking a renumbering step.
- The other two prose facts (see the proposal's non-goals).
- Any change to what a tokenizer accepts.

## Decisions

### Impact on the Dialect seam: none

No new `Dialect` field. The range is authored in `src/reference/facts.ts` from
each machine's documentation, and the crosscheck reads the tokenizer that is
already there. The vocabulary gains fields, which is the app-side scan reporting
more of what it already walks — `codeLines` strips the line number from every
line today and throws it away.

### The authored range is the *editor's*, and the tokenizer is a bound, not an oracle

Probing every registered dialect's tokenizer against its authored prose shows
the two answer subtly different questions:

```
  machine        authored prose   tokenizer accepts
  ZX81 / ZX80    1–9999           1–9999            equal
  Spectrum       1–9999           0–16383 (soft-warns outside 1–9999)
  BBC Micro      1–32767          0–65279
  Commodore      0–63999          0–63999           equal
  CPC            1–65535          1–65535           equal
  TRS-80         0–65529          0–65529           equal
  Altair         0-65529          0–65529           equal (prose dash differs)
  Atom           0–32767          0–32767           equal
```

A tokenizer may legitimately store a line a real machine's ROM editor would
refuse at the keyboard — that is the same distinction the project already draws
between fatal errors and lint. What a porter must renumber into is the editor's
range, so that is what the field states, and the crosscheck asserts:

- the structured range **equals** the prose range (so the two cannot drift), and
- the structured range's endpoints are **accepted by the tokenizer** (so an
  authored range cannot claim numbers the machine could not store).

A subset relation rather than equality, deliberately: making it equality would
force either the Spectrum's authored range up to 16,383 — telling a porter the
machine takes line numbers its editor rejects — or its tokenizer down to 9,999,
which would make an imported program's line unstorable. Neither is an
improvement, and the crosscheck should not push anyone into one.

The Altair's ASCII hyphen is normalised to the en dash the rest of the table
uses, so the prose↔structured check can be one exact comparison rather than a
tolerant one.

### The finding: two questions, one section

```
  the program's numbers          → below the target's minimum?  above its maximum?
  the program's lines, split     → does the target's range hold the result?
```

Both are about line numbers and both are narrowed to the open program, so they
are one finding with up to two parts.

The overflow projection is stated conservatively. The program becomes
`lines + extraStatements` lines, where `extraStatements` counts the statements
beyond the first on every line that carries several. It cannot be renumbered
into the target at all when

```
  target.min + (lines + extraStatements) - 1  >  target.max
```

which is the honest test: it assumes the tightest possible renumbering, step 1
from the target's minimum, so a program it rejects cannot fit under any scheme.
Where the projection does fit but the program's *existing* highest number does
not, that is the first part of the finding and is reported on its own terms.

Reporting the projected count even when it fits is deliberate — a program going
from 60 lines to 190 on a ZX81 is a fact the reader should meet before starting,
not after.

### What crosses the iframe boundary

`ProgramVocabulary` gains the program's lowest and highest line numbers, its
count of numbered lines, and the total number of statements beyond one per line.
Numbers rather than the full array of line numbers: the finding needs the
endpoints and two counts, the array grows with the program, and a payload should
carry what the other side uses — the same reasoning that left `lineNo` out of
the write sites.

The counting stays the source machine's, as `multiStatementLines` already does:
a separator is only a statement break in the language being ported *from*.

### Where the finding is computed

`src/reference/compare.ts`, pure, taking the two machines' facts and the
vocabulary — the same signature shape as `statementLayoutForProgram`. The
statement-layout finding gains the projection because it is the thing that
causes it; a reader meeting "42 lines must be split" and "your line numbers will
not fit" as two unrelated sections would have to join them.

## Risks / Trade-offs

- **The projection assumes each extra statement becomes its own line.** → That
  is what a one-statement-per-line target requires; a porter who merges logic
  instead does less work than projected, and the report is a ceiling on the
  work, which is the safe direction.
- **An authored range could be wrong in a way both checks accept** (too narrow
  at both ends). → The prose is reviewed against each machine's documentation as
  the other hand-authored facts are; the tokenizer bound catches the dangerous
  direction (claiming numbers the machine cannot store).
- **A wider vocabulary payload.** → Four numbers, and it rides the request that
  already exists.

## Open Questions

- Whether the BBC's authored minimum should be 0 rather than 1: its tokenizer
  accepts 0 and the prose says 1. Resolve against Acorn's own documentation
  before authoring the structured field, not from the tokenizer's tolerance —
  the tokenizer is deliberately the looser of the two.
