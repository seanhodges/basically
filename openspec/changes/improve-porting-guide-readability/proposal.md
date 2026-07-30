## Why

The porting guide reports the differences between two dialects accurately, but a reader working
through it top-down meets the low-yield sections first and the section carrying the actual work
sixth. Two of its lists cost more attention than they return: **Changed behaviour** fires on any
difference between two hand-authored `syntax` strings, so `ABS(<number>)` → `ABS(n)` — a difference
in how two reference pages write their placeholders, not a difference between the machines — is
reported as a keyword whose behaviour changed (72 such rows on BBC → Locomotive, 1,556 across all
56 ordered pairs); and **Control & escape codes** lists control codes flat and alphabetically, so a
port off a Commodore opens on ten block-graphic keycaps rather than on the colour and cursor codes
that a screen layout actually depends on. The generic guidance also leans hardest on a fact the
comparison cannot report: whether the target machine has floating point at all.

## What Changes

- Notation-only differences between two reference pages' usage strings stop being reported as
  changed behaviour; genuine differences (a changed kind, a changed argument list, parentheses
  required on one machine and not the other) are still reported, and each now says what changed
  rather than showing two usage strings for the reader to compare by eye.
- The comparison's sections are ordered so that the sections a porter acts on lead, and the
  reference lists follow.
- Control and escape codes are grouped by what they do, the way the commands to replace are already
  grouped by capability, with the categories the target cannot reproduce reported first.
- The language and hardware comparison gains a numeric-type row: integer-only versus floating point,
  with the value range where the machine is integer-only.
- Editorial, no behaviour change: the guide's seven paragraphs of unchanging prose are condensed to
  roughly half their length keeping every fact, and the whole of it moves above the dialect picker
  instead of splitting either side of the comparison.
- Presentation, no behaviour change: section headings become linkable, empty sections behave
  consistently, the count summary is rewritten as a sentence, and the guide is linked from the
  BASIC-writing guide page.

## Non-goals

- Rewriting `docs/reference/data/cpc.ts` onto the `<…>` placeholder convention the other seven
  reference pages use. It is the root cause of the worst of the notation noise, but it is ~189
  hand-authored usage strings on a page that is correct as it stands; the comparison absorbing the
  difference is the cheaper and safer fix, and the tidy-up can stand on its own later.
- Changing which keywords, control codes or facts the reference pages themselves report.
- Any change to the AI conversion hand-off.
- Rewriting the per-capability porting advice (`domain-guidance.ts`); its coverage is already
  enforced by its crosscheck.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: differences that exist only in how two reference pages write their usage
  strings are not reported as changed behaviour; the comparison's sections are ordered so the
  sections a porter acts on come first; control codes are grouped by what they do; and the language
  differences include whether the machine has floating point.

## Impact

- `docs/.vitepress/theme/dialectCompare.ts` — syntax-shape comparison, the "what changed"
  classification, and escape-code grouping (mirroring the existing `domainSections`).
- `docs/.vitepress/theme/components/DialectCompare.vue` — section order, the escape-code and
  changed-behaviour rendering, the numeric fact row, headings and summary line.
- `docs/reference/compare.md` — condensed prose, moved above the picker.
- `docs/reference/data/types.ts`, `docs/reference/data/facts.ts` — the numeric-type fact for all
  eight dialects, pinned by `facts-crosscheck.test.ts`.
- `docs/.vitepress/theme/dialectCompare.test.ts` — coverage for the new comparison and grouping.
- `docs/guide/writing-basic.md` — a link to the guide.
- No `src/` change; the IDE-side conversion hand-off is untouched.
