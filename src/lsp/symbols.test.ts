// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { DocumentStore } from './documents';
import { documentSymbols } from './symbols';

function symbolsFor(dialectId: string, text: string) {
  const store = new DocumentStore();
  store.open('file:///a.bas', text, 1, dialectId);
  return documentSymbols(store.get('file:///a.bas')!);
}

describe('documentSymbols', () => {
  it('names procedures, functions and GOSUB targets on a machine that has them', () => {
    const text = [
      '10 PROCfoo',
      '20 GOSUB 100',
      '30 END',
      '40 DEF PROCfoo',
      '50 ENDPROC',
      '100 PRINT "HI"',
      '110 RETURN',
    ].join('\n');
    const symbols = symbolsFor('bbcmicro', text);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('PROCfoo');
    // The GOSUB target has no proc region, so it names its own line's row.
    const target = symbols.find((s) => s.range.start.line === 5);
    expect(target).toBeDefined();
  });

  it('names no kind of structure the machine lacks', () => {
    // Sinclair BASIC has no procedures - only subroutine (GOSUB) targets.
    const text = '10 GOSUB 100\n20 END\n100 PRINT "HI"\n110 RETURN';
    const symbols = symbolsFor('zx81', text);
    expect(symbols.every((s) => !s.name.startsWith('PROC'))).toBe(true);
    expect(symbols.length).toBeGreaterThan(0);
  });

  it('gives a procedure the range of its whole body, not just its header line', () => {
    const text = ['10 DEF PROCfoo', '20 PRINT "HI"', '30 ENDPROC'].join('\n');
    const symbols = symbolsFor('bbcmicro', text);
    const proc = symbols.find((s) => s.name === 'PROCfoo');
    expect(proc?.range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 2, character: '30 ENDPROC'.length },
    });
  });

  it('gives nothing for a declined document', () => {
    const store = new DocumentStore();
    store.open('file:///a.bas', '', 1, undefined);
    expect(documentSymbols(store.get('file:///a.bas')!)).toEqual([]);
  });
});
