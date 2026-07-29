// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { controlChipDecorations } from './controlChipWidget';
import { bbcCharset } from '../dialects/bbcmicro/charset';
import { BBC_DISPLAY_CONTROLS } from '../dialects/bbcmicro/teletextChips';

const toMachine = (text: string): Uint8Array => bbcCharset.toMachine(text);

/** The [from, to) ranges the extension would collapse, in document order. */
function spans(doc: string): Array<[number, number, string]> {
  const state = EditorState.create({ doc });
  const deco = controlChipDecorations(state, BBC_DISPLAY_CONTROLS, toMachine);
  const out: Array<[number, number, string]> = [];
  const cursor = deco.iter();
  while (cursor.value) {
    out.push([cursor.from, cursor.to, doc.slice(cursor.from, cursor.to)]);
    cursor.next();
  }
  return out;
}

describe('controlChipDecorations', () => {
  it('collapses each control escape inside a string literal', () => {
    const doc = '10 PRINT "{GRAPHICS WHITE}\u{1FB3B}{SEPARATED}\u{1FB3B}"\n';
    expect(spans(doc).map((s) => s[2])).toEqual([
      '{GRAPHICS WHITE}',
      '{SEPARATED}',
    ]);
  });

  it('spans exactly the escape, and nothing of the text around it', () => {
    const doc = '10 PRINT "A{RED}B"\n';
    const [span] = spans(doc);
    expect(span).toBeDefined();
    expect(doc.slice(span![0], span![1])).toBe('{RED}');
  });

  it('leaves an escape outside a string alone', () => {
    // Outside a literal the tokenizer reads `{` as the plain 0x7B byte, so a
    // chip there would be drawing something the program does not contain.
    expect(spans('10 A={RED}\n')).toEqual([]);
    expect(spans('10 REM {GRAPHICS RED}\n')).toEqual([]);
  });

  it('leaves a raw byte escape spelled out', () => {
    // {0xNN} has no display meaning to draw, and hiding a raw byte behind a
    // picture would hide what the program stores.
    expect(spans('10 PRINT "{0xA0}{0x7F}"\n')).toEqual([]);
  });

  it('leaves a brace that starts no escape alone', () => {
    expect(spans('10 PRINT "{NOT A CODE} {"\n')).toEqual([]);
  });

  it('finds escapes on every line of a program', () => {
    const doc = ['10 PRINT "{RED}A"', '20 PRINT "{CYAN}B"', '30 END'].join(
      '\n',
    );
    expect(spans(doc).map((s) => s[2])).toEqual(['{RED}', '{CYAN}']);
  });

  it('does not change the document', () => {
    const doc = '10 PRINT "{GRAPHICS WHITE}X"\n';
    const state = EditorState.create({ doc });
    controlChipDecorations(state, BBC_DISPLAY_CONTROLS, toMachine);
    expect(state.doc.toString()).toBe(doc);
    // ...and what the machine gets is still the escape's byte.
    expect([...toMachine('{GRAPHICS WHITE}')]).toEqual([0x97]);
  });

  it('covers every named teletext code', () => {
    // Every escape in the table is reachable: if one were missing a chip, or
    // spelled differently from the charset, it would silently stay text.
    for (const escape of Object.keys(BBC_DISPLAY_CONTROLS)) {
      const found = spans(`10 PRINT "${escape}"\n`);
      expect(
        found.map((s) => s[2]),
        escape,
      ).toEqual([escape]);
    }
  });
});
