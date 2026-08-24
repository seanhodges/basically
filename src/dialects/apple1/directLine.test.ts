// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { APPLE1_DIRECT_ONLY } from './keywords';
import {
  DIRECT_COMMANDS,
  apple1UnnumberedLineKey,
  declaredWorkspace,
  isDirectLine,
  parseDirectLine,
  workspacePreamble,
} from './directLine';

/** The command an accepted line commands, or the reason it was refused. */
function read(text: string): string {
  const parsed = parseDirectLine(text);
  if (parsed.kind === 'none') return 'none';
  if (parsed.kind === 'error') return `error: ${parsed.message}`;
  return [parsed.line.command, ...parsed.line.args].join(' ');
}

describe('parseDirectLine', () => {
  it('covers exactly the commands the tokenizer refuses inside a line', () => {
    expect([...DIRECT_COMMANDS].sort()).toEqual([...APPLE1_DIRECT_ONLY].sort());
  });

  it.each([
    ['SCR', 'SCR'],
    ['CLR', 'CLR'],
    ['OFF', 'OFF'],
    ['RUN', 'RUN'],
    ['LIST', 'LIST'],
    ['LOMEM=768', 'LOMEM= 768'],
    ['HIMEM=4096', 'HIMEM= 4096'],
    ['RUN 100', 'RUN 100'],
    ['LIST 10,20', 'LIST 10 20'],
    ['DEL 10,20', 'DEL 10 20'],
    ['DEL 10', 'DEL 10'],
    ['AUTO 10,10', 'AUTO 10 10'],
    ['AUTO 100', 'AUTO 100'],
  ])('reads %s', (src, expected) => {
    expect(read(src)).toBe(expected);
  });

  it('folds case and skips spaces the way the interpreter does', () => {
    expect(read('lomem = 768')).toBe('LOMEM= 768');
    expect(read('  Scr  ')).toBe('SCR');
    expect(read('list 10 , 20')).toBe('LIST 10 20');
  });

  it('reports the command word, not the indent, as the column', () => {
    const parsed = parseDirectLine('   LOMEM=768');
    expect(parsed.kind === 'line' && parsed.line.column).toBe(3);
  });

  /**
   * The ROM crunches greedily, so `RUNNING` really does begin with the RUN
   * token there. Here the operands have to parse as well, which is what keeps
   * an ordinary line that happens to start with a command word out of this
   * path and on the one that reports it as missing its number.
   */
  it.each(['RUNNING', 'SCREEN', 'LISTA', 'CLRX', 'OFFSET', 'DELTA=1'])(
    'does not take %s for a command',
    (src) => {
      expect(read(src)).toBe('none');
    },
  );

  it('does not accept the Apple II spelling without the equals', () => {
    expect(read('LOMEM 768')).toBe('none');
    expect(read('HIMEM 4096')).toBe('none');
  });

  it('reports operands the command cannot take', () => {
    expect(read('SCR 1')).toContain('takes no arguments');
    expect(read('DEL')).toContain('needs a number');
    expect(read('LOMEM=')).toContain('needs a number');
    expect(read('RUN 10,20')).toContain('at most 1');
    expect(read('LOMEM=40000')).toContain('over 32767');
  });

  it('leaves a numbered line alone', () => {
    expect(read('10 PRINT "HI"')).toBe('none');
    expect(read('')).toBe('none');
  });

  it('answers a merge key that ignores the operand', () => {
    expect(apple1UnnumberedLineKey('LOMEM=768')).toBe('LOMEM=');
    expect(apple1UnnumberedLineKey('lomem = 1024')).toBe('LOMEM=');
    expect(apple1UnnumberedLineKey('10 PRINT')).toBeNull();
    expect(isDirectLine('RUN')).toBe(true);
    expect(isDirectLine('PRINT 1')).toBe(false);
  });
});

describe('declaredWorkspace', () => {
  it('is the stock pair when the listing asks for nothing', () => {
    expect(declaredWorkspace('10 END')).toEqual({
      lomem: 0x0800,
      himem: 0x1000,
      declared: false,
    });
  });

  it('reads a preamble', () => {
    expect(declaredWorkspace('SCR\nLOMEM=768\nHIMEM=4096\n10 END')).toEqual({
      lomem: 768,
      himem: 4096,
      declared: true,
    });
  });

  it('takes the last of a repeated bound, as each overwrites the pointer', () => {
    expect(declaredWorkspace('LOMEM=768\nLOMEM=1024\n10 END').lomem).toBe(1024);
  });

  it('defaults the bound the listing left alone', () => {
    expect(declaredWorkspace('LOMEM=768\n10 END')).toEqual({
      lomem: 768,
      himem: 0x1000,
      declared: true,
    });
  });

  /** The lint path builds with whatever this answers, so it must never be unusable. */
  it.each(['LOMEM=100\n10 END', 'HIMEM=8192\n10 END', 'LOMEM=4096\nHIMEM=768'])(
    'falls back to the stock pair for %s',
    (src) => {
      expect(declaredWorkspace(src).declared).toBe(false);
    },
  );

  it('ignores a command word inside a numbered line', () => {
    expect(declaredWorkspace('10 REM LOMEM=768').declared).toBe(false);
  });
});

describe('workspacePreamble', () => {
  it('says nothing about the stock pair', () => {
    expect(workspacePreamble(0x0800, 0x1000)).toEqual([]);
  });

  it('restates only the bound that moved, LOMEM first', () => {
    expect(workspacePreamble(768, 0x1000)).toEqual(['LOMEM=768']);
    expect(workspacePreamble(0x0800, 2048)).toEqual(['HIMEM=2048']);
    // 4096 is the stock HIMEM, so a listing that names it is restating the
    // default and the recovered text has nothing to say about it.
    expect(workspacePreamble(768, 4096)).toEqual(['LOMEM=768']);
    expect(workspacePreamble(768, 2048)).toEqual(['LOMEM=768', 'HIMEM=2048']);
  });
});
