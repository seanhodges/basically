// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  apple2UnnumberedLineKey,
  declaredWorkspace,
  isDirectLine,
  parseDirectLine,
  workspacePreamble,
} from './directLine';

describe('apple2 unnumbered lines', () => {
  it('reads the prompt commands a listing writes', () => {
    for (const text of [
      'NEW',
      'RUN',
      'CLR',
      'CON',
      'MAN',
      'LOAD',
      'SAVE',
      'LIST',
      'LIST 10,20',
      'DEL 10',
      'AUTO 10,10',
      'HIMEM:16384',
      'LOMEM:2048',
    ])
      expect(`${text}: ${isDirectLine(text)}`).toBe(`${text}: true`);
  });

  it('tolerates the spaces the interpreter crunches away', () => {
    // `HIMEM : 20000` typed at the machine leaves HIMEM at $4E20, exactly as
    // `HIMEM:20000` does.
    expect(parseDirectLine('HIMEM : 20000')).toEqual({
      kind: 'line',
      line: { command: 'HIMEM:', args: [20000], column: 0, endColumn: 13 },
    });
  });

  it('takes a negative operand, which is how the top of memory is written', () => {
    // Constants stop at 32767, so `HIMEM:49152` answers *** >32767 ERR and all
    // 48K is claimed with `HIMEM:-16384`.
    expect(declaredWorkspace('HIMEM:-16384').himem).toBe(0xc000);
    expect(parseDirectLine('HIMEM:49152')).toMatchObject({ kind: 'error' });
  });

  it('is not a command when the word merely opens the line', () => {
    for (const text of ['RUNNING=1', 'NEWLINE', 'LISTA', 'CONTACT'])
      expect(`${text}: ${isDirectLine(text)}`).toBe(`${text}: false`);
  });

  it('reports an operand count the command cannot take', () => {
    // AUTO alone answers *** SYNTAX ERR at the prompt; it wants a line number.
    expect(parseDirectLine('AUTO')).toMatchObject({ kind: 'error' });
    expect(parseDirectLine('NEW 10')).toMatchObject({ kind: 'error' });
    expect(parseDirectLine('LIST 1,2,3')).toMatchObject({ kind: 'error' });
  });

  it('refuses the Apple I spelling of the memory commands', () => {
    expect(parseDirectLine('HIMEM=4096')).toEqual({ kind: 'none' });
  });

  it('keys a line by the command, so two spellings merge', () => {
    expect(apple2UnnumberedLineKey('HIMEM : 4096')).toBe('HIMEM:');
    expect(apple2UnnumberedLineKey('HIMEM:4096')).toBe('HIMEM:');
    expect(apple2UnnumberedLineKey('10 END')).toBeNull();
  });

  it('restates only a workspace that is not the cold-start one', () => {
    expect(workspacePreamble(0x0800, 0xc000)).toEqual([]);
    expect(workspacePreamble(0x1000, 0x7000)).toEqual([
      'LOMEM:4096',
      'HIMEM:28672',
    ]);
    // Above 32767 it has to come back out as the negative that typed it.
    expect(workspacePreamble(0x0800, 0xa000)).toEqual(['HIMEM:-24576']);
  });

  it('falls back to the cold-start pair for bounds the machine cannot keep', () => {
    expect(declaredWorkspace('LOMEM:768').declared).toBe(false);
    expect(declaredWorkspace('HIMEM:1024\nLOMEM:2048').declared).toBe(false);
  });
});
