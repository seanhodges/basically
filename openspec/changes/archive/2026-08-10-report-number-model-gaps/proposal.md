## Why

The truncation finding answers one number question — does the target hold
fractions — and the machines pose three more that the guide is silent on:

- **Two integer machines with different ranges.** The Atom holds 32-bit whole
  numbers and the ZX80 holds 16-bit ones. A program moving between them divides
  nothing and carries no fraction, so the truncation finding never fires, and a
  value over 32767 is simply wrong on arrival. The ranges are already authored
  and crosschecked; nothing compares them.
- **A separate number system the target offers.** The Atom's floating-point ROM
  gives it real variables (`%A`–`%Z`) beside its integer-only main path. The
  guide's advice for a fractional program is always "rescale", which is right
  when the fractions are incidental and wrong when they are the point. Whether
  they are the point is not decidable from the text — it is a decision the
  reader (or the assistant) has to make, and the guide never poses it.
- **Type markers the target does not have.** A `%` integer variable ported to
  the Altair stores without complaint and fails with `?SN ERROR` the moment the
  line runs; a `#` double moved to a single-precision machine keeps running and
  quietly loses digits. Both tokenize cleanly; neither reaches any finding
  today, because the variable findings only ask whether names *collide*.

The shared shape is new to the guide, and this change establishes it: where a
finding turns on what the program is *supposed to do* rather than on what its
text says, the guide states the fact it can compute and **poses the decision it
cannot** — one `Decide:` line inside the finding that owns it — instead of
silently choosing one reading.

## What Changes

- **The number-handling finding compares integer ranges.** Where both machines
  are integer-only and the target holds a narrower range, the comparison
  reports both ranges, names any values in the program's text the target cannot
  hold, and poses the decision: rescale, or restructure the arithmetic.
- **The truncation finding poses the fractions decision** where the target
  offers reals outside its main number path (the Atom's floating-point ROM):
  keep essential fractions in that system, or rescale incidental ones. The
  authored facts gain the alternative's name; the truncation arithmetic is
  unchanged — a ported expression still lands on the integers.
- **Type markers the target lacks are reported.** Each marker the program's
  variables carry that the target's naming rule does not recognise is reported
  with what it meant, the names carrying it, and — where the target accepts the
  spelling and fails at run time — a warning in exactly those terms.
- **Carrying out the port carries the posed decisions.** The assistant is told
  to settle each `Decide:` line from what the program itself does, and to say
  which reading it chose where the text cannot settle it.
- **The vocabulary grows by one field**: the distinct whole-number values in
  the program's text large enough to overflow any registered integer-only
  machine, collected under the same rules as everything else the vocabulary
  reports.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *Type markers the target does not
  have are reported* — and two modified: *The language differences report how
  the machine handles numbers* (integer-to-integer narrowing, and the posed
  fractions decision) and *Carrying out the port targets the machine chosen*
  (posed decisions are settled from the program, not silently).

## Non-goals

- **Modelling what overflow does.** Whether a machine wraps, errors, or
  promotes on overflow has no structured source to pin against, so the finding
  says the target *cannot hold* the value and stops there. An emulator-probe
  crosscheck could earn the stronger claim later.
- **Evaluating expressions.** "This value is beyond the range" is read from
  literals in the program's text; arithmetic that overflows without a large
  literal is covered by the posed decision, not by symbolic evaluation.
- **Deciding for the reader.** The FP-ROM line poses the choice. Choosing —
  from the program's behaviour or by asking the user — belongs to the reader
  and the assistant, not the report.
- **Changing the truncation maths.** The Atom's FP ROM still does not make the
  Atom "have fractions"; the settled reasoning behind that stands.

## Impact

Affected code:

- `src/reference/types.ts`, `src/reference/facts.ts` — the fractions
  alternative on number handling, and the authored marker traps; crosschecked.
- `src/reference/compare.ts` + `compare.test.ts` — the range-narrowing and
  marker-loss findings, pure, over facts and vocabulary.
- `src/reference/portDescription.ts` + its test — the two new sections, the
  `Decide:` lines, and their placement in the work order.
- `src/app/programVocabulary.ts` + its test — the large-literal census.
- `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts` — the wider payload.
- `docs/.vitepress/theme/components/DialectCompare.vue` — both findings beside
  the truncation and collision findings they extend.
- `src/ai/portReport.ts` — both findings and the settle-the-decisions
  instruction join what the assistant is handed.
- `e2e/porting-guidance/` — one browser assertion, extending an existing
  journey.

Depends on nothing else in flight. Four sibling proposals extend the same
posed-decision convention; this change introduces it, and lands first.

No dependency changes, no storage or share-format changes, no tokenizer or
linter behaviour changes, and the per-machine reference the assistant's system
prompt carries is byte-for-byte unchanged.
