## Context

The guide's findings all narrow a *difference table* to the open program. These
three do not fit that shape: a variable collision is not a row of any table, and
neither is a division. They are computed from the target's language rules applied
to the program's own text — which is why the rules have to stop being prose.

`docs/contributing/architecture.md` covers the seam: `src/reference/` stays pure,
so anything read from the program's text arrives as plain data in
`ProgramVocabulary`, and the app side does the reading. The app already has a
dialect-aware variable walk — `forEachVariable` in `src/editor/variables.ts`,
used by the highlighter, the completions and `variableLint.ts` — which knows what
a variable looks like on each machine and never mistakes a keyword, a number or a
`PROC`/`FN` call for one.

## Goals / Non-Goals

**Goals**

- Report the silent failures with the same weight as the noisy ones.
- Name the actual collisions in this program, not the possibility of collisions.
- Two prose facts given a comparable form, each pinned so it cannot drift.

**Non-Goals**

- Re-implementing variable recognition, or the editor's own lint.
- Evaluating expressions.
- Turning the display-model guidance into a computed finding.

## Decisions

### Impact on the Dialect seam: none

No new `Dialect` field and no new method. The variable walk is the editor's
existing one, run over the machine being ported *from* — the same machine the
rest of the vocabulary is read as. The significance rule for the *target* comes
from `PortingFacts`, which is reference data.

### Significance is a rule, not a sentence

The prose today says nine different things across fourteen machines:

```
  "Only the first two characters are significant; % suffix = integer, $ = string."
  "A single letter A–Z (numeric arrays and FOR variables too)."
  "Numeric names may be long; string and array names are a single letter with $."
  "Up to 40 significant characters; % = integer, ! = real (default), $ = string."
  "Any-length names; % suffix = fast integer, $ = string."
```

Three questions have to be answerable to find a collision, and the structured
field answers exactly those:

1. How many characters of a name are significant — for plain numeric names, and
   for the names a machine restricts further (the Sinclair machines' strings and
   arrays are a single letter while their numeric names are not).
2. Whether the type suffix (`$ % ! #`) is part of the name, which decides whether
   `AB$` and `ABC$` collide and whether `AB` and `AB$` do not.
3. Which suffix characters the machine has at all.

The families this produces:

```
  significant  machines
  1 (all)      ZX80, Atom
  1 (strings and arrays only)  ZX81, Spectrum, Spectrum 128
  2            Altair, PET, VIC-20, C64, TRS-80
  40           CPC 464, CPC 6128
  all          BBC Micro, BBC Master
```

The 35 ordered pairs from a long-name machine to a two-significant one are the
headline, but the rule generalises: a port to a single-letter target collides
harder, and the finding is the same computation with a different number.

### Crosschecking significance against the machine, not just the prose

Prose↔structured equality only proves the table agrees with itself. The stronger
pin is behavioural, in the spirit of the existing `unsupportedCharacters`
re-derivation: build a probe program from the authored rule — two names that
share the first *n* characters and differ after them — and require the dialect's
own `lint()` to flag it exactly when the rule says it collides. A machine the
rule calls fully significant must produce no such finding.

This is available because `variableLint.ts` already implements the ROM-accurate
rules for every family. Where a dialect implements no such rule, the authored
field must say "all significant", or the crosscheck fails — which is the drift
worth catching.

### Number handling: structured, pinned to the prose only

`numbers` gains whether the machine has fractions and, where it does not, the
range it holds. Unlike significance there is no behavioural probe short of
running a program on the emulator, so the crosscheck is the prose↔structured one:
the prose reads "Integer only" exactly when the structured field says there are
no fractions, and quotes the same range. Stated plainly rather than dressed up —
a weaker pin honestly labelled beats a strong-looking one that checks nothing.

### What the vocabulary carries

- `variables`: the distinct names, upper-cased, in the source machine's own
  spelling, from `forEachVariable` over `scannable(...)` bodies — so string
  literals, `REM` tails and `#BIN` payloads contribute none, exactly as the
  keyword scan already guarantees.
- fractional arithmetic: whether the program's code contains a division and
  whether it contains a fractional literal, as two facts rather than one, so the
  finding can say which. Read from the same scannable text, so a `/` inside a
  string or a comment is not arithmetic.

Both are the existing walk reporting more of what it already sees.

### The collision finding names pairs, not names

```
  target keeps 2 significant characters, suffix part of the name

  COUNT ─┐
         ├─▶ "CO"     ← report: COUNT and COLOUR both become CO
  COLOUR ┘

  TOTAL$ ─▶ "TO$"     ← alone in its bucket: not reported
```

Names are grouped by the key the target's rule produces; a bucket with one name
in it is not a finding. Reporting the key as well as the names is what makes the
finding actionable — the reader has to choose a new name that does not collide
with a third.

Where the *source* machine has the same rule, the program cannot contain a
collision the source did not already have, and the editor's own lint has already
flagged it. The finding is still correct in that case, and still reported: the
guide is read in the docs site too, and a program carrying a pre-existing
collision is worth stating when the port is the moment it gets rewritten.

### Colour attachment stays prose

There is no structured display model to compare, and inventing one to render a
sentence would be a data set with a single consumer. The guidance goes where the
other target-anchored guidance goes — `portingNotes` on the target's facts, and
pair notes where a direction has something sharper to say — carrying the existing
`colour` and `graphics` topics so a pair note can supersede it, and staying
inside the brevity cap `porting-crosscheck.test.ts` enforces.

## Risks / Trade-offs

- **A variable the walk misses, or a name it invents.** → The walk is the
  editor's own, shared with the highlighter and the lint, so a defect there is
  visible in three places rather than hidden in one.
- **Reporting a division that never divides inexactly.** → Stated as arithmetic
  to check rather than as a defect; the alternative is running the program.
- **The collision finding could be noisy on a program with many long names.** →
  It is bounded by the program's own vocabulary and reports only buckets with
  more than one name; the existing cap on long lists applies as it does to the
  other detailed lists.
- **Authored display-model prose could restate the colour fact row.** → The row
  says what each machine's colour *is*; the note says what a routine written for
  one does on the other. The brevity cap and the "guidance does not restate the
  tables" requirement both bear on this at review.

## Open Questions

- Whether the Atom's floating-point ROM variables (`%A`–`%Z`) make it "has
  fractions" for the purposes of the truncation finding. Proposed: no — the
  integer path is what a ported program lands on, and the note says the ROM
  offers reals, which is what the existing prose already does.
