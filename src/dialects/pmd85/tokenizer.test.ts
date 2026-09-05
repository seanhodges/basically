// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { pmd85Keywords } from './keywords';
import { MAX_LINE_NUMBER, PROGRAM_BASE } from './addresses';

/** The tokenized body of the first (and usually only) line of `source`. */
function body(source: string): number[] {
  const { program } = tokenizeProgram(source);
  const out: number[] = [];
  for (let i = 4; program[i] !== 0x00; i++) out.push(program[i]!);
  return out;
}

const fatal = (source: string): string[] =>
  tokenizeProgram(source)
    .errors.filter((e) => e.fatal !== false)
    .map((e) => e.message);

describe('pmd85 tokenizer', () => {
  it('lays a line out as link, number, body, terminator', () => {
    const { program, errors } = tokenizeProgram('10 END\n20 END\n');
    expect(errors).toEqual([]);
    // Two six-byte records (link, number, one token, terminator) and the null
    // link, with each link the absolute address of the record after it.
    expect([...program]).toEqual([
      0x07, 0x24, 0x0a, 0x00, 0x80, 0x00, 0x0d, 0x24, 0x14, 0x00, 0x80, 0x00,
      0x00, 0x00,
    ]);
    expect(program[0]! | (program[1]! << 8)).toBe(PROGRAM_BASE + 6);
  });

  it('tokenizes each keyword to the byte the ROM table gives it', () => {
    for (const kw of pmd85Keywords) {
      // Every keyword after a `PRINT` opener, so the statement lint stays
      // quiet whatever the keyword's kind is.
      expect(body(`10 PRINT ${kw.word}`), kw.word).toEqual([
        0x96,
        0x20,
        kw.token,
      ]);
    }
  });

  it('crunches without delimiters, the way the ROM does', () => {
    expect(body('10 FORI=1TO5')).toEqual([0x81, 0x49, 0xac, 0x31, 0x9e, 0x35]);
  });

  it('does not skip spaces while matching - except in GOTO', () => {
    // `PR INT` keeps its P and R and then tokenizes INT.
    expect(body('10 PR INT 1')).toEqual([0x50, 0x52, 0x20, 0xaf, 0x20, 0x31]);
    // GOTO is the one word the crunch matches across spaces.
    expect(body('10 GOTO 100')).toEqual([0x88, 0x20, 0x31, 0x30, 0x30]);
    expect(body('10 GO TO 100')).toEqual([0x88, 0x20, 0x31, 0x30, 0x30]);
    expect(body('10 G O T O 100')).toEqual([0x88, 0x20, 0x31, 0x30, 0x30]);
  });

  it('stores ? as the _ token, the way the crunch substitutes it', () => {
    expect(body('10 ?"HI"')).toEqual([0xce, 0x22, 0x48, 0x49, 0x22]);
    expect(body('10 _"HI"')).toEqual([0xce, 0x22, 0x48, 0x49, 0x22]);
    expect(body('10 PRINT"HI"')).toEqual([0x96, 0x22, 0x48, 0x49, 0x22]);
  });

  it('folds a lower-case keyword, and leaves a literal alone', () => {
    expect(body('10 print "Hi"')).toEqual([0x96, 0x20, 0x22, 0x48, 0x69, 0x22]);
  });

  it('reports the folded keyword the ROM would have refused', () => {
    // The dialect is deliberately lenient - a lower-case listing is what a
    // reader pastes in - but the ROM's crunch compares raw bytes against an
    // upper-case table, so the real machine would store five characters and
    // fail at RUN. Being lenient about what can be opened is not a claim the
    // machine will run it.
    const { errors, program } = tokenizeProgram('10 print "HI"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/Lower-case keyword 'print'/);
    expect(errors[0]!.message).toMatch(/PRINT/);
    expect(errors[0]!.fatal).toBe(false);
    // ...and it changes nothing about the bytes, nor blocks the build.
    expect(body('10 print "HI"')).toEqual(body('10 PRINT "HI"'));
    expect(program.length).toBeGreaterThan(2);
  });

  it('says nothing about a keyword spelled the way the ROM wants', () => {
    expect(tokenizeProgram('10 PRINT "HI"\n').errors).toEqual([]);
  });

  it('leaves a hexadecimal literal uncrunched after the apostrophe', () => {
    // Without the `'` rule the ABS in `'ABS` would tokenize; with it, the A
    // and B are hex digits and only the S falls back to the main scan.
    expect(body("10 A='FF")).toEqual([0x41, 0xac, 0x27, 0x46, 0x46]);
    expect(body("10 A='ABS")).toEqual([0x41, 0xac, 0x27, 0x41, 0x42, 0x53]);
  });

  it('stores REM and DATA bodies verbatim', () => {
    expect(body('10 REM PRINT END')).toEqual([
      0x8e, 0x20, 0x50, 0x52, 0x49, 0x4e, 0x54, 0x20, 0x45, 0x4e, 0x44,
    ]);
    // DATA stays verbatim until a colon, then tokenizing resumes.
    expect(body('10 DATA END:PRINT')).toEqual([
      0x83, 0x20, 0x45, 0x4e, 0x44, 0x3a, 0x96,
    ]);
  });

  it('round-trips a program through tokenize and detokenize', () => {
    const source = [
      '10 REM PMD 85 DEMO',
      '20 GCLEAR:SCALE 0,255,0,255',
      '30 FOR I=0 TO 255 STEP 8',
      '40 MOVE 0,I:PLOT 255,I',
      '50 NEXT I',
      '60 PRINT AT 0,0;"DONE";CHR$(13)',
      '70 DATA 1,2,3',
      '80 IF INKEY=255 THEN 80',
      '90 END',
      '',
    ].join('\n');
    const { program, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(program)).toBe(source);
    expect([...tokenizeProgram(detokenizeProgram(program)).program]).toEqual([
      ...program,
    ]);
  });

  it('reports a missing or out-of-range line number without throwing', () => {
    expect(fatal('PRINT 1\n')).toEqual(['Missing line number']);
    expect(fatal(`${MAX_LINE_NUMBER + 1} END\n`)).toEqual([
      `Line number 32768 out of range 0–${MAX_LINE_NUMBER}`,
    ]);
    expect(fatal(`${MAX_LINE_NUMBER} END\n`)).toEqual([]);
  });

  it('flags a statement the interpreter would reject, but still builds', () => {
    const { program, errors } = tokenizeProgram('10 XYZZY\n');
    expect(errors.map((e) => [e.message, e.fatal])).toEqual([
      [
        "Statement must start with a BASIC command or assignment (got 'XYZZY')",
        false,
      ],
    ]);
    expect(program.length).toBeGreaterThan(2);
  });

  it('refuses a 0x00 byte in a line, which would end the record', () => {
    expect(fatal('10 PRINT "{0x00}"\n')).toEqual([
      'A {0x00} byte cannot appear in a program line — 0x00 ends the line',
    ]);
  });

  it('reports an unmappable character rather than dropping it', () => {
    expect(fatal('10 PRINT "ě"\n')).toEqual([
      'Character "ě" has no PMD 85 equivalent',
    ]);
  });

  it('warns about out-of-order lines without refusing them', () => {
    const { errors } = tokenizeProgram('20 END\n10 END\n');
    expect(errors.map((e) => e.fatal)).toEqual([false]);
    expect(errors[0]!.message).toMatch(/not greater than the previous/);
  });
});
