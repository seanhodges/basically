// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * An outcome as a client is shown it.
 *
 * The prose is the operation's own {@link Operation.describe}, which is what
 * every caller that shows an outcome to a model already uses. What this caller
 * adds is the picture: the protocol carries an image in an answer, so a
 * display is served as a display rather than as a sentence about one - which
 * neither the command line, whose answers are a stream of bytes, nor the
 * assistant, whose tool answers are text, can do.
 */

import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import type { Operation } from '../ops/types';

/** PNG, the only encoding a headless capture produces. */
const PICTURE_TYPE = 'image/png';

/**
 * The picture an outcome carries, or null. Read structurally rather than by
 * operation, because every outcome that has one spells it the same way: a
 * `picture` holding base64 PNG bytes under `png`.
 */
export function pictureIn(outcome: unknown): string | null {
  if (typeof outcome !== 'object' || outcome === null) return null;
  const picture = (outcome as { picture?: unknown }).picture;
  if (typeof picture !== 'object' || picture === null) return null;
  const png = (picture as { png?: unknown }).png;
  return typeof png === 'string' && png !== '' ? png : null;
}

/**
 * The outcome as content: what the operation says about it, and the display
 * itself where the outcome carries one. A machine whose display cannot be
 * pictured yields prose alone, which is the operation saying no picture could
 * be taken rather than an answer with nothing in it.
 */
export function outcomeContent(
  op: Operation,
  outcome: unknown,
  extra: string[] = [],
): ContentBlock[] {
  const prose = [op.describe(outcome), ...extra].filter((t) => t !== '');
  const content: ContentBlock[] = [{ type: 'text', text: prose.join('\n\n') }];
  const png = pictureIn(outcome);
  if (png) content.push({ type: 'image', data: png, mimeType: PICTURE_TYPE });
  return content;
}
