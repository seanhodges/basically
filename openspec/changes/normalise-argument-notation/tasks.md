## 1. The glossary

- [ ] 1.1 Create `src/reference/placeholders.ts` mirroring `src/reference/domains.ts`:
      an `ARG_PLACEHOLDERS` array of `{ name, meaning }` in canonical render order, a
      derived `ArgPlaceholder` union type, and a header comment carrying the D3 collision
      resolutions and the D4 structural rules (including rule 11 — machine truth
      outranks notation, with Commodore's literal `D<number>` / `[, W]` / `I<id>` named
      as the worked exception).
- [ ] 1.2 Update the `syntax` field doc comment in `src/reference/types.ts` to point at
      `placeholders.ts` as the contract instead of giving an informal example.

## 2. Normalise the eight angle-bracket tables

One commit per page, so each diff stays reviewable. For every page: fold synonyms onto
the glossary, apply the D4 structural rules, and add role names to the *heterogeneous*
repeated-argument rows only (leave homogeneous lists such as `READ <var>[, <var>]…`
alone). Take argument order and arity from each machine's own reference material, never
from another page.

- [ ] 2.1 `src/reference/zx80.ts` and `src/reference/zx81.ts` (47 + 65 rows) — smallest
      pages first, to settle the rules in practice before the large ones.
- [ ] 2.2 `src/reference/zxspectrum.ts` (93 rows).
- [ ] 2.3 `src/reference/altair8800.ts` (70 rows) — folds `<expression>` → `<expr>` and
      drops the quoted `["<string>";]` form in `INPUT`.
- [ ] 2.4 `src/reference/atom.ts` (73 rows) — folds `<handle>` → `<channel>`; keep the
      `&`/`$` radix sigils, which are literal Atom syntax.
- [ ] 2.5 `src/reference/commodore.ts` (92 rows) — folds `<lf>`/`<file>` → `<channel>`,
      moves the ellipsis outside its bracket group (D4 rule 4), and **preserves**
      `D<number>`, `[, W]` and `I<id>` as literals.
- [ ] 2.6 `src/reference/trs80.ts` (123 rows) — folds `<file>` → `<channel>` and
      resolves `<int>` vs `<number>` (`POKE <addr>, <byte>`, `OUT <port>`-style roles).
- [ ] 2.7 `src/reference/bbc.ts` (122 rows) — includes
      `SOUND <channel>, <amplitude>, <pitch>, <duration>`,
      `PLOT <mode>, <x>, <y>`, `ENVELOPE`'s 14 parameters (prose out of the syntax
      string, per D4 rule 10), and `<param>`/`<arg>` kept distinct in `DEF`/`FN`.
- [ ] 2.8 Record any glossary additions or removals the sweep proved necessary back into
      `placeholders.ts`, and re-check that no entry is now unused.

## 3. Normalise the Amstrad table

- [ ] 3.1 `src/reference/cpc.ts` — bracket all 192 rows, mapping its existing role names
      onto the glossary and keeping `<stream>` distinct from `<channel>` (a CPC stream is
      a screen window, not a file).
- [ ] 3.2 Lift the prose out of the syntax strings per D4 rule 10: `ENT n,…(up to 5
      sections)`, `ENV n,…(up to 5 sections)` and `ON n GOSUB/GOTO line,…`, moving the
      limits into `description`.
- [ ] 3.3 Bring the fragment-keyword and pseudo-variable rows onto the majority style
      per D4 rules 8 and 9 (`STEP`, `TO`, `THEN`, `ELSE`, `TIME`), and replace quoted
      literals (`LOAD "name"`) with `<filename>`.

## 4. Enforce it

- [ ] 4.1 Extend `src/reference/reference-data.test.ts` with the conformance checks per
      D5: every `<…>` token is in the glossary, no glossary entry is unused, and no bare
      lowercase placeholder survives.
- [ ] 4.2 Tokenise with a pattern that matches `<` + lowercase identifier + `>` only, and
      add a test asserting the literal-`<` operator rows (`'<number> < <number> | <string>
      < <string>'`, `<=`, `<>`) are not mis-parsed as placeholders.
- [ ] 4.3 Add the cheap structural assertions per D5: no `...`, balanced brackets, no `…`
      immediately inside a group opened with `[,`. Do **not** assert spacing.

## 5. Remove the dead laundering

- [ ] 5.1 Drop `syntaxShape()`'s lowercase-word → `#` replacement in
      `src/reference/compare.ts`, keeping `<…>` → `#` and the whitespace/bracket
      normalisation, and rewrite its doc comment (it currently states the Amstrad
      divergence as a live fact and cites the 72-change figure).
- [ ] 5.2 Re-point the three bare-placeholder fixtures in `src/reference/compare.test.ts`
      onto glossary-name variation: `ABS(n)` → `ABS(<expr>)`, `DRAW x,y` →
      `DRAW <x>, <y>`, `DRAW x,y,ink` → `DRAW <x>, <y>, <ink>`; update the comments so
      they read as the invariant (naming inside `<…>` is not a difference, arity is)
      rather than as laundering.
- [ ] 5.3 Confirm `perMachineCompare.test.ts`, `portDescription.test.ts`,
      `keyword-crosscheck.test.ts` and `src/ai/portReport.test.ts` still pass unchanged;
      update only fixtures that quote a syntax string the sweep altered.

## 6. The legend

- [ ] 6.1 Add a "How to read the syntax column" section to `docs/reference/index.md`
      covering the D4 structural markings only (optional, alternatives, repetition,
      literal vs placeholder), in the spirit of `docs/reference/z80-assembly.md`'s
      `## Operand notation`.
- [ ] 6.2 Render a per-page vocabulary disclosure in
      `docs/.vitepress/theme/components/ReferenceTable.vue`, generated from
      `placeholders.ts` and filtered to the placeholders that page's rows actually use,
      collapsed by default.
- [ ] 6.3 Add a colocated unit test for the filtering helper (given a table's entries,
      it returns exactly the glossary entries used, in canonical order).
- [ ] 6.4 Link the legend from each of the nine dialect pages' existing
      `**In this reference:**` line. Do not touch the sidebar config.

## 7. Docs prose

- [ ] 7.1 Sweep the ~17 argument code spans in
      `docs/reference/{atom,bbc,cpc,trs80,zxspectrum}/hardware.md` onto the same
      notation and glossary, so `GCOL mode,n` and `PLOT k,x,y` stop naming the same
      class of argument two ways on one page. Leave concrete-literal examples
      (`MODE 0`…`MODE 7`, `CLEAR 32767`, `RAND USR 16514`) as literals.
- [ ] 7.2 Add an "arguments and their order" theme to
      `docs/reference/porting-basics.md`: differing argument counts, a leading
      mode/action argument on some machines only, reordered arguments (`SOUND` differs
      in the order of its first three between the BBC and the Amstrad), optional
      arguments the target lacks, and parenthesisation — cross-linking the comparison's
      existing bracketing bucket. Verify every claim against the reference data and the
      hardware pages.
- [ ] 7.3 Fix the one sentence in `docs/reference/file-formats.md` that mixes `NN` and
      `xx` for escape placeholders.

## 8. Quality gates

- [ ] 8.1 `npm run typecheck && npm test && npm run lint && npm run format:check`.
- [ ] 8.2 `npm run docs:build`, then `npm run docs:dev` and read one dialect page, the
      legend disclosure and the comparison page by eye.
- [ ] 8.3 `npm run e2e:chromium -- e2e/porting-guidance` — the comparison is the only
      app-visible consumer. Leave this unchecked with a note if it fails.
- [ ] 8.4 Verify the point of the change: diff the BBC → Amstrad comparison before and
      after (36 "different arguments" rows today) and confirm the survivors are real
      language differences rather than notation noise. Confirm against the
      `porting-guidance` requirement "Differences in usage notation are not reported as
      behaviour changes" that placeholder-name variation is still not reported.
- [ ] 8.5 `npx openspec validate --specs` and `npx openspec validate --change
      normalise-argument-notation`.
