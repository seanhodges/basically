## 1. The retention rule

- [x] 1.1 New module holding the pure rule: given the dialect being left, the
      dialect being switched to, the document's blocks and its listing-block
      metadata, return what survives. Fixed-address to fixed-address keeps the
      blocks verbatim; listing to listing keeps the metadata and no blocks (a
      listing dialect derives its blocks from the source); a target that
      declares no block support, or a switch across the two models, keeps
      neither. Expressed in terms of what the dialect declares, never a machine
      list.
- [x] 1.2 Colocated tests driven off the real registry: a fixed-address pair
      (both directions), the two listing dialects, a dialect that declares no
      block support, and both directions across the model boundary. Assert the
      blocks come back identical — bytes, address, name, kind, comment, entry
      and assembly source — rather than merely non-empty.

## 2. The switch

- [x] 2.1 The shared target-switch patch in the store gains a retain mode:
      keep what the rule returns instead of clearing blocks and metadata, keep
      the scratch buffers, and leave the buffer histories alone. Everything else
      it does — stopping the machine, discarding the files a run saved, clearing
      breakpoints, tape files, boot disc and auto-start line, resetting the
      assistant thread and the tab strip — is unchanged.
- [x] 2.2 Use it from the two paths where the user keeps their program: the
      confirmation's keep answer, and the silent switch onto a machine that takes
      the program as it stands. Every other caller (New, Open, a shared program,
      the player boot, an empty editor, a pristine sample) passes no retain mode
      and behaves exactly as before.
- [x] 2.3 Drop the parked edit history of any block the rule discarded, so no
      snapshot outlives its block.
- [x] 2.4 Confirm the document is autosaved after a retained switch, so the kept
      blocks and buffers survive a reload.

## 3. Undo across a keep

- [x] 3.1 The BASIC editor is rebuilt when the machine changes: park the showing
      buffer's state before the old view is destroyed, and seed the new view from
      the parked state rather than from a fresh one. The existing generation
      check must keep doing the discrimination — a switch that clears the
      histories still starts with a clean undo, and undo must never reach back
      across an Open or a New.
- [x] 3.2 Tests: a keep switch leaves the parked histories in place; a start-new
      switch and every document replacement still clear them.

## 4. The question

- [x] 4.1 The switch confirmation states what travels: blocks kept (at their own
      addresses, which the new machine's memory map may refuse), blocks dropped
      and why, scratch buffers kept, files a run saved discarded. Each sentence
      appears only where the document actually holds that thing, and the blocks
      sentence is computed from the same rule the switch applies.
- [x] 4.2 The buttons keep their current names, so the existing e2e helper that
      drives the dialog is unaffected.

## 5. Store behaviour tests

- [x] 5.1 Update the existing target-switch tests that assert blocks and scratch
      buffers are cleared on a keep — they now assert the opposite for keep, and
      unchanged behaviour for start-new and for every document replacement.
- [x] 5.2 A keep onto a machine that supports no blocks, and a keep across the
      model boundary, leave the document with no blocks.
- [x] 5.3 The silent switch onto a compatible machine keeps the scratch buffers.

## 6. Docs

- [x] 6.1 The scratch-buffer section of the writing guide: buffers are kept when
      the user keeps their code across a machine switch, discarded when they
      start new.
- [x] 6.2 The machine-code guide: what a machine switch does to blocks, including
      that a kept block keeps its address and may then be reported as not fitting.
- [x] 6.3 Leave the saved-files guidance as it stands — those are still discarded
      on a switch. Do not touch the docs sidebar.

## 7. Quality gates

- [x] 7.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 7.2 `npm run docs:build` (docs change in task 6)
- [x] 7.3 `npm run e2e:chromium -- e2e/memory-blocks e2e/code-editor
      e2e/dialect-toolchain e2e/persistence e2e/porting-guidance`. The new
      journey went into the memory-blocks folder, beside the other block-tab
      specs, rather than porting-guidance. All pass at one worker, the number CI
      runs. At two workers this container fails a first-paint assertion in
      `asm-editor.spec.ts` intermittently - reproduced the same way on the
      unmodified tree, so it is the dev server's cold compile racing a 5s
      timeout, not this change.
- [x] 7.4 `npx openspec validate --specs`
