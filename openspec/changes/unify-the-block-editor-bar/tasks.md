## 1. The shared bar

- [ ] 1.1 A small pure helper for how a block's extent reads: an address and a
      byte count in, the range string out — first address to last, `formatWord`
      for both (`src/asm/format.ts`), and the address alone when the block
      holds no bytes. Keep it beside the other block-level pure helpers rather
      than inside a component, so its edge cases are unit-testable.
- [ ] 1.2 New shared bar component and its CSS module. It renders the block's
      extent, byte count, entry point and comment, takes a slot for the
      surface's own controls, and hosts the refusal alert. Styling settles on
      the byte editor's current strip (13px, wrapping, matching the tab strip
      above it); the comment is the element that ellipsises. Nothing in it
      names the block.
- [ ] 1.3 Adopt it in `src/components/AsmEditor.tsx` and
      `src/components/ByteEditor.tsx`, deleting both hand-rolled strips and the
      two `.statusStrip` rules that disagreed. Leave
      `src/components/UnsupportedBlockNotice.tsx` alone — it is a paragraph,
      not a bar, and it should still name the block.
- [ ] 1.4 Move the Hex/Text choice into the bar's control slot and remove its
      own row. It keeps its tab-list semantics, its accessible name and its two
      icons; it is pinned to the end of the bar and does not shrink, so a
      narrow bar wraps the comment rather than the toggle. It still appears
      only where both views cannot be shown.
- [ ] 1.5 The read-only mark: a short abbreviation at the very end of a saved
      data file's bar, in the error colour, carrying the full phrase for hover
      and for anything reading the page aloud. It replaces the sentence in the
      bar and is present for as long as the tab is.
- [ ] 1.6 Drop the read-only branch's flashed refusal in the byte editor's
      outcome handler — an edit to a file now simply does nothing. **Leave the
      refusal channel and its test id in place**: the charset refusal and the
      Sinclair listing refusal still use it and are still specced as visible.

## 2. Size moves into the block's settings

- [ ] 2.1 Add size to the block settings draft, its seeding from a block, its
      validation and its application (`src/app/blockEdit.ts`). Validation
      rejects anything that is not a whole number of bytes and anything past
      what the machine can hold at the block's address; where a move and a
      resize are saved together, clamp against the **new** address.
- [ ] 2.2 Apply it through the existing pure `setLength`
      (`src/app/byteEdit.ts`) rather than re-deriving pad/truncate/clamp. Check
      the interaction with a move: `applyBlockSettings` re-assembles a code
      block when its address changes, so establish the order (move, then size)
      and that a re-assembled block's own length wins.
- [ ] 2.3 Render it in `src/components/BlockSettingsDialog.tsx` in place of the
      read-only "N bytes of assembly|binary" summary line, beside the load
      address. Read-only for an assembly-backed block, and for a listing block
      whatever its address rule already dictates. Carry the ceiling in a note,
      in the same words the fill row's hint uses.
- [ ] 2.4 Remove the length draft state, its commit handler and its input from
      `src/components/ByteEditor.tsx`, along with the "whole number of bytes"
      refusal, which is now the dialog's to report.
- [ ] 2.5 Establish what a size change applied through the store does to the
      byte editor's per-buffer undo history (the block comes back changed and
      the document reseeds). If the history is lost, say so at the field rather
      than leaving the user to find out by pressing undo, and record the answer
      in the design's open questions.

## 3. Tests

- [ ] 3.1 Unit tests for the extent helper: zero bytes (address alone), one
      byte (a range of one), a block ending at `$FFFF`, and the ordinary case.
- [ ] 3.2 Extend `src/app/blockEdit.test.ts` for the size field: a valid size,
      a non-numeric one, one past the machine's ceiling at that address, a
      move and a resize saved together (clamped against the new address), an
      unchanged assembly-backed block, and that growing pads with zero while
      shrinking discards from the end.
- [ ] 3.3 No component tests — this repo tests pure modules plus Playwright,
      and the bar is presentation over values the pure helpers already return.

## 4. The e2e specs the bar's text is asserted through

- [ ] 4.1 `e2e/memory-blocks/asm-editor.spec.ts` and
      `e2e/memory-blocks/block-tabs.spec.ts` match the literal `ORG $8000` /
      `ORG $9000` as their evidence that a block editor is on screen; move
      those to the address range. Enumerate the occurrences from the tree
      rather than trusting a list.
- [ ] 4.2 Every use of the byte-count field's test id
      (`e2e/memory-blocks/asm-editor.spec.ts`,
      `e2e/memory-blocks/block-tabs.spec.ts`,
      `e2e/memory-blocks/zx81-listing-blocks.spec.ts`) becomes either the bar's
      static count or the settings field, depending on what that step was
      proving. Where a spec used the field only to read the current length,
      read the bar instead — that is the cheaper assertion.
- [ ] 4.3 `e2e/persistence/saved-data-tabs.spec.ts`: the byte-count assertion
      should survive untouched — confirm rather than assume — and the
      refusal-on-keystroke assertion becomes its opposite: the bytes are
      unchanged and the bar marks the file read-only throughout.
- [ ] 4.4 Extend the existing journeys in those files; do not add a new cold
      page load for any of this.

## 5. Documentation

- [ ] 5.1 `docs/guide/machine-code.md`: the bullet directing the reader to the
      byte count "in the strip above the block", and the sentence after it
      claiming nothing asks for confirmation — a size set in settings does.
      Keep the two in-editor gestures (type past the end, backspace the last
      byte) described exactly as they are, because they are unchanged.
- [ ] 5.2 `docs/guide/machine-code.md`: the **Settings** bullet in the tab-menu
      list now sets the block's size as well as its name, address, kind, entry
      and comment.
- [ ] 5.3 `docs/guide/testing-programs.md`: "The bytes are shown read-only" now
      has a visible mark to name. Guide conventions: no source paths, no
      internal symbols.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 6.2 `npm run docs:build` (docs/ changed in group 5).
- [ ] 6.3 `npm run e2e:chromium -- e2e/memory-blocks` and
      `npm run e2e:chromium -- e2e/persistence` — the second for the saved data
      file's read-only bar. Only check off when both pass; a failure leaves
      this unchecked with a note on what failed.
- [ ] 6.4 Phone-portrait viewport, through a throwaway Chromium spec rather
      than by hand: between the tab strip and the first row of bytes there is
      exactly one bar; it carries the Hex/Text choice; and with a long comment
      on the block the toggle is still on that one row.
