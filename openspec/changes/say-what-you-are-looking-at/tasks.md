## 1. The tab's kind marks

- [ ] 1.1 Five icons in the shared icon set (`src/components/icons.tsx`), under
      the convention that file already enforces — one frozen props object, a
      24×24 viewBox drawn at 16×16, no fill, `currentColor` stroke, `aria-hidden`
      baked in, no props taken. What each draws: a numbered listing for the
      program, a pencil for a scratch buffer, rows of opcode and operand for an
      assembly block, a grid of cells for a block of bytes, a folded page for a
      saved data file. **None of them may repeat a meaning the set has already
      given away** — not the gear (Open settings), the memory chip (Show the
      memory map), the `</>` (Editor pane), the floppy (File menu), or the hash
      and stacked rules (the byte editor's two views).
- [ ] 1.2 One mapping from a tab's kind to its icon in
      `src/components/EditorTabBar.tsx`, replacing **both** copies of each glyph
      literal — the one in the strip's JSX and the one in the flat tab model the
      overflow menu renders from. The model's `glyph` field carries an icon
      rather than a string. Follow the shape `src/components/MobileTabBar.tsx`
      already uses: a table of kind, label and icon, rendered as an icon beside
      a name.
- [ ] 1.3 The program's tab gains its icon, and with it the name span every
      other tab has and it alone lacks — today it renders a bare text child,
      which is why it is the one tab the overflow menu could not mark.
- [ ] 1.4 The three items in the tab-creation menu each lead with the icon of
      the tab they create. Its buttons already lay out as icon-plus-label with
      the right gap — that rule was written for a glyph that never arrived — so
      this needs no new CSS.
- [ ] 1.5 The kind mark's own rule sets only opacity and font size today; an
      inline SVG needs the layout that keeps it on the text's baseline rather
      than sitting proud of it.
- [ ] 1.6 Look at the five together, at the size the strip gives them, in one
      strip. The program's numbered listing and the assembly block's opcode
      rows are the pair at risk of reading alike; if they do, redraw the opcode
      rows. Do not weaken the exclusion rule in 1.1 to solve it.

## 2. The shared bar

- [ ] 2.1 A small pure helper for how a block's extent reads: an address and a
      byte count in, the range string out — first address to last, `formatWord`
      for both (`src/asm/format.ts`), and the address alone when the block
      holds no bytes. Keep it beside the other block-level pure helpers rather
      than inside a component, so its edge cases are unit-testable.
- [ ] 2.2 New shared bar component and its CSS module. It renders the block's
      extent, byte count, entry point and comment, takes a slot for the
      surface's own controls, and hosts the refusal alert. Styling settles on
      the byte editor's current strip (13px, wrapping, matching the tab strip
      above it); the comment is the element that ellipsises. Nothing in it
      names the block.
- [ ] 2.3 Adopt it in `src/components/AsmEditor.tsx` and
      `src/components/ByteEditor.tsx`, deleting both hand-rolled strips and the
      two `.statusStrip` rules that disagreed. Leave
      `src/components/UnsupportedBlockNotice.tsx` alone — it is a paragraph,
      not a bar, and it should still name the block.
- [ ] 2.4 Move the Hex/Text choice into the bar's control slot and remove its
      own row. It keeps its tab-list semantics, its accessible name and its two
      icons; it is pinned to the end of the bar and does not shrink, so a
      narrow bar wraps the comment rather than the toggle. It still appears
      only where both views cannot be shown.
- [ ] 2.5 The read-only mark: a short abbreviation at the very end of a saved
      data file's bar, in the error colour, carrying the full phrase for hover
      and for anything reading the page aloud. It replaces the sentence in the
      bar and is present for as long as the tab is.
- [ ] 2.6 Drop the read-only branch's flashed refusal in the byte editor's
      outcome handler — an edit to a file now simply does nothing. **Leave the
      refusal channel and its test id in place**: the charset refusal and the
      Sinclair listing refusal still use it and are still specced as visible.

## 3. Size moves into the block's settings

- [ ] 3.1 Add size to the block settings draft, its seeding from a block, its
      validation and its application (`src/app/blockEdit.ts`). Validation
      rejects anything that is not a whole number of bytes and anything past
      what the machine can hold at the block's address; where a move and a
      resize are saved together, clamp against the **new** address.
- [ ] 3.2 Apply it through the existing pure `setLength`
      (`src/app/byteEdit.ts`) rather than re-deriving pad/truncate/clamp. Check
      the interaction with a move: `applyBlockSettings` re-assembles a code
      block when its address changes, so establish the order (move, then size)
      and that a re-assembled block's own length wins.
- [ ] 3.3 Render it in `src/components/BlockSettingsDialog.tsx` in place of the
      read-only "N bytes of assembly|binary" summary line, beside the load
      address. Read-only for an assembly-backed block, and for a listing block
      whatever its address rule already dictates. Carry the ceiling in a note,
      in the same words the fill row's hint uses.
- [ ] 3.4 Remove the length draft state, its commit handler and its input from
      `src/components/ByteEditor.tsx`, along with the "whole number of bytes"
      refusal, which is now the dialog's to report.
- [ ] 3.5 Establish what a size change applied through the store does to the
      byte editor's per-buffer undo history (the block comes back changed and
      the document reseeds). If the history is lost, say so at the field rather
      than leaving the user to find out by pressing undo, and record the answer
      in the design's open questions.

## 4. Tests

- [ ] 4.1 Unit tests for the extent helper: zero bytes (address alone), one
      byte (a range of one), a block ending at `$FFFF`, and the ordinary case.
- [ ] 4.2 Extend `src/app/blockEdit.test.ts` for the size field: a valid size,
      a non-numeric one, one past the machine's ceiling at that address, a
      move and a resize saved together (clamped against the new address), an
      unchanged assembly-backed block, and that growing pads with zero while
      shrinking discards from the end.
- [ ] 4.3 No component tests — this repo tests pure modules plus Playwright,
      and the bar is presentation over values the pure helpers already return.

## 5. The e2e specs the strip's and the bar's text is asserted through

- [ ] 5.1 `e2e/memory-blocks/asm-editor.spec.ts` and
      `e2e/memory-blocks/block-tabs.spec.ts` match the literal `ORG $8000` /
      `ORG $9000` as their evidence that a block editor is on screen; move
      those to the address range. Enumerate the occurrences from the tree
      rather than trusting a list.
- [ ] 5.2 Every use of the byte-count field's test id
      (`e2e/memory-blocks/asm-editor.spec.ts`,
      `e2e/memory-blocks/block-tabs.spec.ts`,
      `e2e/memory-blocks/zx81-listing-blocks.spec.ts`) becomes either the bar's
      static count or the settings field, depending on what that step was
      proving. Where a spec used the field only to read the current length,
      read the bar instead — that is the cheaper assertion.
- [ ] 5.3 `e2e/persistence/saved-data-tabs.spec.ts`: the byte-count assertion
      should survive untouched — confirm rather than assume — and the
      refusal-on-keystroke assertion becomes its opposite: the bytes are
      unchanged and the bar marks the file read-only throughout.
- [ ] 5.4 Several specs match a tab strip's text with regular expressions
      (`['BASIC', /block1/]`) **because** a glyph prefixes each tab's name. An
      icon contributes no text, so those can tighten to exact strings — in the
      memory-blocks specs, the hardware-transfer export journey, the
      shell-navigation dismissal journey and the saved-data-tabs journey.
      Enumerate them from the tree rather than trusting this list.
- [ ] 5.5 `e2e/code-editor/scratch-buffers.spec.ts` reads an overflow item's
      name through the name span, with a comment explaining that the item leads
      with the kind glyph. The selector still works; the comment goes stale —
      fix it rather than leaving it to mislead.
- [ ] 5.6 No new e2e test for the marks themselves. They are `aria-hidden`, so
      a browser test can assert only that some SVG is present, which is not the
      thing that matters — whether the five tell each other apart is answered
      by looking at 1.6, not by a spec.
- [ ] 5.7 Extend the existing journeys in those files; do not add a new cold
      page load for any of this.

## 6. Documentation

- [ ] 6.1 `docs/guide/machine-code.md`: the bullet directing the reader to the
      byte count "in the strip above the block", and the sentence after it
      claiming nothing asks for confirmation — a size set in settings does.
      Keep the two in-editor gestures (type past the end, backspace the last
      byte) described exactly as they are, because they are unchanged.
- [ ] 6.2 `docs/guide/machine-code.md`: the **Settings** bullet in the tab-menu
      list now sets the block's size as well as its name, address, kind, entry
      and comment.
- [ ] 6.3 `docs/guide/testing-programs.md`: "The bytes are shown read-only" now
      has a visible mark to name. Guide conventions: no source paths, no
      internal symbols.

## 7. Quality gates

- [ ] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [ ] 7.2 `npm run docs:build` (docs/ changed in group 5).
- [ ] 7.3 `npm run e2e:chromium -- e2e/memory-blocks`,
      `npm run e2e:chromium -- e2e/persistence` (the saved data file's read-only
      bar) and `npm run e2e:chromium -- e2e/code-editor` (the tab strip, its
      overflow and the scratch buffers). Only check off when all three pass; a
      failure leaves this unchecked with a note on what failed.
- [ ] 7.4 Phone-portrait viewport, through a throwaway Chromium spec rather
      than by hand: between the tab strip and the first row of bytes there is
      exactly one bar; it carries the Hex/Text choice; and with a long comment
      on the block the toggle is still on that one row. In the same pass, check
      what the wider tabs cost the strip — an icon is wider than the character
      it replaced, so marginally fewer tabs fit before overflowing, and the
      overflow control is the thing to watch.
