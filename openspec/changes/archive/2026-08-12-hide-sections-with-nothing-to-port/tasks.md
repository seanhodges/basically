## 1. Audit the sections

- [x] 1.1 List every `<section class="cmp-section">` in `DialectCompare.vue`
      with its current `v-if`, and record for each whether it can render while
      narrowed with nothing for the reader to do.
- [x] 1.2 For the four sections gating on a narrowed computed
      (`statementLayout`, `lineNumbers`, `positionCheck`, `programFit`), read
      the `…ForProgram` / `…ForTarget` helper each one calls and record whether
      it can return an all-clear object rather than `null` — i.e. whether the
      section can report "checked, nothing wrong".
- [x] 1.3 Classify each section's content as work or news against the rule in
      the spec delta, resolving the known cases: gain-only capability groups
      and added control codes are news; rechecks ("same spelling, different
      meaning", "same word, different meaning") are work.
- [x] 1.4 Confirm the `|| factRows.length` arm of the "Language & hardware"
      condition, and whether the `showUnchanged` filter can empty that section
      the way `showAdditions` empties the other two.

## 2. The visibility rule

- [x] 2.1 Add a sibling module beside the component holding the rule as pure
      functions over the already-computed section data, following the
      `deepLinkParams.ts` / `deepLinkParams.test.ts` precedent in the same
      folder.
- [x] 2.2 Make each section's visibility derive from the content it actually
      renders under the current filter state, not from a separately written
      condition, so the two cannot drift.
- [x] 2.3 Compute visibility from the full filtered list rather than the
      truncated window, so a section capped by `useTruncatedList` is never
      mistaken for an empty one.
- [x] 2.4 Key the rule on the narrowed state (`notice.kind === 'narrowed'`),
      leaving every other state rendering as it does today.
- [x] 2.5 Write colocated `*.test.ts` for the rule: work-bearing content shows;
      additions-only content hides with the filter off and shows with it on;
      recheck-only content shows; a capped list shows; every non-narrowed state
      shows.

## 3. Apply it to the sections

- [x] 3.1 Replace the "What changes" condition so a program with no commands to
      rewrite and only gain-only groups does not render the section.
- [x] 3.2 Replace the "Control & escape codes" condition so `escapeAdded` alone
      no longer holds the section open, while `escapeRechecked` still does.
- [x] 3.3 Apply the rule to every other section the audit in group 1 found, and
      leave the ones already correctly gated alone.
- [x] 3.4 Keep the in-section empty-state lines that sit alongside real content
      (for example "No … control code needs replacing." shown with codes whose
      meaning changed), and remove any left unreachable.

## 4. The additions control

- [x] 4.1 Move the "show what the target adds that the program has not used"
      checkbox out of the capabilities and escape-code sections to a single
      page-level control near the narrowing notice, still bound to the one
      shared `showAdditions` ref.
- [x] 4.2 Move the "N capability area(s) … are hidden" disclosure with it and
      state once what is being held back across all the sections it governs,
      including the added control codes.
- [x] 4.3 Verify the control stays reachable when every section it governs is
      hidden, and that turning it on brings those sections back.

## 5. Browser coverage

- [x] 5.1 Extend `e2e/porting-guidance/filter-by-program.spec.ts` — rather than
      adding a cold spec — with staged assertions on one narrowed program: the
      work-free sections are absent, a section with rechecks is present, the
      page-level additions control is present, and turning it on restores the
      additions-only sections.
- [x] 5.2 Check no other spec in `e2e/porting-guidance/` asserts on a heading
      or control this change moves or removes, and update any that do.

## 6. Quality gates

- [x] 6.1 `npm run typecheck`
- [x] 6.2 `npm test`
- [x] 6.3 `npm run lint`
- [x] 6.4 `npm run format:check` (or `npm run format` to fix)
- [x] 6.5 `npm run docs:build` — `docs/` changes in this task list
- [x] 6.6 `npm run e2e:chromium -- e2e/porting-guidance` — check this off only
      when the run passes; if it fails, leave it unchecked with a note on what
      failed.
