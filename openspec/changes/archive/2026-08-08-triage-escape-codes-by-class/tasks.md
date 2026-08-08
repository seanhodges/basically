## 1. A shared vocabulary of code classes

- [x] 1.1 `src/reference/escape-classes.ts` (new): the closed vocabulary of what a
      control code *is* — colour, cursor, editing, mode, function keys, block
      graphics, user-defined graphics, inverse video, embedded number, literal,
      compression, screen effect, other control, raw byte — declared the way
      `src/reference/domains.ts` declares the keyword domains, with a comment on
      why it is separate from the page-scoped categories.
- [x] 1.2 `src/reference/types.ts`: `EscapeTableData.categories` entries gain the
      class they belong to, documented as the cross-page handle for guidance while
      the id and label stay page-scoped.
- [x] 1.3 `src/reference/escapes/*.ts`: classify every category on all nine pages.
      No row changes.
- [x] 1.4 `src/reference/escapes/escape-data.test.ts`: every category declares a
      class from the vocabulary, and every class in the vocabulary is used by at
      least one page — a dead class is as much a defect as a missing one.

## 2. The guidance table

- [x] 2.1 `src/reference/escape-guidance.ts` (new): per (target page, class) —
      how well the target expresses the class, what to do instead where it cannot,
      and where a worked example earns its place. Same shape and same authoring
      discipline as `domain-guidance.ts`.
- [x] 2.2 Author the cells the crosscheck in 2.3 demands, starting with the
      classes that carry the most work: block graphics into every non-Commodore
      target, colour into the machines that have no embedded colour codes, cursor
      into the machines that position by print-at.
- [x] 2.3 `src/reference/escape-guidance-crosscheck.test.ts` (new): walk every
      ordered pair, take the real escape diff, and require a cell for every class
      some source can lose into that target; reject a cell no pair can reach; hold
      the prose to the same brevity budget the capability guidance is held to.
      Modelled on `domain-guidance-crosscheck.test.ts`.

## 3. Reporting the verdict

- [x] 3.1 `src/reference/compare.ts`: `EscapeSection` gains the group's class and
      its guidance cell, resolved from a table passed in by the caller — never
      imported — exactly as `capabilitySections` takes `domainGuidance`. Section
      order is unchanged.
- [x] 3.2 `src/reference/compare.test.ts`: sections carry their class; the
      guidance cell is selected for the right target and omitted when no table is
      supplied; the order is still the source page's declared category order; a
      category the diff does not touch is still absent.
- [x] 3.3 `docs/.vitepress/theme/components/DialectCompare.vue`: render the
      verdict against each group and the advice beneath it, once per group. If the
      verdict introduces a colour the key does not explain, it joins the key on
      the condition it renders under.

## 4. Quality gates

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm test`
- [x] 4.3 `npm run lint` and `npm run format:check`
- [x] 4.4 `npm run docs:build`
- [x] 4.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey: a Commodore-to-Sinclair port shows the key-graphics group marked as
      a class the target cannot express, with its advice, and a group the target
      covers marked as such. Only check off when the run passes.
