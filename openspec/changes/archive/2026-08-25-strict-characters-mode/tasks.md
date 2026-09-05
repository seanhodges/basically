## 1. The setting

- [x] 1.1 Add the `strictCharacters` boolean end to end, following the
      `runGateLint` precedent: key and accessors in `src/storage/settings.ts`
      (default **off**), a store field with a doc comment, an initial value
      behind the SSR guard, and a setter that persists then sets.
- [x] 1.2 Add the checkbox to the Editor tab of `src/components/SettingsForm.tsx`
      under its own heading, with the explanation carried on the label's `title`
      as the neighbouring toggles do.

## 2. Escalate the detection to errors

- [x] 2.1 Confirm the base change's detection reports each finding's position
      (its task 7.1 requires it). If it does not, extend it there rather than
      re-walking the source here.
- [x] 2.2 Add the diagnostic source that turns each detected character into an
      error at its own position, with `endColumn` set so the squiggle covers the
      character rather than running to end of line. Thread the setting in as an
      explicit parameter, not read from the store inside a pure function.
- [x] 2.3 Add colocated tests: with the setting on, a lower-case letter on an
      uppercase-only machine is an error at its column; with it off there is no
      error and the count is unchanged; the set of errors equals the set the
      detection counts, on a program mixing text, notation and a Commodore set
      switch.
- [x] 2.4 Add a test that with the setting on the program is refused by Run and
      by sharing, and still exports — export gates on fatal errors only.

## 3. Force upper case as the user types

- [x] 3.1 Add the transaction filter in `src/components/CodeMirrorHost.tsx`, held
      in a compartment so the setting can change without rebuilding the editor.
      Gate it on user input, and apply it only when the setting is on and the
      target machine has no lower case.
- [x] 3.2 Exempt what the reader did not type as letters: the graphics palette's
      inserts and the inside of notation, using the same rule the detection's
      unit walk uses.
- [x] 3.3 Test all four write paths — typed input, the on-screen keyboard, native
      paste and menu paste — plus the two exemptions, and that a machine with
      lower case is unaffected.

## 4. Drop the case affordance on the keyboard

- [x] 4.1 Hide the shift keycap at the render seam where rows are handed to the
      renderer, substituting a spacer of the same width so row arithmetic and
      every geometry test still hold. Key it on the modifier a key **is**, never
      on how it is styled — at least one machine's control key is styled as a
      shift and is the only way to interrupt a running program.
- [x] 4.2 Keep the keycap visible whenever a symbol mode is pinned, so the page
      toggle survives.
- [x] 4.3 Add the reachability test nothing covers today: for every machine with
      a further symbol page, the page toggle sits on a key the renderer actually
      draws under this setting. Add a test that the control key survives on the
      machines that style it as a shift.
- [x] 4.4 Add a test that a machine with lower case has an unchanged keyboard
      under the setting.

## 5. Sweep what the setting refuses

- [x] 5.1 Run the bundled samples for every machine under the setting and report
      which are refused; fix or excuse each by name, and record the decision.
      **One refused, now fixed:** the C64 `breakout` took its paddle keys as
      `K$="A" OR K$="a"`, reaching for the shifted key. PETSCII has one code per
      letter pair, so both literals were the same byte and the second clause
      never did anything; it is gone rather than excused. Nothing else on any
      machine is refused, and `sampleConventions.test.ts` now holds that.
- [x] 5.2 Check each dialect's assistant guidance says enough that the assistant
      does not write code the setting would refuse on an uppercase-only machine.
      The Sinclairs and the Apple I already say "uppercase only" / "no lower
      case anywhere". The three Commodores said only that the *default character
      set* is upper-case/graphics, which describes the display rather than what
      to write, and the PET said nothing; each now carries the encoding fact.

## 6. Docs

- [x] 6.1 Document the setting where the other editor settings are described,
      saying what it refuses and that it is off by default.

## 7. Quality gates

- [x] 7.1 `npm run typecheck`
- [x] 7.2 `npm test`
- [x] 7.3 `npm run lint`
- [x] 7.4 `npm run format:check` (or `npm run format`)
- [x] 7.5 `npm run docs:build` — docs change in group 6
- [x] 7.6 Add one staged assertion to the existing `e2e/virtual-input` touch
      journey: with the setting on for an uppercase-only machine, the shift
      keycap is absent and the row is not reflowed. That the keycap is really
      gone from a rendered, laid-out keyboard is the browser-only fact; the
      per-machine matrix stays in Vitest.
- [x] 7.7 `npm run e2e:chromium -- e2e/virtual-input`
- [x] 7.8 `npm run e2e:chromium -- e2e/code-editor`
- [x] 7.9 `npx openspec validate --specs`
