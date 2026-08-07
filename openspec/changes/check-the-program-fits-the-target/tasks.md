## 1. One definition of the budget thresholds

- [ ] 1.1 `src/reference/ramBudget.ts` (new): the budget percentage of a byte
      count against a machine's free program RAM, the warn/crit thresholds
      (80%/95%) and the severity they produce. Imports nothing, so the docs
      bundle can read it.
- [ ] 1.2 `src/app/useProgramStats.ts`: `ramBudget`/`ramSeverity` read the new
      module instead of holding their own copy; the exported surface the status
      bar and its tests use is unchanged.
- [ ] 1.3 `src/reference/ramBudget.test.ts`: the two thresholds classify at their
      boundaries (79/80/94/95/100), and a case pinning that the status bar's
      `ramSeverity` and the guide's fit classification agree for the same
      percentage — the drift this module exists to prevent.

## 2. The fit finding, computed purely

- [ ] 2.1 `src/reference/compare.ts`: a `ProgramSize` shape (the target's id, the
      byte count, and whether the target tokenized it cleanly) declared beside
      `ProgramVocabulary`, with the same note about why it is declared rather
      than imported, and a `programFitForTarget(targetFacts, size)` returning the
      byte count, the target's free RAM, the percentage, the severity and whether
      the figure is a lower bound. Returns null when the size answers for a
      different machine than the facts describe.
- [ ] 2.2 Same file: the doc comment states that the fit is *not* a narrowing of
      any table — it is a finding that exists only where there is a program — so
      the `diffForProgram` invariant is not read as covering it.
- [ ] 2.3 `src/reference/compare.test.ts`: fits / close to the limit / does not
      fit at the threshold boundaries; a lower-bound result when the target
      reported errors; null for a size answering for another machine; the
      C64 → VIC-20 case, where the keyword diff is empty and the fit is not.

## 3. Measuring the program on the target

- [ ] 3.1 `src/app/programVocabulary.ts`: `vocabularyReply` takes the machine
      being ported *to* as well as *from*, and returns the target's own
      `tokenize(source).byteSize` with the id it answers for and whether that
      tokenization was error-free. An unregistered or absent target id yields no
      size rather than a wrong one.
- [ ] 3.2 Same file: document that errors from the target's tokenizer are
      expected on a port and make the figure a lower bound rather than
      suppressing it — the trap a later reader is most likely to "fix".
- [ ] 3.3 `src/components/DocsDrawer.tsx`: the vocabulary request carries the
      target machine as well as the source; the reply includes the fit fields;
      `PROGRAM_VOCABULARY_FIELDS` grows to match.
- [ ] 3.4 `src/components/DocsDrawer.test.ts`: the request and reply field lists
      still agree with the docs side by string; a reply for a program with a
      target named carries a size; one with no target named carries none.
- [ ] 3.5 `src/app/programVocabulary.test.ts`: the size is the target's, not the
      source's — the same source text through two machines' tokenizers gives two
      byte counts (the Sinclair and Microsoft-derived families differ on a plain
      numeric literal), and a program the target cannot fully express still
      returns a size with the not-clean flag set.

## 4. Reporting it on the page

- [ ] 4.1 `docs/.vitepress/theme/components/DialectCompare.vue`: name the target
      in the vocabulary request and re-request when the target machine changes;
      ignore a reply whose target is not the one now selected, as a reply for
      another source machine is already ignored.
- [ ] 4.2 Same file: a fit finding computed from `programFitForTarget`, absent
      whenever the notice state is not `narrowed`, and unaffected by the "show
      every difference" control.
- [ ] 4.3 Same file: render it with both figures and the machine each belongs to,
      coloured by severity, and add it to `pageSections` so the "on this page"
      row lists it exactly when it is shown.
- [ ] 4.4 Check the colour key: if the fit finding introduces a colour the key
      does not explain, it joins the key on the same condition it is rendered
      under, per the existing colour-key requirement.

## 5. Quality gates

- [ ] 5.1 `npm run typecheck`
- [ ] 5.2 `npm test`
- [ ] 5.3 `npm run lint` and `npm run format:check`
- [ ] 5.4 `npm run docs:build`
- [ ] 5.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey in that folder rather than adding a cold `page.goto('/')`: with a
      program open and a target that cannot hold it, the fit finding is on the
      page with both figures; with a target that can, it reports a fit. Only
      check this off when the run passes.
