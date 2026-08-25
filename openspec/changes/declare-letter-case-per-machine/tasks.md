## 1. Declare the facts

- [ ] 1.1 Add `src/dialects/letterCase.ts`: the fact types (lower-case glyphs —
      none / always / switched; keyword scan — folded / upper-only; name case —
      sensitive / folded; source encoding — preserved / folded), the declared
      leniency flag, a per-machine note, and one entry for every machine in
      `src/dialects/registry.ts`. Derive each entry from the ROM and the
      existing per-dialect charset and tokenizer evidence, never from memory.
- [ ] 1.2 Add the derived predicates beside the table — folds-keyword-case
      (ROM folds, or the encoding folds, or leniency is declared) and
      warns-on-lower-case-keyword (ROM matches by character and the encoding
      preserves) — plus the shared case-fold helper for names.
- [ ] 1.3 Add `src/dialects/letterCase.test.ts`: registry-driven coverage (every
      registered machine, no others) plus a hand-written table restating each
      machine's facts in prose, asserted against the declaration.
- [ ] 1.4 Add the behavioural arms to that test — encode a lower-case letter
      through the real charset and compare against the upper-case one; lint a
      lower-case keyword in the machine's own PRINT spelling; lint a two-case
      name pair; resolve a lower-case glyph source. Arms 2 and 3 are expected to
      fail on bbcmicro, bbcmaster and pmd85 until group 2 lands; note that in
      the commit rather than weakening the test.

## 2. Editor reads the declaration

- [ ] 2.1 Stop authoring `caseSensitive` in `src/editor/variableLexis.ts`; derive
      it from the new table at the rules boundary and add a lookup for the two
      lexis constants that are currently exported for direct use. Remove the
      self-contradicting prose about which machines distinguish case.
- [ ] 2.2 Extract the name-identity rule out of `src/editor/variableUsages.ts`
      into `src/editor/variableIdentity.ts` unchanged — it is already correct —
      and have the usages view call it.
- [ ] 2.3 Replace the significance key in `src/editor/variableLint.ts` with the
      shared identity rule, and stop folding the reported spellings so the
      message quotes the name as the program writes it.
- [ ] 2.4 Thread a keyword-folding flag through the language options into
      `src/editor/basicLanguage.ts` and through the variable-scanner rules into
      `src/editor/variables.ts`, so both fold for keyword lookup only where the
      machine would.
- [ ] 2.5 Add the same flag to the keyword-spellings table so
      `src/dialects/keywordSpellings.ts` reads an abbreviation as a keyword only
      in the case the machine's scan accepts.
- [ ] 2.6 Add one comment to `src/editor/crunch.ts` naming the fact that keeps
      its unconditional fold correct, so it is not "fixed" later. No behaviour
      change there and none in `src/editor/completions.ts`.
- [ ] 2.7 Add `src/editor/keywordCase.ts` with the shared diagnostic message, and
      emit it from the Atom, BBC Micro (and Master) and PMD 85 tokenizers. On the
      BBC this is an upper-case retry that yields a diagnostic and never a token,
      so the emitted bytes stay ROM-identical. All non-fatal.
- [ ] 2.8 Add colocated tests for the tokenizer diagnostics (Atom, BBC, PMD 85):
      the message is raised, the byte stream is unchanged, and the diagnostic
      does not block a build.
- [ ] 2.9 Extend the editor tests: BBC `print` tags as a variable name and ZX81
      `print` still tags as a keyword; BBC `print` is found by the variable
      scanner and C64 `print` is not; the PMD 85 two-case pair no longer
      collides while a genuine two-character collision still does; the lint and
      the usages view agree on the same PMD 85 program; BBC `p.` is not read as
      the keyword while the Commodore shifted-letter form still is; on the BBC,
      typing `print` offers both the keyword completion and the variable.

## 3. Porting and vocabulary read the declaration

- [ ] 3.1 Fold names in `src/app/programVocabulary.ts` through the declared fact
      instead of unconditionally, and correct the comment claiming the machines
      here are case-insensitive about names.
- [ ] 3.2 Add a case field to the variable-significance rule type in
      `src/reference/types.ts`, author it per machine in `src/reference/facts.ts`,
      and crosscheck it against the new table in the facts crosscheck test.
- [ ] 3.3 Make the significance key in `src/reference/compare.ts` respect it, so
      a case-sensitive source moving to a folding target reports the collision
      and the reverse direction reports nothing.
- [ ] 3.4 Extend the vocabulary and comparison tests for both directions.
- [ ] 3.5 Add the case sentence to the variable-naming prose for the
      case-sensitive machines in the reference facts.

## 4. Machines report the case they show

- [ ] 4.1 Fix the Commodore screen reader (`src/emulator/cbmScreenText.ts`) to
      answer the text set's letters directly rather than through the graphics-set
      table, and record why that table cannot serve them.
- [ ] 4.2 Add `src/emulator/cbmScreenText.test.ts` (none exists): both sets for
      the letter ranges, the graphic that a text-set code draws in the other set,
      row width and padding, and the regression by name — no text-set letter code
      reads back as a space.
- [ ] 4.3 Give the TRS-80 one shared screen-character helper used by both its
      display and its screen read, so the two cannot drift, and fold in both.
- [ ] 4.4 Correct the TRS-80 charset comment: the stored byte is preserved for
      round-trip exactness, and the stock Model I displays it upper-cased. Drop
      the Model III justification.
- [ ] 4.5 Split the TRS-80 glyph provenance so the character-generator chip no
      longer claims codes the stock machine cannot address; check the datasheet
      before writing the note (see the design's open question).
- [ ] 4.6 Add a TRS-80 test that the display and the screen read agree on a
      program that prints lower case.
- [ ] 4.7 Add lower-case anchors to `src/dialects/glyphSources.test.ts` beside the
      existing ones — every current anchor is the letter `A` — plus the negative
      case for machines declared to have no lower case. Excuse the Commodores by
      name with the reason if 6.2 is cut.

## 5. Input parity

- [ ] 5.1 Add the case-lock key flag and the layout-level power-on case to
      `src/keyboard/layoutSchema.ts`, with the reasoning for why a case lock is
      not a modifier written where the flag is declared.
- [ ] 5.2 Add the case latch to `src/keyboard/inputEngine.ts`: flipped by a
      case-lock press, which still taps the machine's own key; reset when the
      keyboard is rebuilt; exposed for the renderer.
- [ ] 5.3 Add the case transform for the editor target in
      `src/keyboard/editorActions.ts` and the shared letter-flip helper in
      `src/keyboard/legendKit.ts`, composed at the virtual keyboard's call site,
      leaving the action lookup a pure data function.
- [ ] 5.4 Make the keycap renderer show the case the latch will type.
- [ ] 5.5 Add `src/dialects/caseKeys.test.ts` on the existing booted symbol-key
      pattern, for the machines with something to prove (ZX Spectrum, BBC Micro,
      CPC 464, C64, PMD 85): press the letter key and its case partner or the
      latch, and read the echoed character back. Depends on 4.1.
- [ ] 5.6 Author the layout edits **from what 5.5 reports**: the BBC pair's
      shift-layer lower case and caps keycap; the CPC pair's lower-case base
      legends, upper-case shift layer and caps keycap; the Spectrum's caps
      keycap; the Commodore machines' case keycap (their shifted letters are
      graphics, so no shift pair).
- [ ] 5.7 Extend `src/keyboard/layoutGeometry.test.ts`: a machine with lower-case
      glyphs must offer both cases by a shift pair or a case-lock key, and a
      machine without must offer neither.

## 6. Sample and coverage sweep

- [ ] 6.1 Run the cross-dialect sample conventions test and every dialect's own
      sample tests; fix any bundled sample the new diagnostic newly flags, and
      add "no bundled sample raises a lower-case-keyword diagnostic" to the
      cross-dialect sample test.
- [ ] 6.2 Optional (first on the cut line): declare the Commodore second
      character-ROM bank as a glyph source so the switchable declaration is
      provable, and add its lower-case anchors.

## 7. The fold advisory

- [ ] 7.1 Add a derived per-program figure counting the characters the target
      machine would store as something else, computed beside the existing
      program statistics rather than added to any error list. Reuse the charset
      probe's unit walk so notation is skipped, and the same catch-and-continue
      posture the vocabulary walk uses.
- [ ] 7.2 Add its colocated test: a folding machine with lower case counts them;
      a machine that stores every character as written counts none; an escape,
      a raw byte and a short keyword spelling count none; an alias substitution
      (backtick on the BBC, caret on the CPC) counts.
- [ ] 7.3 Show it in `src/components/StatusBar.tsx`, naming the conversion rather
      than only counting it, styled with the existing warn severity idiom the
      RAM readout uses. Do not disturb the existing items or their order — the
      e2e helpers read the bar by text.
- [ ] 7.4 Confirm it blocks nothing: Run, export, share and the share
      compatibility filter are all unchanged. Add a test asserting a program
      with a non-zero count still runs.

## 8. Strict characters mode

- [ ] 8.1 Add the `strictCharacters` boolean end to end following the
      `runGateLint` precedent: key and accessors in `src/storage/settings.ts`
      (default **off**), store field with a doc comment, initial value behind the
      SSR guard, setter that persists then sets.
- [ ] 8.2 Add the checkbox to the Editor tab of `src/components/SettingsForm.tsx`
      under its own heading, with the explanation carried on the label's `title`
      as the neighbouring toggles do.
- [ ] 8.3 Thread strictness into the encode path as an explicit parameter — not
      read from the store inside a pure function — so that with it on, a
      character the machine would store as a different one raises the charset's
      existing "no such character" error at its own position instead of folding.
      Set `endColumn` so the squiggle covers the character rather than the rest
      of the line.
- [ ] 8.4 Exempt notation structurally by walking units through the charset
      probe: a unit longer than one character is notation and is never reported.
      Add tests for the raw-byte escape, a Commodore control escape, a Spectrum
      user-defined-graphic escape and a Commodore shifted-letter abbreviation.
- [ ] 8.5 Implement the Commodore set-switch allowance in source order: lower
      case is not reported after the program switches to the lower-case set, and
      is reported again after it switches back. Record at the implementation
      that control flow is not traced and a direct poke to the video chip is not
      recognised, and that the allowance fails safe by reporting less. Add tests
      for both directions.
- [ ] 8.6 Add the force-uppercase transaction filter in
      `src/components/CodeMirrorHost.tsx`, held in a compartment so the setting
      can change without rebuilding the editor. Gate it on user input, skip
      notation spans and the graphics palette's inserts. Test all four write
      paths — typed input, the on-screen keyboard, native paste and menu paste.
- [ ] 8.7 Hide the shift keycap at the render seam where rows are handed to the
      renderer, substituting a spacer of the same width so the row arithmetic and
      every geometry test still hold. Key it on the modifier a key **is**, never
      on how it is styled — at least one machine's control key is styled as a
      shift and is the only way to break a running program. Keep the keycap
      visible whenever a symbol mode is pinned, so the page toggle survives.
- [ ] 8.8 Add the reachability test nothing covers today: for every machine with
      a second symbol page, the page toggle sits on a key the renderer draws
      under this setting. Add a test that the control key survives on the
      machines that style it as a shift.
- [ ] 8.9 Check the bundled samples and each dialect's assistant guidance under
      the setting: report which samples strict mode would reject, and fix or
      excuse each by name.

## 9. Docs

- [ ] 9.1 Correct `docs/reference/file-formats.md`, which states that lower-case
      input is folded to upper case — false for several machines.
- [ ] 9.2 Correct `docs/guide/writing-basic.md`, which names only the BBC
      machines as distinguishing case.
- [ ] 9.3 Add the case rule to `docs/reference/bbc.md`, which says nothing about
      case on the machine family where it decides variable identity.

## 10. Quality gates

- [ ] 10.1 `npm run typecheck`
- [ ] 10.2 `npm test`
- [ ] 10.3 `npm run lint`
- [ ] 10.4 `npm run format:check` (or `npm run format`)
- [ ] 10.5 `npm run docs:build` — docs change in group 9
- [ ] 10.6 Add two staged assertions to the existing `e2e/virtual-input` touch
      journey on bbcmicro only: shift plus a letter inserts lower case, and the
      keycap redraws in the other case when the lock is pressed. Then, with
      Strict characters on for an uppercase-only machine, the shift keycap is
      absent and the row is not reflowed. The redraws are the browser-only
      facts; the per-machine matrix stays in Vitest.
- [ ] 10.7 `npm run e2e:chromium -- e2e/virtual-input`
- [ ] 10.8 `npm run e2e:chromium -- e2e/code-editor`
- [ ] 10.9 `npm run e2e:chromium -- e2e/program-execution`
- [ ] 10.10 `npx openspec validate --specs`
