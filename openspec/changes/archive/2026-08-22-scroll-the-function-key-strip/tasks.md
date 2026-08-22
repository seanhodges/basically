## 1. The strip is one row of keycaps

- [x] 1.1 Size the strip's grid from the key rows' own tracks so a function key
      is a keycap, and let it scroll past a board's worth instead of wrapping.
      Centre a short strip by grid alignment, falling back to the start edge on
      overflow.
- [x] 1.2 Give the strip the key rows' box — width, wide-screen cap, centring —
      so the width it divides is the width the rows divide.
- [x] 1.3 Absorb the keys' touch bleed so a strip whose keys all fit shows no
      scrollbar.
- [x] 1.4 Drop the wrapping helper and the strip's line-count reserve; the
      renderer no longer pads the strip with filler keys.
- [x] 1.5 Leave the landscape gutter strip as it is.

## 2. Dragging the strip scrolls it

- [x] 2.1 Skip the slide hit-test for pointers that go down on the strip, so a
      drag does not press its way across the row. Keep pointer capture, so a
      mouse leaving the keyboard still delivers its release.
- [x] 2.2 Opt the row back in to panning and keep a pan at its left edge from
      being read as a back-navigation swipe.
- [x] 2.3 Bring a function key reached by keyboard arrows into view — roving
      focus is a class rather than DOM focus, so the browser will not.

## 3. Show that there are more

- [x] 3.1 Fade the row's right edge on a machine whose function keys run past
      the board, decided from the layout's data rather than from measurement.

## 4. Tests and documentation

- [x] 4.1 Update the registry-wide keyboard geometry test: a function key is
      `KEY_SPAN`, and the wrapping assertions go.
- [x] 4.2 Update the PMD 85 and Altair keyboard tests to the one-row rule.
- [x] 4.3 New e2e in `e2e/virtual-input/`: on the machine with more function
      keys than fit, the strip is one row, its keys are the width of the letter
      keys, and the last key is reachable by scrolling. Browser-only — the key
      widths are real layout, which a unit test cannot see.
- [x] 4.4 Update `docs/contributing/adding-a-dialect.md` and the
      `adding-a-target-system` skill with the convention: one row, keycap-sized,
      scrolls past a board's worth, design for ten, no enforced ceiling.

## 5. Quality gates

- [x] 5.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 5.2 `npm run docs:build` (docs/ changed)
- [x] 5.3 `npm run e2e:chromium -- e2e/virtual-input` and
      `npm run e2e:chromium -- e2e/shell`
