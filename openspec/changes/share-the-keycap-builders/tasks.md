## 1. The legend kit

- [ ] 1.1 Add `src/keyboard/legendKit.ts`: `Legend`/`Legends` types and the
      `lbl` / `act` / `word` / `ins` / `cursorKey` / `key(token, legends)`
      builders, generic over `readonly Legend[]` layers
- [ ] 1.2 Colocated `legendKit.test.ts` for builder semantics (label
      shaping, editor actions, `emits` passthrough, layer counts 3–5)

## 2. Migrate the verbatim six

- [ ] 2.1 atom, bbcmicro, cpc464, zx80, zx81, zxspectrum
      `keyboardLayout.ts` onto the kit; their colocated tests and
      `layoutGeometry.test.ts` / `cursorKeys.test.ts` unchanged and green

## 3. Migrate the hand-rolled six

- [ ] 3.1 pet and commodore64 (screen-code legends → kit or thin local
      adapter over the kit's types)
- [ ] 3.2 trs80 (Shift/Cursor types → kit)
- [ ] 3.3 pmd85 and altair8800
- [ ] 3.4 Confirm the zx-family cursor deviations (shifted-digit emits)
      survive as data, not builder forks

## 4. Quality gates

- [ ] 4.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 4.2 `npm run e2e:chromium -- e2e/virtual-input` (rendered keyboards
      are app-visible)
