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
- What a port loses and gains in a capability is reported together, in one account of that
  capability, instead of once under the commands to replace and again under the commands newly
  available. Measured across the 56 ordered pairs, 52% of capability mentions are currently made
  twice — 12 of 13 capabilities on BBC → Locomotive — and the newly-available section is the
  tallest on the page (21–30% of its height) while being the least actionable part of a port.
- The commands that only change spelling are reported with the commands whose usage differs, as one
  account of the commands that exist on both machines but are not written the same way, and a rename
  is reported as its two spellings rather than as a detailed entry carrying a description the
  reference page already gives.
- The control codes the target adds and the source never used are reported as a count with a pointer
  to the target's control-code reference, rather than listed — they are not work the port must do.
- What the target adds where the port loses nothing — the capabilities with nothing to replace, and
  those control codes — is filtered out by default behind a control that says how much it is hiding,
  since it is the one part of the comparison that is news rather than work. What the target offers
  in a capability the port does lose commands from is the advice for replacing them, and is never
  hidden.
- The guidance specific to this pair and the guidance for writing on the target are shown as one
  section rather than two adjacent identical lists, and where the pair's own bullets already make
  every point one of the target's bullets makes, that bullet is not shown again in more general
  terms — 18 of the eight dialects' 40 target bullets are superseded somewhere, 26 times across the
  18 pairs that have notes of their own.
- Every control over what the comparison reports is phrased as showing what it reveals rather than
  hiding what it removes, so a ticked box always means more is reported; which of them start ticked
  is unchanged.
- The colours the comparison distinguishes its reports by are explained by a key above the
  sections, in one horizontal run, naming only the colours the chosen pair puts on the page.
- What any port between these BASICs involves — the four things that account for most of the work —
  becomes a page of its own, linked from the end of the intro as the thing to read first, rather
  than prose every reader of every comparison scrolls past.
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
  sections a porter acts on come first; what a port loses and gains in a capability is reported
  together, as are differing spellings and differing usage; control codes to replace are grouped by
  what they do while the ones the target adds are reported as a count; and the language differences
  include whether the machine has floating point.

## Impact

- `docs/.vitepress/theme/dialectCompare.ts` — syntax-shape comparison, the "what changed"
  classification, escape-code grouping (mirroring the existing `domainSections`), and one
  capability-section builder replacing the separate `domainSections` and `capabilityBrief`.
- `docs/.vitepress/theme/components/DialectCompare.vue` — section order and the merges, the
  escape-code and changed-behaviour rendering, the numeric fact row, headings and summary line.
- `docs/reference/compare.md` — condensed prose, moved above the picker, then reduced to the intro
  and a link once the general guidance moved out; `docs/reference/porting-basics.md` — the page it
  moved to.
- `docs/reference/data/porting-topics.ts` — the topic vocabulary the guidance de-duplication is
  authored against; `docs/reference/data/porting.ts` and `docs/reference/data/facts.ts` — the tags
  themselves, pinned by `porting-crosscheck.test.ts`.
- `docs/reference/data/types.ts`, `docs/reference/data/facts.ts` — the numeric-type fact for all
  eight dialects, pinned by `facts-crosscheck.test.ts`.
- `docs/.vitepress/theme/dialectCompare.test.ts` — coverage for the new comparison and grouping.
- `docs/guide/writing-basic.md` — a link to the guide.
- No `src/` change; the IDE-side conversion hand-off is untouched.
