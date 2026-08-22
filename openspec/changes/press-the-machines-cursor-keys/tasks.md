## 1. A legend can press its own machine keys

- [x] 1.1 Add an optional `emits` to `KeyLabel`, and a resolver beside the
      editor-action one that returns the active layer's legend tokens or the
      key's own.
- [x] 1.2 Let the input engine be told which layer a mode has pinned, and
      resolve a press's tokens against it. Record the resolved tokens with the
      press so the release replays them.
- [x] 1.3 Set the pinned layer from the keyboard when the mode changes, and drop
      the note that a mode is cosmetic for the machine target.

## 2. The machines that already show a CURSOR tab

- [x] 2.1 BBC Micro (shared with the Master), Acorn Atom, Amstrad CPC 464
      (shared with the 6128) and TRS-80: give the four arrow legends the
      machine's own cursor tokens.
- [x] 2.2 Checked the Atom's arrow mapping on the booted ROM: all four cursor
      keys move its cursor, so the cells it names are right even though its up
      arrow takes a different one from jsbeeb's own host map.

## 3. The machines that had no cursor keys at all

- [x] 3.1 Commodore 64 (shared with the VIC-20) and PET: add the CURSOR mode and
      its four arrow legends.
- [x] 3.2 ZX80, ZX81, ZX Spectrum and Spectrum 128: add the CURSOR mode, whose
      legends emit the machine's shift chord.
- [x] 3.3 PMD 85: add the CURSOR mode with the three cursor keys its keyboard
      has. The Monitor's key-code table at 0x82D0 gives the cell below `|<-` no
      code in either shift state and the two beside it both return 0x0d (the
      wide ENTER), so there is no fourth; recorded in the matrix.
- [x] 3.4 Leave the Altair 8800 without cursor keys.

## 4. A delete key that says what it is

- [x] 4.1 Add a forward-delete editor action and apply it in the editor host.
- [x] 4.2 Label the PMD 85's delete key as the delete key it presses, and
      rewrite the comment that apologised for the borrowed legend.

## 5. Tests and documentation

- [x] 5.1 Engine tests: a pinned layer changes which tokens a key presses, a
      release frees the tokens actually pressed, and a chord sharing a token
      with an engaged modifier refcounts correctly.
- [x] 5.2 Resolver tests: legend tokens win over the key's, absent legend tokens
      fall back, and the new editor action repeats.
- [x] 5.3 Registry-wide: every dialect either offers its cursor keys or is one
      of the documented machines with none, so a new dialect cannot quietly ship
      without them.
- [x] 5.4 Per-dialect: every cursor legend's tokens are real matrix cells, and -
      one machine per emulator wiring family - the cursor really moves on the
      booted ROM. Keep the CPC's matrix-coverage assertion honest.
- [x] 5.5 PMD 85: the delete key is labelled and acts as a delete-at-cursor on
      both surfaces; the TRS-80's editing key still backspaces, so the asymmetry
      is not "fixed" later.
- [x] 5.6 Extend the existing on-screen keyboard journey in
      `e2e/virtual-input/` rather than adding a cold spec. The PMD 85's strip
      now opens on its mode tabs, so the function-key spec reaches them through
      the toggle, and its keys are a keycap less the toggle's share of the row -
      the trade every machine with both already made.
- [x] 5.7 Update `docs/guide/testing-programs.md`, and correct the ZX81 and
      Spectrum layout notes that claim arrow legends they still ship were
      dropped.

## 6. Quality gates

- [x] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 6.2 `npm run docs:build` (docs/ changed)
- [x] 6.3 `npm run e2e:chromium -- e2e/virtual-input` and
      `npm run e2e:chromium -- e2e/code-editor`
