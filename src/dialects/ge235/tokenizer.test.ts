// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { hasFatalErrors } from '../types';
import { ge235 } from './index';
import { CR, EOM, ge235Charset } from './charset';
import { MAX_LINE_NUMBER, MAX_LINES, tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';

const PROGRAM = ['10 LET A=1', '20 PRINT A', '30 END'].join('\n');

/** The messages of the errors a source produces, in order. */
function messages(source: string): string[] {
  return tokenizeProgram(source).errors.map((e) => e.message);
}

describe('ge235 tokenizer', () => {
  it('punches the source as CR-separated BCD records ending in EOM', () => {
    const { program, image } = tokenizeProgram(PROGRAM);
    expect(ge235Charset.toUnicode(program)).toBe(
      `10 LET A=1{0o37}20 PRINT A{0o37}30 END{0o37}`,
    );
    expect(image.slice(0, program.length)).toEqual(program);
    expect([...image.slice(program.length)]).toEqual([EOM]);
    expect(program[program.length - 1]).toBe(CR);
  });

  it('round-trips text and tape in both directions', () => {
    expect(detokenizeProgram(tokenizeProgram(PROGRAM).image)).toBe(PROGRAM);
    // The direction the import path cares about: an image decodes to text that
    // re-encodes to the same bytes.
    const image = tokenizeProgram(PROGRAM).image;
    const again = tokenizeProgram(detokenizeProgram(image));
    expect(again.image).toEqual(image);
    expect(again.errors).toEqual([]);
  });

  it('canonicalises spacing around the line number but not inside the line', () => {
    const { image } = tokenizeProgram('  10    PRINT "A  B"   \n20 END');
    expect(detokenizeProgram(image)).toBe('10 PRINT "A  B"\n20 END');
  });

  it('reads a statement through the blanks the compiler deletes', () => {
    // `trans` throws every blank outside a string literal away before the
    // decoder sees the line, so these are PRINT and GOTO, not lint errors.
    expect(messages('10 P R I N T 1\n20 GO TO 10\n30 END')).toEqual([]);
  });

  it('reports a line the q jump table could not decode', () => {
    // LET is not optional in 1965: a line opening with a letter reaches the
    // jump table's `a` slot and stops there.
    expect(messages('10 A=1\n20 END')).toEqual([
      "Assignment needs LET: write 'LET A=1'",
    ]);
    expect(messages('10 RESTORE\n20 END')).toEqual([
      "Statement must start with a BASIC command (got 'RESTORE')",
    ]);
  });

  it('keeps statement-shape lint non-fatal, so the tape is still punched', () => {
    const { errors, image } = tokenizeProgram('10 A=1\n20 END');
    expect(errors.every((e) => e.fatal === false)).toBe(true);
    expect(detokenizeProgram(image)).toBe('10 A=1\n20 END');
  });

  it('requires END, and requires it last', () => {
    expect(messages('10 PRINT 1')).toEqual([
      'Program must end with an END statement',
    ]);
    expect(messages('10 END\n20 PRINT 1')).toEqual([
      'END must be the last line of the program',
    ]);
    expect(messages('')).toEqual([]);
  });

  it('reports the line-number rules the compiler enforces', () => {
    expect(messages('PRINT 1')).toEqual(['Missing line number']);
    expect(messages(`${MAX_LINE_NUMBER + 1} END`)).toEqual([
      `Line number 100000 out of range 0–${MAX_LINE_NUMBER}`,
    ]);
    expect(messages('20 PRINT 1\n10 END')).toEqual([
      'Line number 10 is not greater than the previous (20)',
    ]);
    const long = Array.from(
      { length: MAX_LINES + 1 },
      (_, i) => `${i + 1} END`,
    ).join('\n');
    expect(messages(long)).toContain(
      `Program is longer than ${MAX_LINES} lines`,
    );
  });

  it('reports an untypeable character as fatal', () => {
    const { errors } = tokenizeProgram('10 PRINT "café"\n20 END');
    expect(errors[0]).toMatchObject({
      line: 1,
      column: 13,
      message: 'Character "é" has no GE-235 equivalent',
    });
    // Fatal, so the dialect hands the run path no image at all.
    expect(hasFatalErrors(errors)).toBe(true);
    expect(ge235.tokenize('10 PRINT "café"\n20 END').image).toHaveLength(0);
  });

  it('drops tape records that carry no line', () => {
    // A bare CR, and a record of nothing but spaces: the compiler answers
    // either with "illegal instruction", so neither is program text.
    const tape = Uint8Array.from([
      ...ge235Charset.toMachine('10 END'),
      CR,
      CR,
      ...ge235Charset.toMachine('  '),
      CR,
      EOM,
      ...ge235Charset.toMachine('IGNORED'),
    ]);
    expect(detokenizeProgram(tape)).toBe('10 END');
  });
});
