// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useState } from 'react';
import { useIdeStore, useBlocks } from '../app/store';
import {
  applyBlockSettings,
  draftFromBlock,
  parseAddressInput,
  sizeIsAssembled,
  validateBlockSettings,
  type BlockSettingsDraft,
  type BlockSettingsErrors,
} from '../app/blockEdit';
import { maxBlockLength } from '../app/byteEdit';
import type { Block } from '../dialects/types';
import { asmEngineFor } from '../asm/registry';
import dialog from './Dialog.module.css';

/** The ordinal in a `listing-<n>` block id, or `null`. */
function listingOrdinal(id: string): number | null {
  const m = /^listing-(\d+)$/.exec(id);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * View and edit a memory block's metadata (name, address, size, kind, entry,
 * comment), opened from the tab context menu's "Settings". Driven by
 * `blockSettingsId`; Save validates the draft (see `src/app/blockEdit.ts`)
 * and writes the block back through `upsertBlock` - moving a block with
 * assembly source re-assembles it at the new address so absolute label
 * references follow the move.
 *
 * The size sits beside the address because each bounds the other: how many
 * bytes a block may hold is decided by where it sits. It is stated rather than
 * offered where the assembler decides the length, and applied on Save like
 * every other setting - growing a block a byte at a time is still the editor's
 * job, and still undoable there.
 *
 * Listing-backed blocks (ZX80/ZX81) differ: their address is fixed by where the
 * `#BIN` line sits (read-only) and they carry no entry point, so only the name,
 * code-vs-data kind and comment are editable - saved to the document's
 * `listingBlockMeta` rather than to a block.
 */
export function BlockSettingsDialog() {
  const blockSettingsId = useIdeStore((s) => s.blockSettingsId);
  const blocks = useBlocks();
  const dialect = useIdeStore((s) => s.dialect);
  const upsertBlock = useIdeStore((s) => s.upsertBlock);
  const setListingBlockMeta = useIdeStore((s) => s.setListingBlockMeta);
  const closeBlockSettings = useIdeStore((s) => s.closeBlockSettings);

  const block = blocks.find((b) => b.id === blockSettingsId);
  const ordinal = block ? listingOrdinal(block.id) : null;
  const inListing = !!dialect.memoryBlocks?.inListing && ordinal !== null;
  const engine = dialect.memoryBlocks
    ? asmEngineFor(dialect.memoryBlocks.cpu)
    : null;

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

  // A block whose bytes the assembler produces is sized by it, and a listing
  // block's bytes are not the dialog's to write at all - what its address rule
  // already dictates, its size follows.
  const sizeFixed = inListing || sizeIsAssembled(draft, engine);
  // The ceiling the size is held to: at the address being saved, not the one
  // the block is leaving.
  const ceiling = maxBlockLength(
    parseAddressInput(draft.address) ?? block.address,
  );

  const save = () => {
    const found = validateBlockSettings(draft, block.id, blocks);
    // Address/entry aren't editable for listing blocks, so ignore those errors.
    if (inListing) {
      delete found.address;
      delete found.entry;
    }
    if (sizeFixed) delete found.size;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (inListing && ordinal !== null) {
      // Only store what differs from the derived defaults, keeping the metadata
      // map minimal (and avoiding a needless project save on a no-op edit).
      const name = draft.name.trim();
      const comment = draft.comment.trim();
      setListingBlockMeta(ordinal, {
        name: name && name !== `bin${ordinal + 1}` ? name : undefined,
        kind: draft.kind !== 'code' ? draft.kind : undefined,
        comment: comment !== '' ? comment : undefined,
      });
      closeBlockSettings();
      return;
    }
    upsertBlock(applyBlockSettings(block, draft, engine));
    closeBlockSettings();
  };

  return (
    <div className={dialog.modalBackdrop} onClick={closeBlockSettings}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Block settings</h2>
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
            readOnly={inListing}
            disabled={inListing}
          />
          {inListing ? (
            <span className={dialog.modalNote}>
              Set by where the REM line sits in the listing.
            </span>
          ) : (
            errors.address && (
              <span className={dialog.modalWarning}>{errors.address}</span>
            )
          )}
        </label>
        <label>
          Size in bytes
          <input
            value={draft.size}
            onChange={(e) => field({ size: e.target.value })}
            readOnly={sizeFixed}
            disabled={sizeFixed}
          />
          {sizeIsAssembled(draft, engine) ? (
            <span className={dialog.modalNote}>
              Set by assembling the block's source.
            </span>
          ) : inListing ? (
            <span className={dialog.modalNote}>
              Set by the bytes the REM line holds.
            </span>
          ) : (
            <>
              <span className={dialog.modalNote}>
                A block can hold {ceiling} bytes at this address. Growing pads
                with zero and shrinking discards from the end; saving a new size
                clears the block's byte-edit history, so undo will not bring
                those bytes back.
              </span>
              {errors.size && (
                <span className={dialog.modalWarning}>{errors.size}</span>
              )}
            </>
          )}
        </label>
        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(e) => field({ kind: e.target.value as Block['kind'] })}
          >
            <option value="code">Assembly</option>
            <option value="memory">Binary</option>
          </select>
        </label>
        {!inListing && (
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
        )}
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
