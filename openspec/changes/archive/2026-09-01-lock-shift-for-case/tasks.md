## 1. The case lock moves onto the modifier

- [x] 1.1 Layout schema: a modifier can declare the machine's case lock - the
      tokens that latch the other case, and the tokens that latch it back where
      the machine's route back differs. Remove the per-key case-lock flag, which
      has no user once the keycaps go.
- [x] 1.2 Input engine: the shift's second tap releases the modifier's own cell,
      taps the lock, and flips the case latch; a further tap taps the release
      route and flips it back. A latched lock pins no layer and survives a
      global release, because it holds nothing down.
- [x] 1.3 The lock is a pulse the engine times, held long enough for a ROM
      keyboard scan to see it - the same hold the case-key probes use - and
      ending where it begins on the editor target, which counts no frames.
- [x] 1.4 Engine tests: one tap shifts and does not move the case; the second
      latches, releases the shift cell and presses the machine's key; the third
      presses the release route; a key pressed under the lock leaves it alone; a
      global release keeps it; a modifier without a case lock locks as before.

## 2. The five case keycaps go

- [x] 2.1 BBC, CPC 464, Atari 800, ZX Spectrum and Commodore 64: drop the case
      keycap, declare the lock on the shift modifier with the tokens
      `src/dialects/caseKeys.test.ts` proves on the booted ROMs, and move the
      keycap's reasoning onto the modifier. The derived layouts (BBC Master,
      Atari 400, CPC 664/6128, Spectrum 128, VIC-20) follow from their bases.
- [x] 2.2 The cross-dialect geometry test reads the case lock off the modifiers,
      and pins that a modifier carrying one is sticky and lockable, so every
      registered machine's "both cases reachable" claim still holds.
- [x] 2.3 The Atari layout's matrix-coverage test counts the tokens a case lock
      presses - `CAPS` is on that machine's matrix by no other route now.

## 3. A word legend takes one fixed size

- [x] 3.1 A shared helper says whether a legend is a word rather than a
      character, and the keycap renderer marks those legends in every display.
- [x] 3.2 The stylesheet gives a marked legend the fixed size the wide keys
      already used, in the layered display, the single-legend display and the
      shallow-landscape sizes.
- [x] 3.3 A word no longer sets the single-legend display's shared size, so one
      machine key cannot shrink every letter on the board.
- [x] 3.4 Tests: the helper's own cases, and the stylesheet-text guard that the
      class the renderer emits has a rule behind it.

## 4. The keyboard journey

- [x] 4.1 The virtual-input e2e journey locks the case by double-tapping the
      shift on the BBC, asserts the laid-out keycaps repaint in the other case
      and type it, that a further tap comes back, and that no case keycap
      exists.

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npm run e2e:chromium -- e2e/virtual-input`
