## 1. The buffer model in the store

- [x] 1.1 Add a scratch-buffer list to the store: id, display name, text, and its
      own breakpoint set. Session-only state — it goes nowhere near the autosave
      keys or the project serializer.
- [x] 1.2 Generalise the active tab from a nullable block id to a three-way
      value (BASIC / block / scratch). Update the three consumers outside the
      store (the tab strip, `Workspace`, the docs-topic resolver) and the
      internal fixups that repoint the active tab when a block is deleted —
      including the listing-backed path, which shifts the active tab down past
      the removed ordinal.
- [x] 1.3 Actions to add, rename, retext and close a scratch buffer. Names are
      generated (`Scratch 1`, `Scratch 2`…) and need not be unique — nothing
      resolves a scratch buffer by name. Closing the active one falls back to the
      BASIC tab, the same way closing the active block already does.
- [x] 1.4 Lifecycle: scratch buffers are cleared on a target-machine switch and
      on player boot, and survive New / Open / Sample / Import. Note that these
      are *different* rules from blocks and breakpoints, which reset on all of
      them — do not fold the scratch reset into the shared "a different program
      became active" path.
- [x] 1.5 Colocated store tests: editing a scratch buffer leaves `source`,
      `dirty` and any preserved boot-disc image alone; the lifecycle rules above;
      closing the active buffer falls back to BASIC; the autosave signature and
      the project-bundle round trip are byte-identical with and without scratch
      buffers present.

## 2. Breakpoints per buffer

- [x] 2.1 A selector for the active buffer's breakpoint set, in the shape of the
      existing derived-blocks selector. Point the breakpoint gutter, the gutter
      click handler and the F9 toggle at it, so the dots always belong to the
      buffer on screen.
- [x] 2.2 Toggle and clear act on the active buffer. The document's set stays
      where it is in the store; a scratch buffer's set lives on the buffer, so
      closing a tab drops its breakpoints with no cleanup path.
- [x] 2.3 Pin a running debug session to the buffer that started it. The debug
      loop currently re-reads the breakpoint set from the store on every slice —
      capture the running buffer alongside the other per-session run state and
      resolve breakpoints from that buffer until the session ends, or switching
      tabs mid-run silently swaps the live session's breakpoints.
- [x] 2.4 Track which buffer a pause belongs to, and show the paused-line
      highlight and the "paused at line N" status only while that buffer is the
      one on screen.
- [x] 2.5 Colocated tests: toggling on a scratch leaves the program's set alone
      and vice versa; closing a buffer drops its breakpoints; a session resolves
      breakpoints from the buffer that ran, not the one on screen.

## 3. One editor, many buffers

- [x] 3.1 Route the editor's document-push and change handler by the active tab
      in `Workspace`: the scratch retext action for a scratch buffer, `setSource`
      for the program. Keep the branch out of `setSource` — it carries document
      semantics (dirty, the boot-disc clear, the untitled-and-empty rule) that a
      scratch must not trigger.
- [x] 3.2 A tab switch pushes the incoming buffer's text through the editor's
      existing `{text, seq}` channel. Verify the switch cannot lose the last
      keystroke of the outgoing buffer.
- [x] 3.3 Re-check the singleton behaviours that survive on one mounted editor:
      find/replace, virtual-keyboard typing, Edit-menu commands, jump-to-line,
      and the selection/focus mirrors. These are the regression surface the
      one-editor decision was made to protect.

## 4. Running the buffer on screen

- [x] 4.1 The run path takes its source from the active buffer — the scratch's
      text when one is showing, else `source`. The assistant's answer-check keeps
      precedence and is untouched.
- [x] 4.2 Bypass the preserved-boot-disc short circuit for a scratch run.
      Without this, Run does nothing at all on a document imported from a
      multi-file disc, because that path never tokenizes a source.
- [x] 4.3 A scratch run carries the document's memory blocks — block linting uses
      the snippet's own byte size, which is already what that check wants — and
      does not carry preserved tape files, an imported auto-start line, or a
      boot-disc image.
- [x] 4.4 Colocated tests for run-source selection: scratch active → the
      scratch's text; BASIC or a block tab active → `source`; an assistant check
      still wins over both.

## 5. The tab strip

- [x] 5.1 Render scratch tabs after the block tabs, with a glyph distinct from
      the code and data block glyphs so they read as not part of the document.
- [x] 5.2 The strip currently returns nothing for a dialect with no memory-block
      support — render it unconditionally, since scratch tabs are
      dialect-independent.
- [x] 5.3 Turn the `+` button into a two-item menu (new scratch buffer / new
      machine code block), reusing the dismiss and context-menu pieces the strip
      already imports.
- [x] 5.4 A scratch tab's context menu (right-click and long-press, as the block
      tabs have): rename, download as `.bas`, close. No confirmation on close.
- [x] 5.5 Name the buffer the run control will run, so it is clear before
      pressing it that a snippet and not the program is about to boot.

## 6. Readers that follow the buffer on screen

- [x] 6.1 Point the status-bar size and error counts, the memory map, the
      procedure outline and the contextual documentation at the active buffer.
- [x] 6.2 Leave hardware export, the assistant's source and staleness base,
      save/open, share links and autosave reading the document. Confirm each,
      rather than assuming — the failure mode is publishing or saving a snippet
      under the document's name.

## 7. Verify

- [x] 7.1 One e2e journey in `e2e/code-editor/`: create a scratch buffer, type a
      numbered snippet, run it and assert the emulator shows the snippet's
      output; switch back to BASIC and assert the program is intact and saving
      still writes the program; reload and assert the scratch buffer is gone.
      Browser-only facts: the real document swap in a live EditorView, the canvas
      actually painting, and a real reload. Extend an existing journey rather
      than adding a cold page load if one in that folder already boots a machine.
- [x] 7.2 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 7.3 `npm run e2e:chromium -- e2e/code-editor e2e/program-execution` —
      check this off only when the run passes; a failure leaves it unchecked with
      a note on what failed.
