## 1. Comparing usage by shape

- [x] 1.1 Add a usage-shape normalisation to `docs/.vitepress/theme/dialectCompare.ts` beside
      `normaliseSyntax`: `<placeholder>`s and lowercase identifiers collapse to one marker, while
      brackets, punctuation and literal uppercase keywords survive.
- [x] 1.2 Compare on the shape in `keywordChanged`, so a difference only in placeholder naming is
      no longer a behaviour change.
- [x] 1.3 Classify each surviving change on `KeywordChange` (`kind` / `parens` / `arguments`),
      derived from the two entries the diff already holds.
- [x] 1.4 Cover both directions in `docs/.vitepress/theme/dialectCompare.test.ts`: a naming-only
      pair collapses; a parenthesisation difference, an argument-count difference and a
      command/function difference are still reported and carry the right classification.
- [x] 1.5 Render the classification as a short phrase in the changed-behaviour list in
      `DialectCompare.vue`, above the two usages.

## 2. Grouping control codes

- [x] 2.1 Add `escapeSections` to `dialectCompare.ts`, mirroring `domainSections`: group by
      `EscapeEntry.category` in the owning table's own `categories` order, labelled from that table,
      with no cross-dialect support ranking (the vocabularies are page-scoped, not shared).
- [x] 2.2 Cover it in `dialectCompare.test.ts`: every code lands in exactly one group, the table's
      category order is kept, empty categories are omitted, counts are per group, and a code whose
      category the table does not declare still surfaces.
- [x] 2.3 Render both control-code columns as category groups in `DialectCompare.vue` — heading,
      count, compact run of spellings — and drop their truncation lists.

## 3. Number handling as a language fact

- [x] 3.1 Add a required `numberHandling` field to `PortingFacts` in `docs/reference/data/types.ts`.
- [x] 3.2 Author it for all eight dialects in `docs/reference/data/facts.ts`, from each dialect's
      hardware page and tokenizer — integer-only machines state their range.
- [x] 3.3 Add the row to `factRows` in `DialectCompare.vue`, positioned with the other language
      rules rather than the hardware rows.
- [x] 3.4 Guard it in `docs/reference/data/facts-crosscheck.test.ts`: it is prose like the other
      hand-authored fields, so there is nothing in `src/` to pin it to — instead every page must
      answer in the same terms (floating point or integer only), and an integer-only page must
      state its range.

## 4. Page order and prose

- [x] 4.1 Reorder the sections in `DialectCompare.vue` so the language and hardware differences,
      the pair notes, the target guidance, the false friends and the commands to replace precede
      the renames, the changed behaviour and the control codes.
- [x] 4.2 Move the `<slot />` above the picker panel so the unchanging prose no longer splits the
      pair-specific sections.
- [x] 4.3 Condense the seven paragraphs in `docs/reference/compare.md` to roughly half, keeping
      every fact — the two conditions on the AI conversion, the two-significant-characters trap,
      a name containing a reserved word, the three exponent spellings, addresses never travelling —
      and fix "allows ony one statement".

## 5. Navigation and polish

- [x] 5.1 Give the component's section headings stable ids and render an on-this-page row beneath
      the summary.
- [x] 5.2 Make empty sections behave consistently — a section with nothing to report is absent.
- [x] 5.3 Rewrite the count summary as a sentence, without `(s)` pluralisation.
- [x] 5.4 Link the porting guide from `docs/guide/writing-basic.md`.

## 6. Pair notes

- [x] 6.1 Add `pairPortingNotes` for commodore↔zxspectrum, commodore↔bbc, zxspectrum↔bbc and
      cpc↔zxspectrum in `docs/reference/data/porting.ts`, three sentences per direction, grounded
      in each dialect's reference table and hardware page.
- [x] 6.2 Confirm `docs/reference/data/porting-crosscheck.test.ts` still passes — it fails if a
      spelling named in a note does not exist on both sides.

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npm test`
- [x] 7.3 `npm run lint`
- [x] 7.4 `npm run format:check`
- [x] 7.5 `npm run docs:build`
- [x] 7.6 `npm run e2e:chromium -- e2e/porting-guidance`
- [x] 7.7 Read the built page for the pairs that stress it: `?from=commodore&to=zxspectrum`,
      `?from=cpc&to=zx81`, `?from=zx80&to=zx81`, `?from=bbc&to=cpc`, `?from=commodore&to=bbc`.
