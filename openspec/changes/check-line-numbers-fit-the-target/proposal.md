## Why

The porting guide holds both halves of a finding it cannot make. It knows each
machine's valid line-number range — as the prose string `1–9999`, `0–63999`,
`1–65535` — and it knows which of the open program's lines carry several
statements and would have to be **split into new lines** on a target that takes
one statement per line. It renders each half as its own row or section, compares
neither, and so never says the thing a reader needs: that this program's line
numbers do not fit the target, or that splitting it would push them past the
ceiling during the port itself.

The ranges are prose, which is why they cannot be compared. A BBC program
numbered to 32,767 ported to a ZX81 (ceiling 9,999) needs every line renumbered
before it can be typed in, and the guide today shows the reader two strings.

## What Changes

- **`PortingFacts` gains a structured line-number range** — a minimum and a
  maximum — alongside the prose it already carries. The prose stays: it is what
  the fact row shows, and `machineDescription.ts` and `portDescription.ts` both
  read it.
- **The comparison reports the program's line numbers against the target's
  range.** Where the reader's own program is at hand, the guide reports a line
  number below the target's minimum or above its maximum as work the port
  requires, naming the range and the offending end.
- **Where the port must split lines, the projected line count is reported too.**
  Splitting is the one transformation the port performs that *creates* line
  numbers, so the guide reports how many lines the program becomes, and says so
  when the target's range cannot hold them however they are renumbered.
- **The structured range is pinned two ways.** Against the prose, so the two
  cannot drift; and against each dialect's own tokenizer, which must accept the
  authored range's endpoints. The audit that motivated this found the Altair's
  prose range spelled with an ASCII hyphen where every other machine uses an en
  dash — the kind of drift a string comparison invites and a number does not.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: one requirement added — *The program's line numbers are
  checked against the target's range* — and one modified, *How the program's
  statement layout must change is reported*, so that a split which would
  overflow the target's line numbers is reported as part of that finding rather
  than left for the reader to work out.

## Non-goals

- **Renumbering the program.** The guide reports; the assistant converts. Where
  the report says the numbers do not fit, that fact is handed to the assistant
  along with the rest of what the comparison worked out, as the other findings
  already are.
- **Choosing a renumbering scheme.** The projected count is reported against the
  target's range; which step to renumber by is the porter's decision and depends
  on room they may want to keep.
- **Structuring the other two comparable prose facts.** Variable-name
  significance and number handling are the same kind of gap and are carried by
  the change that adds the findings which consume them, so no field lands
  without a reader-visible use.
- **Reconciling a machine's editor range with what its tokenizer will store.**
  Several tokenizers accept a wider range than the machine's own editor would
  (the Spectrum stores up to 16,383 while its ROM editor takes 1–9,999). The
  authored range stays the one a porter must renumber into — the editor's — and
  the crosscheck requires it to be a subset of what the tokenizer accepts rather
  than equal to it.

## Impact

Affected code:

- `src/reference/types.ts` — `PortingFacts` gains the structured range beside
  `lineNumberRange`, documented as the *editor* range.
- `src/reference/facts.ts` — one field per machine; the Altair's prose dash
  normalised so the crosscheck can be strict.
- `src/reference/facts-crosscheck.test.ts` — the structured range against the
  prose, and against each dialect's tokenizer.
- `src/reference/compare.ts` — a pure line-number finding, and the statement-
  layout finding gains the projected count; `compare.test.ts` alongside.
- `src/app/programVocabulary.ts` — the reply carries the program's lowest and
  highest line numbers, its line count, and how many statements it carries
  beyond one per line; `src/components/DocsDrawer.tsx` and `DocsDrawer.test.ts`
  carry the wider payload.
- `docs/.vitepress/theme/components/DialectCompare.vue` — renders the finding.
- `src/ai/portReport.ts` — the port handed to the assistant includes it, as it
  already includes the statement-layout change.
- `e2e/porting-guidance/` — one browser assertion.

No dependency changes, no storage or share-format changes, and no change to any
tokenizer's behaviour.
