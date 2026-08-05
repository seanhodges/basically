// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { isAtOkPrompt, readAltair8800Report } from './reports';

/** The terminal as `readReport` sees it: rows top to bottom, right-trimmed. */
function screen(...rows: string[]): string[] {
  return [...rows, ...Array<string>(24 - rows.length).fill('')];
}

describe('readAltair8800Report', () => {
  it('reads a two-letter code and the line it happened in', () => {
    const report = readAltair8800Report(
      screen('RUN', '?SN ERROR IN 100', 'OK'),
    );
    expect(report).toEqual({
      isError: true,
      message: 'Syntax error',
      code: 'SN',
      line: 100,
    });
  });

  it('reports a direct-mode error, which has no line number', () => {
    const report = readAltair8800Report(screen('?FC ERROR', 'OK'));
    expect(report).toEqual({
      isError: true,
      message: 'Illegal function call',
      code: 'FC',
      line: undefined,
    });
  });

  it('reads the division-by-zero code, whose first character is not a letter', () => {
    const report = readAltair8800Report(screen('?/0 ERROR IN 20', 'OK'));
    expect(report?.code).toBe('/0');
    expect(report?.message).toBe('Division by zero');
  });

  it('finds an error that landed on the end of the program output', () => {
    // PRINT with a trailing semicolon leaves the carriage mid-line, and BASIC
    // only breaks the line when its own column counter says it must - so the
    // scan is not anchored to column 0 the way the Commodore one is.
    const report = readAltair8800Report(
      screen('COUNTING... ?OV ERROR IN 40', 'OK'),
    );
    expect(report?.isError).toBe(true);
    expect(report?.line).toBe(40);
  });

  it('still reports a code it has no sentence for, using the printed line', () => {
    const report = readAltair8800Report(screen('?ZZ ERROR IN 10', 'OK'));
    expect(report).toEqual({
      isError: true,
      message: '?ZZ ERROR IN 10',
      code: 'ZZ',
      line: 10,
    });
  });

  it('prefers the error to the OK that follows it', () => {
    // Both are on screen after a failed run: BASIC prints the error and then
    // returns to its prompt.
    expect(readAltair8800Report(screen('?TM ERROR IN 30', 'OK'))?.isError).toBe(
      true,
    );
  });

  it('reports a plain OK when BASIC is back at its prompt', () => {
    expect(readAltair8800Report(screen('RUN', 'HELLO', 'OK'))).toEqual({
      isError: false,
      message: 'OK',
    });
  });

  it('says nothing at all while a program is still printing', () => {
    expect(readAltair8800Report(screen('RUN', 'HELLO'))).toBeNull();
  });

  it('is not fooled by the word OK inside a line of output', () => {
    expect(readAltair8800Report(screen('RUN', 'LOOK OK NOW'))).toBeNull();
  });
});

describe('isAtOkPrompt', () => {
  it('ignores the blank rows below the prompt', () => {
    expect(isAtOkPrompt(screen('OK'))).toBe(true);
  });

  it('is false on an empty screen, which is a machine that has said nothing', () => {
    expect(isAtOkPrompt(screen())).toBe(false);
  });

  it('is false while the echoed RUN is the last thing printed', () => {
    expect(isAtOkPrompt(screen('OK', 'RUN'))).toBe(false);
  });
});
