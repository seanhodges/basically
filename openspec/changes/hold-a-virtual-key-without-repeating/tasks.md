## 1. A press can be given a ceiling

- [x] 1.1 Add a `maxHoldFrames` layout option beside `minHoldFrames`, described
      as what it is: the most emulated frames one virtual press drives the
      matrix, so a resting finger does not reach the machine's own auto-repeat.
- [x] 1.2 Release an expired press in the keyboard input engine's per-frame
      tick, through the same path a lift takes, so the minimum hold and any
      sticky modifier it consumed are honoured. Leave function keys and
      modifiers held.
- [x] 1.3 Cover it in `src/keyboard/inputEngine.test.ts`: a press past the
      ceiling releases once and does not re-press, a lift after it is a no-op, a
      function key and a held modifier stay down, and a layout with no ceiling
      is unchanged. A spent press also survives the hit-test that reports its
      own key on every pointer move.

## 2. The PMD 85 asks for one

- [x] 2.1 Give `pmd85KeyboardLayout` a `maxHoldFrames`, with the ROM's measured
      repeat delay as the reason.
- [x] 2.2 Pin it against the ROM in `src/dialects/pmd85/keyboardLayout.test.ts`:
      boot the Monitor, hold a key, and check the ceiling lands clear of the
      frame the second character arrives on — and that a press held to the
      ceiling still types exactly one character.

## 3. Quality gates

- [x] 3.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 3.2 `npm run e2e:chromium -- e2e/virtual-input`
