## 1. Comparable variable-name and number rules

- [ ] 1.1 `src/reference/types.ts`: `PortingFacts` gains structured variable-name
      significance — how many characters are significant, the narrower rule where
      a machine restricts strings and arrays further, whether the type marker is
      part of the name, and which marker characters the machine has — and
      structured number handling (fractions or not, and the range where not).
      Both beside the prose, which stays as the fact rows' text.
- [ ] 1.2 `src/reference/facts.ts`: author both for every machine from the same
      sources the prose came from, `extends` siblings included.
- [ ] 1.3 `src/reference/facts-crosscheck.test.ts`: the structured number
      handling agrees with the prose (integer-only exactly when the prose says so,
      the same range quoted).
- [ ] 1.4 Same file: the structured significance is re-derived against each
      dialect's own `lint()` — a probe program built from the authored rule, with
      two names sharing the significant prefix, is flagged exactly when the rule
      says they collide, and a machine authored as fully significant produces no
      such finding. A machine whose lint has no rule must be authored as fully
      significant.

## 2. What the program uses

- [ ] 2.1 `src/app/programVocabulary.ts`: the vocabulary reports the program's
      distinct variable names, collected with the editor's existing dialect-aware
      variable walk over the same `scannable` bodies the keyword scan uses, so
      string literals, `REM` tails and `#BIN` payloads contribute none.
- [ ] 2.2 Same file: whether the program's code divides, and whether it carries a
      fractional literal — two facts, read from the same scannable text so a `/`
      inside a string is not arithmetic.
- [ ] 2.3 `src/app/programVocabulary.test.ts`: names inside strings, REMs and
      `#BIN` are not collected; a keyword is not collected as a name; a `PROC`/`FN`
      call is not; the division and fraction flags for a program that has each, and
      for one that has them only inside strings.
- [ ] 2.4 `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts`: the new fields
      cross the boundary and the two sides' field lists still agree by string.

## 3. The findings

- [ ] 3.1 `src/reference/compare.ts`: a pure collision finding — group the
      program's names by the key the target's rule produces, report the buckets
      holding more than one name, each with its key. Pure, taking facts and
      vocabulary, like the other narrowed findings.
- [ ] 3.2 Same file: a pure truncation finding — the target has no fractions and
      the program divides or carries a fractional value — carrying the range the
      target holds.
- [ ] 3.3 `src/reference/compare.test.ts`: a collision on a two-significant
      target; the same names on a fully significant target reporting nothing;
      names kept apart by their type marker; a single-letter target; the
      truncation finding present and absent both ways.

## 4. Reporting them

- [ ] 4.1 `docs/.vitepress/theme/components/DialectCompare.vue`: render both
      findings with the same weight as the same-word-different-meaning warnings —
      these are the same class of failure — and add them to `pageSections` on the
      conditions they render under. Absent when the comparison is not narrowed.
- [ ] 4.2 `src/ai/portReport.ts` + `portDescription.ts` + its test: both findings
      join what the assistant is handed for the port.

## 5. How colour attaches to the display

- [ ] 5.1 `src/reference/facts.ts`: for each machine whose display model a port
      has to relearn — attribute clash, per-cell colour, mode-dependent colour —
      a target porting note saying what it means for a routine that draws, tagged
      with the topics it makes so a pair note can supersede it.
- [ ] 5.2 `src/reference/porting.ts`: pair notes where a direction has something
      sharper to say than the target note, with `covers` set accordingly.
- [ ] 5.3 `src/reference/porting-crosscheck.test.ts`: the notes stay within the
      existing per-machine budget and every `covers` tag answers to a real target
      note (the existing checks; confirm the new prose passes them).

## 6. Quality gates

- [ ] 6.1 `npm run typecheck`
- [ ] 6.2 `npm test`
- [ ] 6.3 `npm run lint` and `npm run format:check`
- [ ] 6.4 `npm run docs:build`
- [ ] 6.5 `npm run e2e:chromium -- e2e/porting-guidance` — extend an existing
      journey: a program with two names that collide on the target reports both
      names and what they become. Only check off when the run passes.
