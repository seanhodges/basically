## 1. The work list

- [x] 1.1 `docs/.vitepress/theme/components/DialectCompare.vue`: reorder the
      sections into the five classes — blocks the read, mechanical, rewrites,
      silent, fit — keeping the language and hardware differences, the guidance
      and the memory layout ahead of them as the frame.
- [x] 1.2 Same file: introduce each class so the sequence is legible rather than
      implied, in the page's existing voice and without restating what the
      sections below say.
- [x] 1.3 Same file: `pageSections` follows the new order and stays built from
      the same conditions the template guards each section with, so the "on this
      page" row cannot drift from what is shown.
- [x] 1.4 Same file: check the comment block above the section order still
      describes the order it now has — the file documents its own reasoning and a
      stale rationale is worse than none.

## 2. Holding the order

- [x] 2.1 `e2e/porting-guidance/`: update the existing order assertions and add
      one that the classes appear in the stated sequence for a pair that produces
      findings in all of them.
- [x] 2.2 Check the two ordering requirements have not been made to disagree: the
      language and hardware *rows* keep their own order, which this change does
      not touch.

## 3. Quality gates

- [x] 3.1 `npm run typecheck`
- [x] 3.2 `npm test`
- [x] 3.3 `npm run lint` and `npm run format:check`
- [x] 3.4 `npm run docs:build`
- [x] 3.5 `npm run e2e:chromium -- e2e/porting-guidance` — the order assertions
      above. Only check off when the run passes.
