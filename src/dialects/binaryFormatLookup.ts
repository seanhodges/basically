// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which registered dialects could have produced a file of this name, by its
 * extension.
 *
 * `convert` (`src/ops/convert.ts`) is the only caller: given a file whose
 * machine was not named, it needs every dialect whose declared
 * `binaryImports` could claim that extension, so it can use the one match or
 * decline naming every candidate when more than one does - several machines
 * share an extension (`.tap`, `.bin`, `.cdt`), so this must be able to
 * decline rather than guess.
 */

import { dialects } from './registry';
import type { Dialect } from './types';

/** The extension of a file name, lower case and without the dot, or null. */
function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : null;
}

/** Every registered dialect whose `binaryImports` declares this extension. */
export function dialectsForExtension(fileName: string): Dialect[] {
  const ext = extensionOf(fileName);
  if (ext === null) return [];
  return dialects.filter((d) =>
    (d.binaryImports ?? []).some(
      (format) => format.extension.replace(/^\./, '').toLowerCase() === ext,
    ),
  );
}
