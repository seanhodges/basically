## Context

The porting comparison, the machine description carried with every AI request, and the
port report sent when converting a program are three renderings of one body of
reference data under `src/reference/` — see `docs/contributing/architecture.md` for how
that layer relates to the rest of the app. `DialectCompare.vue` and `portDescription.ts`
already compute the same diffs from the same functions with the same arguments, and
`portDescription.test.ts` exists to keep them from drifting.

That machinery has two shapes of finding: **facts**, hand-authored per machine in
`facts.ts` and never narrowed, and **diffs**, computed between two machines and then
narrowed to the vocabulary of the open program (`diffForProgram`,
`escapeDiffForProgram`, `falseFriendsForProgram`). The three gaps this change closes
all sit at the boundary between those two shapes:

- Statement layout is a fact and stays one, so nothing ever counts the program's own
  packed lines.
- Character repertoire is neither: it exists only in `src/dialects/<id>/charset.ts` as
  the absence of an entry, discoverable at runtime by a `CharsetError` throw.
- `diffEscapes` computes `behaviourChanged` and every consumer ignores it.

**Seam impact: one field added to `Dialect`, none to `MachineEmulator`.** `Dialect`
gains `statementSeparator: string | null` — see decision 3, which is where the need for
it emerged. Nothing else here reaches past the seam: the character derivation reads
`CharsetMapping.glyph`, already part of it, and only from a crosscheck test; the app and
the docs bundle otherwise read authored data, as they do for every other porting fact.

## Goals / Non-Goals

**Goals:**

- Report characters and statement layout as findings about *this program*, in the same
  places and with the same narrowing discipline as commands and control codes.
- Tell the assistant what a machine cannot write before it writes it, without breaking
  the byte-stability the providers' prefix caching depends on.
- Make the `behaviourChanged` escape bucket visible on both the guide and the AI path.
- Keep the authored data pinned to the implementation, so a charset change breaks a
  test rather than silently producing wrong porting advice.

**Non-Goals:**

- Narrowing the fact table or the guidance prose. Both deliberately state rules that
  hold for any program, and the existing spec requires they stay unnarrowed.
- Turning the program analyser into a tokenizer.
- Repertoire beyond printable ASCII 0x20–0x7E.

## Decisions

### 1. Character repertoire is authored in `facts.ts`, not derived at runtime

`PortingFacts` gains `unsupportedCharacters: string[]`, hand-authored beside
`statementSeparator` and the other language rules, and pinned by
`facts-crosscheck.test.ts`.

*Alternative considered:* derive it at runtime from the dialect charset. Rejected on
two grounds. The docs bundle renders `DialectCompare.vue` outside the app and has no
access to `src/dialects/` — the whole reference layer is deliberately free of dialect
imports so it stays node-testable and code-splittable. And this is the convention the
file already follows: every fact with no structured source in `src/` is authored and
crosschecked, which is what makes a wrong value a failing test rather than a plausible
sentence.

### 2. The derivation sweeps `glyph`, not `toMachine`

The crosscheck builds the reachable set from `charset.glyph(b)` for every byte
`0x00..0xFF`, keeping a result that is a single printable ASCII character **or** the
backslash-escaped spelling of one, and asserts `unsupportedCharacters` is exactly
printable ASCII minus that set.

*Alternative considered:* sweep `charset.toMachine(c)` and record what throws. Rejected
because it over-reports: `%`, `\` and `{` open escape syntax on various machines and
throw for a reason that has nothing to do with repertoire. Measured, a `toMachine`
sweep claims the ZX81 lacks `%` (it is the inverse-video prefix) and that the Commodore
lacks `{` (it opens a PETSCII escape).

The unescape step is equally load-bearing in the other direction: the Spectrum's
`0x5C` is a real backslash whose glyph is the escaped spelling `\\`, so a raw sweep
would report the Spectrum as having no backslash. Both directions are pinned by named
test cases.

### 3. The statement separator becomes a fact of the `Dialect`

`Dialect` gains `statementSeparator: string | null`, declared by all thirteen machines,
and `PortingFacts.statementSeparator` is pinned to it by `facts-crosscheck.test.ts` —
moving that field from hand-authored to crosschecked.

The need emerged from the analyser. It runs in `src/app/`, over the program's text, and
has to know not just what separates two statements but whether the machine allows two on
a line at all. Neither existing source could tell it:

- `Dialect.memoryWrites.statementSep` is scoped to parsing a memory-write form, only the
  Atom declares it, and every reader falls back to `:`
  (`src/editor/pokeAddresses.ts`). That fallback would read a ZX81 line's ordinary colon
  — `PRINT "TIME: ";T` — as a statement break.
- `PortingFacts.statementSeparator` does model it, but lives in `src/reference/`, which
  an ESLint rule forbids the app from importing statically so the twelve-thousand-line
  reference tree stays out of the initial bundle.

*Alternatives considered.* Having the analyser report candidate breaks for both `:` and
`;` and letting the reference layer choose — rejected: it hardcodes the separator set in
the app, which is the same coupling without the honesty. Exempting `facts.ts` from the
import rule — rejected: it is a hole in a boundary that is currently absolute, to avoid
declaring a fact the dialect already knows.

Widening the seam is the smaller change of the two, and it is the same kind of fact as
`addressNotation`, `programRamBytes` and `crunched`, which `Dialect` already carries. It
also retires a near-duplicate: two fields modelled the same thing and only one of them
could say "none".

### 4. New findings are their own sections, not extra guidance bullets

Program-specific counts go in narrowed sections of their own. They cannot go in
**Before you start**: the existing requirement states the guidance prose is never
narrowed, precisely because it states rules that hold whatever commands a program uses.
The two new buckets join the enumerated list of narrowed findings instead, inherit its
"absent rather than empty" rule, and are counted in the guide's held-back total so the
narrowing stays honest.

### 5. The character-set section is omitted, not emptied, where a machine has none

`describeMachine` gains a character-set section and an escape-spelling section. The
character-set section is absent entirely for machines with a full printable-ASCII
repertoire (the TRS-80 and the Atom), rather than saying "none". A heading with nothing
under it invites the model to reason about why it is there; and because the section is
derived from data that is constant per machine, omitting it keeps the block
byte-stable per dialect, which is what `src/ai/promptBuilder.ts` requires for the
providers' prefix caching.

### 6. The port report gains language-rule *deltas*, not the whole fact table

`describePort` composes the fact rows that **differ** between the two machines, from
the same `PortingFacts` the guide's fact table reads. Sending the full table would
restate what the system prompt already says about the target and pay for it in every
conversion turn; sending only the differences is the one thing neither the system
prompt nor the existing sections carry, because a difference is a property of the pair.

### 7. Wire-format additions are additive and defaulted

The vocabulary crosses an iframe boundary into a separately built docs bundle with its
own service worker, so an older cached bundle posting or receiving a message without
the new fields is a real case. Both new fields default to empty on parse, which
degrades to today's behaviour rather than to a broken page.

## Risks / Trade-offs

- **A charset change silently invalidates the authored repertoire** → the crosscheck
  derives the answer from the charset itself and asserts equality, so the test fails on
  the next run rather than the guide quietly giving wrong advice.

- **The character scan double-counts escapes as characters** → the scan skips whatever
  `probeFor(dialect.id).parseUnit` consumes as an escape unit; those bytes are already
  reported through `escapeCodes`, and reporting them twice would put block graphics in
  a list headed "characters the target cannot represent".

- **A text scan over-reports characters used only in a `REM`** → accepted. A `REM` body
  is tokenized through the charset like any other text, so a character the target
  lacks is a real failure there too.

- **More sections make the port turn longer, and it already carries the program** →
  every new section is narrowed to the program, so its size is bounded by the program
  rather than by the distance between the machines. The language-rule section is the
  only unnarrowed addition, and it is at most a dozen short lines and only the rows
  that differ.

- **The escape-spelling section grows the system prompt for every dialect** → it is the
  data the assistant needs to write a control code at all, it is constant per machine
  so it caches, and it replaces hand-written prose in each `aiProfile` that is not
  crosschecked against anything. Trimming those profiles is left for follow-up work
  rather than done blind in this change.

## Open Questions

None blocking. Whether the per-dialect `aiProfile` prose about escapes should be trimmed
now that the generated escape section exists is a judgement best made by reading the
composed prompts, not decided in advance. Measured, the section costs 748 characters on
the ZX81's 14,623 and 2,374 on the C64's 17,449 — a prefix-cached block, so the cost is
paid once per machine per session. Trimming is a tidiness question, not a budget one.
