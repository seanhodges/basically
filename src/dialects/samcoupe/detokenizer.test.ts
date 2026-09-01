import { describe, it, expect } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithWarnings } from './detokenizer';

/** A program exercising the spacing rules LIST applies to each token range. */
const PROGRAM = [
  '10 REM SAM demo',
  '20 MODE 4: PALETTE 1,127: PEN 15: PAPER 0: CLS',
  '30 LET x=10: LET name$="SAM"',
  '40 FOR i=1 TO 10 STEP 2',
  '50 PRINT AT i,0;"row ";i;" ";LEN name$',
  '60 NEXT i',
  '70 IF x>5 THEN PRINT "big": ELSE PRINT "small"',
  '80 IF x>=5 AND x<>7',
  '90 PRINT INT (x/2) MOD 3',
  '100 END IF',
  '110 DO WHILE x>0',
  '120 LET x=x-1',
  '130 LOOP',
  '140 DEF PROC greet n$',
  '150 PRINT "hello ";n$',
  '160 END PROC',
  '170 greet "world"',
  '180 POKE &8000,BIN 10101010',
  '190 PRINT PI*2,SIN 1,CHR$ 65,POINT(1,2)',
  '200 DEF FN f(x)=x*x',
  '210 GO SUB 300: GO TO 220',
  '220 PRINT USING "###.##";1.5',
  '300 RETURN',
].join('\n');

describe('samcoupe detokenizer', () => {
  it('lists a program back exactly as it was written', () => {
    const { bytes, errors } = tokenizeProgram(PROGRAM);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(bytes)).toBe(PROGRAM);
  });

  it('re-tokenizes its own listing to the same bytes', () => {
    const first = tokenizeProgram(PROGRAM).bytes;
    const again = tokenizeProgram(detokenizeProgram(first)).bytes;
    expect(Array.from(again)).toEqual(Array.from(first));
  });

  it('spaces each token range the way the ROM LIST does', () => {
    // A command takes a space either side; a calculator function only a
    // trailing one; an immediate function neither, its argument being
    // bracketed or absent; and the three comparisons neither.
    const line = (b: number[]) =>
      detokenizeProgram(
        Uint8Array.from([0, 10, b.length + 1, 0, ...b, 0x0d]),
      ).slice(3);
    expect(line([0xbb, 0xff, 0x6b, 0x61, 0x24])).toBe('PRINT LEN a$');
    expect(line([0xbb, 0xff, 0x3b])).toBe('PRINT PI');
    expect(line([0x61, 0xff, 0x83, 0x62])).toBe('a>=b');
    expect(line([0x61, 0xff, 0x7a, 0x62])).toBe('a MOD b');
    // Both IF tokens and both ELSE tokens list back as the one word.
    expect(line([0xd7])).toBe('IF');
    expect(line([0xd8])).toBe('IF');
    expect(line([0xd9])).toBe('ELSE');
    expect(line([0xda])).toBe('ELSE');
  });

  it('stops at the end-of-program stopper and reports a broken line', () => {
    const { bytes } = tokenizeProgram('10 CLS\n20 CLS');
    const withStopper = Uint8Array.from([...bytes, 0xff, 0xff]);
    expect(detokenizeProgram(withStopper)).toBe('10 CLS\n20 CLS');
    // A length promising more than the image holds ends the walk with a note
    // rather than reading past the end.
    const truncated = bytes.slice(0, bytes.length - 2);
    const report = detokenizeWithWarnings(truncated);
    expect(report.source).toBe('10 CLS');
    expect(report.warnings[0]).toContain('claims');
  });
});
