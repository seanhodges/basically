// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { ReactNode } from 'react';
import { formatWord } from '../asm/format';
import { formatBlockExtent } from '../app/blockEdit';
import styles from './BlockBar.module.css';

/**
 * The one bar above a block's contents, shared by the assembly editor and the
 * byte editor so the two cannot drift apart again.
 *
 * It answers the question the surface it sits on is about: which addresses does
 * this block occupy? The range is the fact the bar was missing; the byte count
 * stays beside it because that is the number people quote - what the RAM budget
 * is spent in and what a download weighs.
 *
 * It does not name the block. The tab directly above carries the name, and is
 * the thing the user selected to arrive here.
 *
 * `children` is the surface's own controls, pinned to the end of the bar and
 * not allowed to shrink: the bar wraps, and a control that wrapped onto a
 * second line would have moved a row rather than removed one. The comment takes
 * the ellipsis instead.
 */
export function BlockBar({
  address,
  byteCount,
  entry,
  comment,
  readOnly = false,
  refusal = null,
  children,
}: {
  /** Where the block sits, or absent for a file the program saved: such a file
   *  counts offsets from its own first byte and has no address to state. */
  address?: number;
  byteCount: number;
  entry?: number;
  comment?: string;
  /** Marked for as long as the tab is open, because it is true for that long. */
  readOnly?: boolean;
  /** A refusal to show, hosted here because either surface could raise one. */
  refusal?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className={styles.blockBar} data-testid="block-bar">
      <span>
        {address !== undefined && (
          <>{formatBlockExtent(address, byteCount)} · </>
        )}
        {byteCount} {byteCount === 1 ? 'byte' : 'bytes'}
      </span>
      {entry !== undefined && <span>· entry {formatWord(entry)}</span>}
      {comment !== undefined && (
        <span className={styles.comment}>· {comment}</span>
      )}
      {readOnly && (
        <span
          className={styles.readOnly}
          role="img"
          aria-label="Read-only - saved by the program"
          title="Read-only - saved by the program"
        >
          RO
        </span>
      )}
      {refusal !== null && (
        <span
          className={styles.refusal}
          role="alert"
          data-testid="byte-refusal"
        >
          {refusal}
        </span>
      )}
      {children !== undefined && (
        <div className={styles.controls}>{children}</div>
      )}
    </div>
  );
}
