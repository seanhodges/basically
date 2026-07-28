import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram as tokenizeSpectrum } from '../zxspectrum/tokenizer';
import { detokenizeProgram as detokenizeSpectrum } from '../zxspectrum/detokenizer';

function bytes(src: string): number[] {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return Array.from(bytes);
}

describe('zxspectrum128 tokenizer', () => {
  it('tokenizes the 128-only PLAY (0xA4) and SPECTRUM (0xA3) keywords', () => {
    // 10 PLAY a$ -> body starts with the PLAY token.
    const play = bytes('10 PLAY a$\n');
    expect(play[4]).toBe(0xa4);
    // 20 SPECTRUM -> single SPECTRUM token then ENTER.
    expect(bytes('20 SPECTRUM\n').slice(4)).toEqual([0xa3, 0x0d]);
  });

  it('rejects PLAY/SPECTRUM on the 48K tokenizer (regression-proofs the split)', () => {
    // The 48K table omits both, so PLAY is not a valid statement opener there.
    expect(tokenizeSpectrum('10 PLAY a$\n').errors.length).toBe(1);
    expect(tokenizeSpectrum('10 SPECTRUM\n').errors.length).toBe(1);
  });

  it('expands 0xA3/0xA4 per dialect: SPECTRUM/PLAY on 128, UDGs on 48K', () => {
    // A line body of just the two 128-only token bytes.
    const prog = Uint8Array.from([0x00, 0x0a, 0x03, 0x00, 0xa3, 0xa4, 0x0d]);
    expect(detokenizeProgram(prog)).toBe('10 SPECTRUM PLAY\n');
    // The same bytes are the T and U UDGs to the 48K, which lacks these tokens.
    const on48k = detokenizeSpectrum(prog);
    expect(on48k).toContain('\u{1F143}');
    expect(on48k).toContain('\u{1F144}');
  });

  it('round-trips tokenize → detokenize for a 128 program', () => {
    const src =
      '10 REM 128 demo\n20 PLAY "cdefg"\n30 PRINT "back to 48"\n40 SPECTRUM\n';
    const first = tokenizeProgram(src);
    expect(first.errors).toEqual([]);
    const round = tokenizeProgram(detokenizeProgram(first.bytes));
    expect(Array.from(round.bytes)).toEqual(Array.from(first.bytes));
  });

  it('emits identical bytes to the 48K tokenizer for 48K-compatible code', () => {
    const src =
      '10 FOR i=1 TO 10 STEP 2\n20 PRINT AT 0,0;"x=";i\n30 IF i>5 THEN GO TO 50\n40 NEXT i\n50 STOP\n';
    const a = tokenizeProgram(src);
    const b = tokenizeSpectrum(src);
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    expect(Array.from(a.bytes)).toEqual(Array.from(b.bytes));
  });

  it('warns non-fatally on \\t/\\u UDG escapes (0xA3/0xA4 are tokens here)', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT "\\t"\n');
    // The byte is still stored (0xA3), so the program keeps building...
    expect(Array.from(bytes).slice(4)).toEqual([0xf5, 0x22, 0xa3, 0x22, 0x0d]);
    // ...but a non-fatal warning flags that it is not a real UDG on the 128K.
    expect(errors.length).toBe(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(errors[0]!.message).toMatch(/SPECTRUM/);
  });

  it('warns the same way on the T/U UDG characters, naming them', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT "\u{1F143}"\n');
    expect(Array.from(bytes).slice(4)).toEqual([0xf5, 0x22, 0xa3, 0x22, 0x0d]);
    expect(errors.length).toBe(1);
    expect(errors[0]!.fatal).toBe(false);
    // The message reads in the spelling the program used, not the other one.
    expect(errors[0]!.message).toContain('\u{1F143}');
    expect(errors[0]!.message).toContain('\u{1F130}-\u{1F142}');
    expect(errors[0]!.message).toMatch(/SPECTRUM/);
  });

  it('reports an error for a descending or out-of-range line number', () => {
    expect(tokenizeProgram('20 PRINT 1\n10 PRINT 2\n').errors.length).toBe(1);
    expect(tokenizeProgram('99999 PRINT 1\n').errors.length).toBe(1);
  });

  it('inherits the per-statement check for statements after the first', () => {
    const { errors } = tokenizeProgram('10 PRINT 1: PRNT 2\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(errors[0]!.message).toContain('PRNT');
  });

  it('drives that check from the 128 keyword table, not the 48K one', () => {
    // PLAY opens an inline statement fine here; on the 48K table, whose
    // statement keywords omit it, the same line is flagged.
    expect(tokenizeProgram('10 PRINT 1: PLAY "c"\n').errors).toEqual([]);
    expect(tokenizeSpectrum('10 PRINT 1: PLAY "c"\n').errors).toHaveLength(1);
  });
});
