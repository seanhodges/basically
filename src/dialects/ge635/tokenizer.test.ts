// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { hasFatalErrors } from '../types';
import { ge635 } from './index';
import { CR, LF, ge635Charset } from './charset';
import {
  MAX_LINE_NUMBER,
  MAX_PROGRAM_CHARACTERS,
  tokenizeProgram,
} from './tokenizer';
import { detokenizeProgram } from './detokenizer';

const PROGRAM = ['10 LET A$="HI"', '20 PRINT A$', '30 END'].join('\n');

/** The messages of the errors a source produces, in order. */
function messages(source: string): string[] {
  return tokenizeProgram(source).errors.map((e) => e.message);
}

describe('ge635 tokenizer', () => {
  it('punches the source as ASCII records closed by CR and LF', () => {
    const { program } = tokenizeProgram(PROGRAM);
    expect(ge635Charset.toUnicode(program)).toBe(
      '10 LET A$="HI"{0x0D}{0x0A}' +
        '20 PRINT A${0x0D}{0x0A}' +
        '30 END{0x0D}{0x0A}',
    );
    expect(program[program.length - 2]).toBe(CR);
    expect(program[program.length - 1]).toBe(LF);
  });

  it('gives the tape no terminator, because the manual names none', () => {
    // The GE-235's tape ends with an end-of-message code; ASCII has none, and
    // Appendix A says only that LISTNH punches "a format suitable for reading
    // into the teletype". So the image is the program, byte for byte.
    const { program, image } = tokenizeProgram(PROGRAM);
    expect(image).toEqual(program);
  });

  it('round-trips text and tape in both directions', () => {
    expect(detokenizeProgram(tokenizeProgram(PROGRAM).image)).toBe(PROGRAM);
    const image = tokenizeProgram(PROGRAM).image;
    const again = tokenizeProgram(detokenizeProgram(image));
    expect(again.image).toEqual(image);
    expect(again.errors).toEqual([]);
  });

  it('reads a tape framed with only one of the two line codes', () => {
    // Nothing in the manual says a tape must carry both, so a record ends at
    // either and an empty record is dropped rather than becoming a blank line.
    const codes = (text: string): number[] => [...ge635Charset.toMachine(text)];
    const cr = Uint8Array.from([...codes('10 END'), CR]);
    const lfOnly = Uint8Array.from([...codes('10 END'), LF]);
    expect(detokenizeProgram(cr)).toBe('10 END');
    expect(detokenizeProgram(lfOnly)).toBe('10 END');
  });

  it('canonicalises spacing around the line number but not inside the line', () => {
    const { image } = tokenizeProgram('  10    PRINT "A  B"   \n20 END');
    expect(detokenizeProgram(image)).toBe('10 PRINT "A  B"\n20 END');
  });

  it('reads a statement through the blanks, both GO TO spellings alike', () => {
    // 2.5 writes `250 G0 T0 999` and `G0T0` for the same statement, so the
    // blank cannot be significant to the match.
    for (const body of ['GO TO 10', 'GOTO 10', 'G O T O 10']) {
      expect(messages(`10 ${body}\n20 END`), body).toEqual([]);
    }
    expect(messages('10 FORI=1TO10\n20 NEXTI\n30 END')).toEqual([]);
  });

  it('matches the two RESTORE suffixes as their own statements', () => {
    expect(messages('10 RESTORE\n20 RESTORE*\n30 RESTORE$\n40 END')).toEqual(
      [],
    );
  });

  it('refuses a line number of more than five digits, fatally', () => {
    // 2.8's ILLEGAL LINE NUMBER: "of incorrect form, or contains more than
    // five digits".
    const { errors, image } = tokenizeProgram('100000 END');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('more than five digits');
    expect(hasFatalErrors(errors)).toBe(true);
    expect(image).toHaveLength(0);
    expect(messages(`${MAX_LINE_NUMBER} END`)).toEqual([]);
  });

  it('reports an out-of-order line without spoiling the tape', () => {
    const { errors, image } = tokenizeProgram('20 PRINT 1\n10 END');
    expect(errors.map((e) => e.message)).toEqual([
      'Line number 10 is not greater than the previous (20)',
      'END must have the highest line number in the program',
    ]);
    expect(hasFatalErrors(errors)).toBe(false);
    expect(image.length).toBeGreaterThan(0);
  });

  it('holds END to being the last line, and there being one', () => {
    // 1.7.9: "Every program must have an END statement, and it must be the
    // statement with the highest line number in the program."
    expect(messages('10 PRINT 1\n20 END')).toEqual([]);
    expect(messages('10 PRINT 1')).toEqual([
      'Program must end with an END statement',
    ]);
    // 2.8 notes END IS NOT LAST "also occurs if there are two or more END
    // statements in the program", which is what flagging all but the last says.
    expect(messages('10 END\n20 PRINT 1\n30 END')).toEqual([
      'END must have the highest line number in the program',
    ]);
    // Position is not the rule: an END written first but numbered last is
    // where 1.7.9 wants it.
    expect(messages('30 END\n10 PRINT 1').slice(1)).toEqual([]);
  });

  it('says to write the LET this BASIC never makes optional', () => {
    // 1.7.1 gives one form, LET [variable] = [formula]; 2.8's ILLEGAL
    // INSTRUCTION is what a line opening with anything else gets.
    expect(messages('10 A=1\n20 END')[0]).toBe(
      "Assignment needs LET: write 'LET A=1'",
    );
    expect(messages('10 A$="X"\n20 END')[0]).toBe(
      'Assignment needs LET: write \'LET A$="X"\'',
    );
    expect(messages('10 FLUMMOX 3\n20 END')[0]).toBe(
      "Statement must start with a BASIC command (got 'FLUMMOX')",
    );
  });

  it('leaves a line that is only an apostrophe remark alone', () => {
    // 2.5 gives the apostrophe as a tail and says nothing about a line that is
    // nothing else, so it is not reported as an instruction.
    expect(messages("10 ' WHY THIS RUNS\n20 END")).toEqual([]);
    expect(messages("10 LET A=1 ' SET A\n20 END")).toEqual([]);
  });

  it('underlines a character the Teletype cannot punch', () => {
    const { errors } = tokenizeProgram('10 PRINT "Ω"\n20 END');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('no GE-635 equivalent');
    expect(errors[0]!.line).toBe(1);
    expect(errors[0]!.column).toBe(10);
  });

  it('reports a program past the character budget 2.9 implies', () => {
    // C/4 + M + S < 8000, so a program with no arrays and no strings still
    // cannot pass MAX_PROGRAM_CHARACTERS.
    const body = '10 REM ' + 'X'.repeat(MAX_PROGRAM_CHARACTERS);
    const found = messages(`${body}\n20 END`).find((m) =>
      m.includes('characters'),
    );
    expect(found).toContain(String(MAX_PROGRAM_CHARACTERS));
    expect(messages('10 REM X\n20 END')).toEqual([]);
  });

  it('lints the names the fourth edition allows and the ones it does not', () => {
    // The dialect's lint is the tokenizer plus the variable rules: `$` is back,
    // but a list is still named by a bare letter.
    expect(ge635.lint('10 LET Z7$="Y"\n20 END')).toEqual([]);
    expect(ge635.lint('10 DIM L$(50)\n20 END')).toEqual([]);
    expect(ge635.lint('10 LET A1(3)=1\n20 END').map((e) => e.message)).toEqual([
      'GE-635 array names must be a single letter.',
    ]);
    expect(ge635.lint('10 LET AB=1\n20 END').map((e) => e.message)).toEqual([
      'GE-635 variable names are a single letter, optionally followed by one digit.',
    ]);
  });
});
