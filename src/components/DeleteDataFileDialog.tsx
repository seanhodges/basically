// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore } from '../app/store';
import dialog from './Dialog.module.css';

/**
 * Confirms deleting a file a running program saved, after Delete on its editor
 * tab. Driven by `pendingDeleteDataFile` (see store.requestDeleteDataFile).
 *
 * Confirmed, unlike closing a scratch buffer: the file is kept for the machine
 * that wrote it and running again does not recreate it, so this is the user's
 * only way to lose it.
 */
export function DeleteDataFileDialog() {
  const name = useIdeStore((s) => s.pendingDeleteDataFile);
  const confirmDeleteDataFile = useIdeStore((s) => s.confirmDeleteDataFile);
  const cancelDeleteDataFile = useIdeStore((s) => s.cancelDeleteDataFile);

  if (name === null) return null;

  return (
    <div className={dialog.modalBackdrop} onClick={cancelDeleteDataFile}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Delete {name}?</h2>
        <p>
          This removes the file your program saved. Later runs on this machine
          will no longer be able to load it.
        </p>
        <p className={dialog.modalWarning}>
          The file is gone for good - running the program again does not bring
          it back.
        </p>
        <div className={dialog.modalActions}>
          <button onClick={cancelDeleteDataFile}>Cancel</button>
          <button onClick={confirmDeleteDataFile}>Delete</button>
        </div>
      </div>
    </div>
  );
}
