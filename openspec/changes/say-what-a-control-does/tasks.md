## 1. Inventory and style sheet

- [ ] 1.1 List every in-scope `title` / `aria-label` literal in `src/**/*.tsx`
      excluding `src/keyboard/**`, with its file, line and control, as the
      worklist for groups 3-5
- [ ] 1.2 Inventory the dialog subtitles, settings-row captions, panel
      empty-states and inline notices, flagging each as accurate, stale or
      merely wordy
- [ ] 1.3 Set the tooltip length budget from the real distribution in 1.1 and
      record it in the rule, with a comment saying where the number came from
- [ ] 1.4 Seed the `VAGUE_LABELS` denylist from the bare-noun labels found in
      1.1

## 2. The lint rule

- [ ] 2.1 Write `eslint-rules/no-vague-ui-labels.js`, modelled on
      `eslint-rules/no-plan-references.js`: header comment explaining why the
      rule exists, a pattern table, and `meta.messages` phrased as a fix
- [ ] 2.2 Inspect only `JSXAttribute` nodes named `title` or `aria-label` whose
      value is a plain string literal; skip template literals and expressions
      so labels built from user, shortcut or dialect data are never flagged
- [ ] 2.3 Implement the checks: trailing period, over budget, leading gerund,
      hard-coded dialect/machine list, and a `title`/`aria-label` pair on one
      element whose literals disagree
- [ ] 2.4 Do NOT flag an identical `title`/`aria-label` pair — that is the
      correct pattern for an icon-only control
- [ ] 2.5 Add `eslint-rules/no-vague-ui-labels.test.ts` with accept and reject
      fixtures for every check in 2.3, including the identical-pair accept case
- [ ] 2.6 Wire the rule into `eslint.config.js` with `files: ['src/**/*.tsx']`
      and `ignores: ['src/keyboard/**']`
- [ ] 2.7 Run `npm run lint` and capture the violation list — this is the
      worklist for groups 3-5

## 3. The three dense files

- [ ] 3.1 `src/components/Toolbar.tsx` — rewrite its labels to the house style
- [ ] 3.2 Route the renumber-line tooltip through `withKeys` so it reads the
      live shortcut map instead of hard-coding `Ctrl/Cmd+Alt+R`
- [ ] 3.3 Hoist the procedures and profiling tooltips, each duplicated verbatim
      between a toolbar button and its overflow menu item, to module constants
- [ ] 3.4 Keep every shortcut suffix in `title` only, never in `aria-label`
- [ ] 3.5 `src/components/EditorTabBar.tsx` — rewrite its labels, including the
      lower-case `aria-label="does not assemble"`
- [ ] 3.6 `src/components/MemoryMapPanel.tsx` — give the zoom slider one name
      across `title` and `aria-label`, leaving the identical icon-button pairs
      alone

## 4. The remaining components

- [ ] 4.1 Clear the rule across the other 18 in-scope files, `src/player/` included
- [ ] 4.2 Confirm `npm run lint` reports no `local/no-vague-ui-labels` violations

## 5. Helper text

- [ ] 5.1 Rewrite the dialog subtitles flagged in 1.2, plainer and shorter, and
      cut any that only restate their heading
- [ ] 5.2 Rewrite the settings-row captions, panel empty-states and inline
      notices
- [ ] 5.3 Correct any blurb naming a fixed set of machines — `registry.ts` is
      the source of truth

## 6. Tests and docs

- [ ] 6.1 Update the e2e selectors whose matched substring was reworded;
      review every `exact: true` site individually
- [ ] 6.2 Update any Vitest assertion on a reworded label
- [ ] 6.3 Add `e2e/control-labelling/labels.spec.ts` — one cold page load
      asserting that every icon-only toolbar and memory-map control resolves to
      a non-empty accessible name, and that the zoom slider's tooltip and
      accessible name agree. Browser-only: accessible-name computation is what
      is being checked, and no unit test can do it
- [ ] 6.4 Add one bullet to `CLAUDE.md` under *Conventions* stating the label
      style and citing `eslint-rules/no-vague-ui-labels.js`, matching how the
      comments convention cites `no-plan-references.js`

## 7. Quality gates

- [ ] 7.1 `npm run typecheck`
- [ ] 7.2 `npm test`
- [ ] 7.3 `npm run lint`
- [ ] 7.4 `npm run format:check` (or `npm run format` to fix)
- [ ] 7.5 `npm run e2e:chromium -- e2e/shell-navigation`
- [ ] 7.6 `npm run e2e:chromium -- e2e/memory-map`
- [ ] 7.7 `npm run e2e:chromium -- e2e/sharing-player`
- [ ] 7.8 `npm run e2e:chromium -- e2e/ai-assistant`
- [ ] 7.9 `npm run e2e:chromium -- e2e/hardware-transfer`
- [ ] 7.10 `npm run e2e:chromium -- e2e/control-labelling`
- [ ] 7.11 Read the toolbar, tab bar and memory map in `npm run dev` — a lint
      rule cannot judge whether the new wording is good
