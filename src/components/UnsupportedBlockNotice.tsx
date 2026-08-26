// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlock } from '../dialects/types';
import { formatWord } from '../asm/format';
import styles from './UnsupportedBlockNotice.module.css';

/**
 * Placeholder shown in place of an editor for the one block that reaches
 * neither editing surface: machine code on a dialect with no memory-block
 * support, so there is no CPU to assemble it for. A data block, and a code
 * block whose CPU simply has no assembler engine, are edited as bytes.
 */
export function UnsupportedBlockNotice({ block }: { block: MemoryBlock }) {
  return (
    <div className={styles.notice} role="note">
      <p className={styles.headline}>
        This machine has no machine-code support, so there is nothing to
        assemble this block with.
      </p>
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
