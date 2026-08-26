// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// The IDE's "Publish to Web…" flow: mint a short player URL for the current
// program via the share API. Everything here is
// named shareLink* - the Toolbar's existing `openShare` handler means the
// Export/Transfer dialog, not this.

import { useEffect, useState } from 'react';
import { useIdeStore } from '../app/store';
import { strictCharacterErrors } from '../app/strictCharacters';
import { computeCompatibleDialects } from '../share/compatibility';
import { createShare, ShareApiError } from '../share/shareClient';
import { serializeBlocks } from '../storage/projectFile';
import { playerPathFor } from '../player/routes';
import {
  getLastShare,
  setLastShare,
  UNTITLED_FILE_NAME,
} from '../storage/settings';
import dialog from './Dialog.module.css';
import styles from './ShareLinkDialog.module.css';

type Phase = 'blocked' | 'creating' | 'done' | 'error';

/** A user-facing message (and whether retrying can help) for a create failure. */
function describeCreateError(e: unknown): {
  message: string;
  retryable: boolean;
} {
  if (e instanceof ShareApiError) {
    switch (e.kind) {
      case 'unconfigured':
        return {
          message: 'No share service available. Share links cannot be created.',
          retryable: false,
        };
      case 'too-large':
        return {
          message:
            'This program is too large to share - maximum size is 64 KiB.',
          retryable: false,
        };
      case 'rate-limited':
        return {
          message: 'The share service is busy - try again in a moment.',
          retryable: true,
        };
      case 'network':
        return {
          message:
            'Could not reach the share service. Check your connection and retry.',
          retryable: true,
        };
      default:
        return {
          message: 'The share service returned an unexpected error.',
          retryable: true,
        };
    }
  }
  return {
    message: e instanceof Error ? e.message : String(e),
    retryable: true,
  };
}

export function ShareLinkDialog() {
  const open = useIdeStore((s) => s.shareLinkOpen);
  const setOpen = useIdeStore((s) => s.setShareLinkOpen);
  const dialect = useIdeStore((s) => s.dialect);

  const [phase, setPhase] = useState<Phase>('creating');
  const [blockedReason, setBlockedReason] = useState('');
  const [error, setError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [retrySeq, setRetrySeq] = useState(0);

  // Mint on open. The document can't change while the modal is up, so the
  // store is read once here rather than subscribed to.
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setError(null);
    setResult(null);
    const { dialect, source, fileName, blocks, strictCharacters } =
      useIdeStore.getState();

    // The dedupe cache keys on (source, dialect) only, so it can't tell two
    // documents apart by their blocks. Reuse it only for a block-free
    // document; a document with blocks always re-mints, so its link can never
    // be a stale, blockless one.
    const cached = getLastShare();
    if (
      blocks.length === 0 &&
      cached &&
      cached.source === source &&
      cached.dialectId === dialect.id
    ) {
      setResult({ url: cached.url });
      setPhase('done');
      return;
    }

    if (!navigator.onLine) {
      setBlockedReason(
        'You appear to be offline. Reconnect to create a share link.',
      );
      setPhase('blocked');
      return;
    }
    // Strict characters counts here as the editor counts it: a link points at a
    // program that runs, and under that setting this one does not.
    const errorCount =
      dialect.tokenize(source).errors.length +
      strictCharacterErrors(source, dialect, strictCharacters).length;
    if (errorCount > 0) {
      setBlockedReason(
        `This program has ${errorCount} error${errorCount > 1 ? 's' : ''} - ` +
          'fix them in the editor before sharing, so the link points at a program that runs.',
      );
      setPhase('blocked');
      return;
    }
    setPhase('creating');
    let cancelled = false;
    (async () => {
      try {
        const compatible = computeCompatibleDialects(source, blocks);
        const { id } = await createShare({
          dialectId: dialect.id,
          compatibleDialects: compatible,
          name: !fileName || fileName === UNTITLED_FILE_NAME ? '' : fileName,
          source,
          ...(blocks.length > 0 ? { blocks: serializeBlocks(blocks) } : {}),
        });
        if (cancelled) return;
        const url = location.origin + playerPathFor(dialect.id, id);
        setResult({ url });
        setPhase('done');
        // Only cache a block-free share: the cache can't represent blocks, and
        // reusing it for a later same-source document would drop them.
        if (blocks.length === 0) {
          setLastShare({ source, dialectId: dialect.id, url });
        }
      } catch (e) {
        if (cancelled) return;
        setError(describeCreateError(e));
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, retrySeq]);

  if (!open) return null;

  const close = () => setOpen(false);
  const retry = () => setRetrySeq((n) => n + 1);

  const copyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.url).then(
      () => setCopied(true),
      () => undefined,
    );
  };

  // The native share sheet, where the platform has one (mostly mobile).
  const canShareNative =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareNative = () => {
    if (!result) return;
    const { fileName } = useIdeStore.getState();
    navigator.share({ title: fileName, url: result.url }).catch(() => {});
  };

  return (
    <div className={dialog.modalBackdrop} onClick={close}>
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Publish to Web</h2>

        {phase === 'blocked' && <p>{blockedReason}</p>}

        {phase === 'creating' && <p>Creating share link…</p>}

        {phase === 'error' && error && (
          <>
            <p className={styles.error}>{error.message}</p>
            {error.retryable && (
              <div className={`${dialog.modalActions} ${dialog.left}`}>
                <button onClick={retry}>Retry</button>
              </div>
            )}
          </>
        )}

        {phase === 'done' && result && (
          <>
            <p>Anyone can play this program - and view its code - at:</p>
            <div className={styles.urlRow}>
              <input
                className={styles.url}
                readOnly
                value={result.url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy'}</button>
              {canShareNative && <button onClick={shareNative}>Share…</button>}
            </div>
            <p>
              This link opens on the <strong>{dialect.name}</strong>. To share a
              link for a different system, switch the current target and share
              again.
            </p>
          </>
        )}

        <div className={dialog.modalActions}>
          <button onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}
