// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from '../app/store';
import { formatWord } from '../asm/format';
import dialog from './Dialog.module.css';

/**
 * Confirms deleting a memory block after a right-click / long-press on its
 * editor tab. Driven by `pendingDeleteBlockId` (see store.requestRemoveBlock);
 * the BASIC program has no block id, so it can never arrive here.
 */
export function DeleteBlockDialog() {
  const pendingDeleteBlockId = useIdeStore((s) => s.pendingDeleteBlockId);
  const blocks = useIdeStore((s) => s.blocks);
  const confirmRemoveBlock = useIdeStore((s) => s.confirmRemoveBlock);
  const cancelRemoveBlock = useIdeStore((s) => s.cancelRemoveBlock);

  const block = blocks.find((b) => b.id === pendingDeleteBlockId);
  if (!block) return null;

  const kind = block.kind === 'code' ? 'machine code' : 'data';

  return (
    <div className={dialog.modalBackdrop} onClick={cancelRemoveBlock}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Delete {block.name}?</h2>
        <p>
          This removes the {kind} block at {formatWord(block.address)} (
          {block.bytes.length} {block.bytes.length === 1 ? 'byte' : 'bytes'})
          from the document.
        </p>
        <p className={dialog.modalWarning}>
          The block&apos;s bytes and assembly source are deleted with it - this
          cannot be undone.
        </p>
        <div className={dialog.modalActions}>
          <button onClick={cancelRemoveBlock}>Cancel</button>
          <button onClick={confirmRemoveBlock}>Delete</button>
        </div>
      </div>
    </div>
  );
}
