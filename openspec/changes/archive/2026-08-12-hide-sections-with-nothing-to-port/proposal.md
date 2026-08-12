## Why

Narrowing the comparison to the open program is meant to leave the reader with
the work their port actually needs. It does not, quite: a section whose work
has narrowed away stays on the page and says so — "0 commands to rewrite or
remove", "No ZX81 control code needs replacing". A heading that announces its
own emptiness costs the reader a stop to read, a moment to work out that
nothing is being asked of them, and a scroll past. Enough of them and the
narrowed page reads like the unnarrowed one, which is the thing narrowing was
for.

## What Changes

- While the comparison is narrowed to a readable open program, a section with
  nothing for the reader to do is not rendered at all — no heading, no zero
  count, no empty-state line.
- What counts as "nothing to do" is settled: content the target adds that the
  program never used is news, not work, and does not by itself keep a section
  on the page. Everything the reader must act on or be told about — including
  codes that keep their spelling and change meaning — does.
- The "show what the target adds that the program has not used" control and its
  "N … are hidden" disclosure move out of the two sections that own copies of
  them today and are stated once for the page. Hiding an additions-only section
  would otherwise take the only route to that filter down with it, and the
  filter is a behaviour the baseline spec already guarantees. Turning it on
  brings the additions-only sections back.
- Not narrowed, nothing changes: the comparison is then the whole
  machine-to-machine reference and every section it can show, it still shows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: adds a requirement that a narrowed comparison renders
  only the sections with something to port, and settles what content counts.
  Touches the existing guarantee that additions can be filtered out, which
  keeps its behaviour but states the filter once for the page rather than per
  section.

## Non-goals

- **Not a re-grouping.** Which findings belong in which section, and how the
  groups within a section are ordered, tinted and capped, are unchanged. This
  only decides whether a section appears.
- **Not a change to the unnarrowed comparison.** With no program open, or one
  that cannot be read, every section that has content stays exactly as it is.
- **Not a change to what narrowing finds.** No finding is added, dropped or
  reclassified; the same narrowed data drives the page.
- **Not an empty-state rewrite.** Empty-state lines that sit inside a section
  that does have work — "no control code needs replacing" alongside codes whose
  meaning changed — are still useful and stay.
- **No new page-level "nothing to port" summary.** The summary line already
  says "Nothing in your program has to be rewritten."; this change does not add
  a second statement of the same fact.

## Impact

- `docs/.vitepress/theme/components/DialectCompare.vue` — the porting guide UI,
  and the only place sections are decided. The two sections whose visibility
  conditions admit work-free content are "What changes"
  (`v-if="capabilities.length"`, whose groups may all be gain-only) and
  "Control & escape codes"
  (`v-if="escReplaceSections.length || escapeAdded || escapeRechecked.length"`,
  where `escapeAdded` alone keeps it up). Every other `cmp-section` needs the
  same audit against the settled rule; several gate on a narrowed computed
  (`statementLayout`, `lineNumbers`, `positionCheck`, `programFit`) that has to
  be checked for whether it can report an all-clear rather than null.
- The shared `showAdditions` ref and its two in-section checkboxes, plus the
  `gainingCount` disclosure line, move to one page-level control.
- No `src/` change expected: the narrowing and diffing that feed the component
  are untouched.
- Tests: unit coverage for the visibility rule, and the `porting-guidance` e2e
  folder for the browser-visible result.
