// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { MAX_LINE_NUMBER, PROGRAM_BASE } from './addresses';

/** The tokenized body of the first line, links and terminator stripped. */
function firstBody(source: string): number[] {
  const { program } = tokenizeProgram(source);
  const end = program.indexOf(0x00, 4);
  return [...program.slice(4, end)];
}

const bytes = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

describe('sorcerer tokenizer', () => {
  it('lays out linked lines from the interpreter’s program base', () => {
    const { program, errors } = tokenizeProgram('10 END\n20 END\n');
    expect(errors).toEqual([]);
    // link, line number, body, terminator - twice - then the null link.
    expect([...program]).toEqual([
      0xdb, 0x01, 0x0a, 0x00, 0x80, 0x00, 0xe1, 0x01, 0x14, 0x00, 0x80, 0x00,
      0x00, 0x00,
    ]);
    expect(program[0]! | (program[1]! << 8)).toBe(PROGRAM_BASE + 6);
  });

  it('crunches: FORI=1TO5 tokenizes as FOR I=1 TO 5', () => {
    expect(firstBody('10 FORI=1TO5')).toEqual([
      0x81, 0x49, 0xad, 0x31, 0x9f, 0x35,
    ]);
    // Spaces are stored, and do not stop the match either side of them.
    expect(firstBody('10 FOR I=1 TO 5')).toEqual([
      0x81, 0x20, 0x49, 0xad, 0x31, 0x20, 0x9f, 0x20, 0x35,
    ]);
  });

  it('does not skip a space while matching', () => {
    // `PR INT 1` keeps its P and R and then tokenizes the INT.
    expect(firstBody('10 PR INT 1')).toEqual([
      0x50, 0x52, 0x20, 0xb0, 0x20, 0x31,
    ]);
  });

  it('folds a lower-case keyword and a lower-case name', () => {
    expect(firstBody('10 print abc')).toEqual([0x97, 0x20, ...bytes('ABC')]);
  });

  it('enters ? as PRINT', () => {
    expect(firstBody('10 ?1')).toEqual([0x97, 0x31]);
    expect(detokenizeProgram(tokenizeProgram('10 ?1').program)).toBe(
      '10 PRINT1\n',
    );
  });

  it('stores REM and DATA text verbatim', () => {
    expect(firstBody('10 REM aB cD')).toEqual([0x8f, 0x20, ...bytes('aB cD')]);
    // DATA runs to an unquoted ':', after which tokenizing resumes.
    expect(firstBody('10 DATA to,for:END')).toEqual([
      0x83,
      0x20,
      ...bytes('to,for'),
      0x3a,
      0x80,
    ]);
  });

  it('leaves a keyword spelling inside a string alone', () => {
    expect(firstBody('10 PRINT "FOR"')).toEqual([
      0x97,
      0x20,
      0x22,
      ...bytes('FOR'),
      0x22,
    ]);
  });

  it('carries a graphics character through a string literal', () => {
    expect(firstBody('10 PRINT "▌"')).toEqual([0x97, 0x20, 0x22, 0xa7, 0x22]);
  });

  it('round-trips a program through tokenize and detokenize', () => {
    const source = [
      '10 REM a sorcerer program',
      '20 FORI=1TO5',
      '30 PRINT "▌▒{0x8D}";I',
      '40 DATA 1,2,3:NEXTI',
      '50 IF I<>0 THEN 20',
      '60 END',
      '',
    ].join('\n');
    const { program, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(program)).toBe(source);
  });

  it('reports errors rather than throwing', () => {
    const { errors } = tokenizeProgram('PRINT 1\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      line: 1,
      message: 'Missing line number',
    });

    const tooBig = tokenizeProgram(`${MAX_LINE_NUMBER + 1} END\n`).errors;
    expect(tooBig[0]!.message).toContain('out of range');

    // Statement-shape lint is non-fatal: the line is still stored, exactly as
    // the interpreter stores it and then refuses it at RUN time.
    const odd = tokenizeProgram('10 XYZZY\n');
    expect(odd.errors[0]).toMatchObject({ fatal: false });
    expect(odd.program.length).toBeGreaterThan(2);

    // Out-of-order lines are lint too, not a framing error.
    const back = tokenizeProgram('20 END\n10 END\n');
    expect(back.errors[0]).toMatchObject({ fatal: false });
    expect(back.errors[0]!.message).toContain('not greater than');

    // A character with no code reports where it is and keeps going.
    const bad = tokenizeProgram('10 PRINT "é"\n');
    expect(bad.errors[0]!.line).toBe(1);
    expect(bad.errors[0]!.message).toContain('no Sorcerer equivalent');
  });

  it('refuses a 0x00 byte inside a line', () => {
    const { errors } = tokenizeProgram('10 PRINT "{0x00}"\n');
    expect(errors[0]!.message).toContain('0x00 ends the line');
    expect(errors[0]!.fatal).not.toBe(false);
  });
});
