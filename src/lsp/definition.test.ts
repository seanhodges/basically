// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { DocumentStore } from './documents';
import { definitionAt } from './definition';

function defAt(
  dialectId: string,
  text: string,
  line: number,
  character: number,
) {
  const store = new DocumentStore();
  store.open('file:///a.bas', text, 1, dialectId);
  const doc = store.get('file:///a.bas')!;
  return definitionAt(doc, { line, character });
}

describe('definitionAt', () => {
  it('GOSUB 500 reaches line 500', () => {
    const text = '10 GOSUB 500\n500 PRINT "HI"\n510 RETURN';
    const target = defAt('zx81', text, 0, '10 GOSUB '.length);
    expect(target).toEqual({ line: 1, character: 0 });
  });

  it('a number no line has reaches nowhere', () => {
    const text = '10 GOSUB 999\n20 END';
    expect(defAt('zx81', text, 0, '10 GOSUB '.length)).toBeNull();
  });

  it('a number that is not a line reference is not treated as one', () => {
    const text = '10 LET A=999\n20 END';
    expect(defAt('zx81', text, 0, '10 LET A='.length)).toBeNull();
  });

  it('PROCfoo reaches its definition on bbcmicro', () => {
    const text = [
      '10 PROCfoo',
      '20 END',
      '30 DEF PROCfoo',
      '40 PRINT "HI"',
      '50 ENDPROC',
    ].join('\n');
    const target = defAt('bbcmicro', text, 0, 'PROC'.length + 1);
    expect(target).toEqual({ line: 2, character: 0 });
  });

  it('gives nothing for a declined document', () => {
    expect(defAt(undefined as never, '', 0, 0)).toBeNull();
  });
});
