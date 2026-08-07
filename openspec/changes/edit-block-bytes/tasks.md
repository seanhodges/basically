## 1. The editing model, before any UI

- [ ] 1.1 New pure module for byte editing — apply a hex nibble (high then low,
      auto-advancing to the next byte), apply a typed character through the
      dialect's `CharsetMapping.toMachine`, resize (grow pads with a fill byte,
      shrink truncates), and fill a range. No React, no DOM. Follow the shape of
      `src/app/blockEdit.ts`, which is the same idea for block metadata.
- [ ] 1.2 A pure helper for the grid's row windowing and column count (16 / 8 / 4
      by available width), separate from the component.
- [ ] 1.3 Colocated tests for both: nibble sequencing and auto-advance, clamping
      at block bounds, charset round-trip including a character the machine
      cannot represent, resize and fill edge cases (zero-length, grow past the
      end, shrink to nothing), and the column-count breakpoints.

## 2. The hex surface

- [ ] 2.1 New hex editor component: address gutter, hex cells, character column
      via `CharsetMapping.glyph` (total over `0x00`–`0xFF`, so every byte
      renders). Read the block from the store, write through `upsertBlock` with a
      fresh array — never mutate the existing `Uint8Array`, or Zustand's identity
      checks will miss the change.
- [ ] 2.2 Caret and selection: click or tap to place, arrow keys, Home/End,
      PageUp/PageDown. The caret addresses a byte; both columns show where it is.
- [ ] 2.3 Keyboard editing in both columns — hex digits in the hex column,
      characters in the character column, with a visible refusal when the charset
      has no code for what was typed.
- [ ] 2.4 Bounded per-block undo/redo in component state, cleared when the active
      block changes. Not the global store — CodeMirror owns BASIC undo.
- [ ] 2.5 Touch: tapping a cell focuses a hidden input and shows an on-screen
      hex keypad below the grid on touch devices. Hit targets ≥ 32 px.

## 3. Wire it in

- [ ] 3.1 `src/components/Workspace.tsx` — route a data block, and a code block
      whose CPU has no engine from `asmEngineFor`, to the hex editor instead of
      `UnsupportedBlockNotice`. Check whether any case is left that reaches
      neither surface; if none is, remove `UnsupportedBlockNotice` and its
      stylesheet rather than leaving dead UI behind.
- [ ] 3.2 Resize and fill as explicit actions in the block's surface, with the
      shrink confirmation. Reuse the store-driven confirm pattern that
      `DeleteBlockDialog` already uses rather than inventing a second one.
- [ ] 3.3 `src/components/EditorTabBar.tsx` — a "Load bytes…" entry in the block
      tab context menu, beside the existing `.bin` / `.asm` downloads. It replaces
      the block's contents; the block keeps its own address, name and kind.

## 4. Tests

- [ ] 4.1 The unit tests from group 1 are the bulk of the coverage — the editing
      rules, the charset behaviour and the windowing are all logic, and per
      CLAUDE.md they belong in colocated `*.test.ts`, not in a browser.
- [ ] 4.2 One e2e scenario in `e2e/memory-blocks/`, extending an existing journey
      rather than a new cold `page.goto('/')`: create a block, switch it to data,
      edit a byte, switch tabs and back, reload — the byte persists. This pays
      rent because it proves the store round trip and focus handling through a
      real browser; nothing else in the group needs one.
- [ ] 4.3 Do **not** add a per-machine e2e matrix for the hex editor. It is
      dialect-generic apart from the charset, and the charset behaviour is a unit
      test.

## 5. Documentation

- [ ] 5.1 `docs/guide/machine-code.md` — the sentence "a **data** block is a
      plain run of bytes with no assembly view" becomes the hex editor's
      description. Cover editing bytes, the character column, resize and loading
      from a file. Guide conventions: no `src/` paths, no internal symbols.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 6.2 `npm run docs:build` (docs/ changed in group 5).
- [ ] 6.3 `npm run e2e:chromium -- e2e/memory-blocks` and
      `npm run e2e:chromium -- e2e/code-editor` — the second because the block
      surface shares the editor pane. Only check off when both pass; a failure
      leaves this unchecked with a note on what failed.
- [ ] 6.4 Manual, phone-portrait viewport: the grid drops to its narrow column
      count, the keypad is reachable, and a byte can actually be typed. This is
      the interaction the design flags as unproven — expect to iterate.
