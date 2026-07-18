// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlock } from '../dialects/types';
import { formatWord } from '../asm/format';
import styles from './UnsupportedBlockNotice.module.css';

/**
 * Placeholder shown in place of an editor for blocks that can't be edited
 * yet: `data` blocks (no hex editor so far), or a `code` block whose dialect
 * declares no CPU / whose CPU has no engine.
 */
export function UnsupportedBlockNotice({ block }: { block: MemoryBlock }) {
  return (
    <div className={styles.notice} role="note">
      <p className={styles.headline}>This file format is not yet supported.</p>
      <p className={styles.detail}>
        <strong>{block.name}</strong> · {block.kind} ·{' '}
        {formatWord(block.address)} · {block.bytes.length}{' '}
        {block.bytes.length === 1 ? 'byte' : 'bytes'}
        {block.entry !== undefined && <> · entry {formatWord(block.entry)}</>}
      </p>
      {block.comment !== undefined && (
        <p className={styles.comment}>{block.comment}</p>
      )}
    </div>
  );
}
