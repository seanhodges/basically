// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useState } from 'react';
import { useIdeStore } from '../app/store';
import {
  applyBlockSettings,
  draftFromBlock,
  validateBlockSettings,
  type BlockSettingsDraft,
  type BlockSettingsErrors,
} from '../app/blockEdit';
import { asmEngineFor } from '../asm/registry';
import dialog from './Dialog.module.css';

/**
 * View and edit a memory block's metadata (name, address, kind, entry,
 * comment), opened from the tab context menu's "Settings". Driven by
 * `blockSettingsId`; Save validates the draft (see `src/app/blockEdit.ts`)
 * and writes the block back through `upsertBlock` - moving a block with
 * assembly source re-assembles it at the new address so absolute label
 * references follow the move.
 */
export function BlockSettingsDialog() {
  const blockSettingsId = useIdeStore((s) => s.blockSettingsId);
  const blocks = useIdeStore((s) => s.blocks);
  const dialect = useIdeStore((s) => s.dialect);
  const upsertBlock = useIdeStore((s) => s.upsertBlock);
  const closeBlockSettings = useIdeStore((s) => s.closeBlockSettings);

  const block = blocks.find((b) => b.id === blockSettingsId);

  const [draft, setDraft] = useState<BlockSettingsDraft | null>(null);
  const [errors, setErrors] = useState<BlockSettingsErrors>({});

  // (Re)seed the form when a (different) block opens; clear it on close so a
  // reopened dialog never shows a stale draft.
  useEffect(() => {
    setDraft(block ? draftFromBlock(block) : null);
    setErrors({});
  }, [blockSettingsId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!block || !draft) return null;

  const field = (patch: Partial<BlockSettingsDraft>) =>
    setDraft({ ...draft, ...patch });

  const save = () => {
    const found = validateBlockSettings(draft, block.id, blocks);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const engine = dialect.memoryBlocks
      ? asmEngineFor(dialect.memoryBlocks.cpu)
      : null;
    upsertBlock(applyBlockSettings(block, draft, engine));
    closeBlockSettings();
  };

  return (
    <div className={dialog.modalBackdrop} onClick={closeBlockSettings}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Block settings</h2>
        <p>
          {block.bytes.length} {block.bytes.length === 1 ? 'byte' : 'bytes'} of{' '}
          {block.kind === 'code' ? 'machine code' : 'data'}.
        </p>
        <label>
          Name
          <input
            value={draft.name}
            onChange={(e) => field({ name: e.target.value })}
            autoFocus
          />
          {errors.name && (
            <span className={dialog.modalWarning}>{errors.name}</span>
          )}
        </label>
        <label>
          Load address
          <input
            value={draft.address}
            onChange={(e) => field({ address: e.target.value })}
          />
          {errors.address && (
            <span className={dialog.modalWarning}>{errors.address}</span>
          )}
        </label>
        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(e) => field({ kind: e.target.value as 'code' | 'data' })}
          >
            <option value="code">Machine code</option>
            <option value="data">Data</option>
          </select>
        </label>
        <label>
          Entry address (optional)
          <input
            value={draft.entry}
            onChange={(e) => field({ entry: e.target.value })}
            placeholder="blank = none"
          />
          {errors.entry && (
            <span className={dialog.modalWarning}>{errors.entry}</span>
          )}
        </label>
        <label>
          Comment (optional)
          <input
            value={draft.comment}
            onChange={(e) => field({ comment: e.target.value })}
          />
        </label>
        <div className={dialog.modalActions}>
          <button onClick={closeBlockSettings}>Cancel</button>
          <button onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
