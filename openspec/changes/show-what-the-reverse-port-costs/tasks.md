## 1. Counting a direction

- [ ] 1.1 `src/reference/compare.ts`: a pure count of what one direction reports —
      commands with no equivalent, renames, usage differences, control codes to
      replace and to re-check, same-word warnings, and characters the target
      cannot represent — over the unnarrowed diffs, with a comment stating why it
      is unweighted and why it is never narrowed (the reverse direction has no
      program to narrow by, and counting one side narrowed would compare two
      different questions).
- [ ] 1.2 `src/reference/compare.test.ts`: the count for a pair and for its
      reverse are produced by the same function and differ as the data does; a
      pair with itself counts zero; a narrowed vocabulary does not change either
      count.

## 2. Reversing

- [ ] 2.1 `docs/.vitepress/theme/components/DialectCompare.vue`: a reverse control
      between the two machine choices, which goes through the same path that
      choosing a machine takes — so the URL, the vocabulary re-request, and the
      capped-list reset all behave exactly as they do when the pair changes.
- [ ] 2.2 Same file: the two counts shown with the control, labelled as counts of
      findings for the two machines, and stated as machine-to-machine where a
      program is narrowing the page.
- [ ] 2.3 Same file: the control is reachable and operable by keyboard, and names
      what it does including the direction it would produce, as the machine
      choices already do.

## 3. Holding it

- [ ] 3.1 `e2e/porting-guidance/choose-machine.spec.ts`: extend the existing
      journey — reversing lands on the opposite pair, the URL names it, and a
      reload of that URL shows the same thing. No new cold `page.goto('/')`.

## 4. Quality gates

- [ ] 4.1 `npm run typecheck`
- [ ] 4.2 `npm test`
- [ ] 4.3 `npm run lint` and `npm run format:check`
- [ ] 4.4 `npm run docs:build`
- [ ] 4.5 `npm run e2e:chromium -- e2e/porting-guidance` — only check off when the
      run passes.
