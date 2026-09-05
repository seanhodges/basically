// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Taking a file a running program saved out of the IDE: as the raw bytes it
 * wrote, or as text.
 *
 * Text because that is what a program's file output usually is - a TRS-80 or
 * BBC `PRINT#` file is a run of characters with a terminator after each line -
 * and the characters are the machine's own, not ASCII: a byte means whatever
 * that machine's character set says it means, which is the same mapping the
 * byte view's character column shows.
 */

import type { CharsetMapping } from '../dialects/types';

const CR = 0x0d;
const LF = 0x0a;

/**
 * The file's bytes as text. Every byte is the character its machine's set
 * gives it, except the line terminator: these machines end a line with CR
 * (sometimes CR LF), and a `.txt` the user opens elsewhere wants a newline
 * there rather than the glyph the machine draws for a control code.
 */
export function decodeDataText(
  bytes: Uint8Array,
  charset: CharsetMapping,
): string {
  let out = '';
  let previous = -1;
  for (const code of bytes) {
    if (code === CR) out += '\n';
    // The LF of a CR LF pair is the same line ending, already written.
    else if (code === LF) {
      if (previous !== CR) out += '\n';
    } else out += charset.glyph(code);
    previous = code;
  }
  return out;
}

/**
 * A download name for a file a program saved. The name is the program's, so it
 * can hold anything that machine's character set allows - spaces, punctuation,
 * graphics - and none of that belongs in a filename; a name with nothing usable
 * left falls back to `file`, which is still better than an extension alone.
 */
export function dataBlockFileName(name: string, extension: string): string {
  const safe = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '');
  return `${safe === '' ? 'file' : safe}${extension}`;
}
