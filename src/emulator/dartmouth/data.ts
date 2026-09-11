// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BasicLine } from './program';

/**
 * The constant pool `READ` walks, which the fourth edition splits in two.
 *
 * The 1965 language has one block of numbers and no way to rewind it. Section
 * 2.7 adds a second: "numeric and string DATA are kept in two separate blocks,
 * and these act independently of each other", so a `READ` matches each variable
 * to the block its type names and the two pointers advance separately -
 * `RESTORE` rewinding both, `RESTORE*` the numbers and `RESTORE$` the strings.
 */
export interface DataBlocks {
  numbers: number[];
  strings: string[];
}

/**
 * Every `DATA` constant in program order, sorted into its block.
 *
 * The classification is section 2.7's own, and it is a lexical rule rather than
 * a semantic one: "strings in DATA statements are recognized by the fact that
 * they start with a letter. If a string does not start with a letter, it must
 * be enclosed in quotes. The same requirement holds for a string containing a
 * comma." The manual's example is `DATA 10, ABC, 5, "4FG", "SEPT. 22, 1967", 2`
 * - three numbers and three strings, with the quotes carrying the two the rule
 * would otherwise misread.
 *
 * On a machine with no strings every field is a number, and one that will not
 * read as a number is passed over rather than faulted: the 1965 compiler's own
 * `DATA` reader takes the constants it recognises.
 */
export function collectData(
  lines: readonly BasicLine[],
  strings: boolean,
): DataBlocks {
  const blocks: DataBlocks = { numbers: [], strings: [] };
  for (const line of lines) {
    if (line.dataText === undefined) continue;
    for (const field of splitFields(line.dataText)) {
      // Leading blanks are ignored unless the quotes take them in, so the
      // quotes are looked for on the trimmed field and kept on what is inside.
      const trimmed = field.trim();
      const quoted =
        trimmed.length > 1 && trimmed.startsWith('"') && trimmed.endsWith('"');
      const text = quoted ? trimmed.slice(1, -1) : trimmed;
      if (strings && (quoted || /^[A-Za-z]/.test(text))) {
        blocks.strings.push(text);
        continue;
      }
      const value = Number(text);
      if (text !== '' && Number.isFinite(value)) blocks.numbers.push(value);
    }
  }
  return blocks;
}

/**
 * Split a `DATA` line on its commas, leaving a quoted field whole - closing
 * quote included, so the caller can still tell a quoted field from a bare one.
 * An unterminated quote takes the rest of the line, which is what the reader
 * does with a tape it has run off the end of.
 */
function splitFields(text: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inString = false;
  for (const ch of text) {
    if (ch === '"') inString = !inString;
    if (ch === ',' && !inString) {
      fields.push(field);
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.trim() !== '') fields.push(field);
  return fields;
}

/**
 * Split a typed `INPUT` line the same way. Section 2.7 states the one
 * convention it differs by: "the only convention on INPUT is that a string
 * containing a comma must be enclosed in quotes", so the quotes are stripped
 * here and nothing is classified - the variables being filled say which field
 * is which type.
 */
export function inputFields(text: string): string[] {
  return splitFields(text).map((field) => {
    const trimmed = field.trim();
    return trimmed.startsWith('"') &&
      trimmed.endsWith('"') &&
      trimmed.length > 1
      ? trimmed.slice(1, -1)
      : trimmed;
  });
}
