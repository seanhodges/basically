// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { StringStream } from '@codemirror/language';
import { describe, expect, it } from 'vitest';
import { asmStreamParser } from './language';
import { m6502Engine } from './m6502';
import { z80Engine } from './z80';

/** Run one line through a parser, returning [tokenText, style] pairs. */
function tokenize(
  parser: ReturnType<typeof asmStreamParser>,
  line: string,
): Array<[string, string | null]> {
  const state = parser.startState!(2);
  const stream = new StringStream(line, 2, 2);
  const tokens: Array<[string, string | null]> = [];
  while (!stream.eol()) {
    stream.start = stream.pos;
    const style = parser.token(stream, state);
    tokens.push([stream.current(), style]);
  }
  return tokens;
}

describe('asm syntax highlighting', () => {
  const z80 = asmStreamParser(z80Engine);
  const m6502 = asmStreamParser(m6502Engine);

  it('classifies mnemonics, registers and numbers', () => {
    expect(tokenize(z80, 'LD A,$02')).toEqual([
      ['LD', 'keyword'],
      [' ', null],
      ['A', 'variableName'],
      [',', 'operator'],
      ['$02', 'number'],
    ]);
  });

  it('classifies label definitions and references', () => {
    expect(tokenize(z80, 'loop: DJNZ loop')).toEqual([
      ['loop:', 'labelName'],
      [' ', null],
      ['DJNZ', 'keyword'],
      [' ', null],
      ['loop', 'labelName'],
    ]);
  });

  it('greys out comments', () => {
    expect(tokenize(z80, 'RET ; done')).toEqual([
      ['RET', 'keyword'],
      [' ', null],
      ['; done', 'meta'],
    ]);
  });

  it('handles directives and every number spelling', () => {
    expect(tokenize(z80, 'DB 0FEh,%1010,0x12,42')).toEqual([
      ['DB', 'keyword'],
      [' ', null],
      ['0FEh', 'number'],
      [',', 'operator'],
      ['%1010', 'number'],
      [',', 'operator'],
      ['0x12', 'number'],
      [',', 'operator'],
      ['42', 'number'],
    ]);
  });

  it('understands 6502 spellings', () => {
    expect(tokenize(m6502, 'STA ($FB),Y')).toEqual([
      ['STA', 'keyword'],
      [' ', null],
      ['(', 'operator'],
      ['$FB', 'number'],
      [')', 'operator'],
      [',', 'operator'],
      ['Y', 'variableName'],
    ]);
  });
});
