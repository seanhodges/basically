import { describe, it, expect } from 'vitest';
import {
  zx81VariableErrors,
  c64VariableErrors,
  spectrumVariableErrors,
  zx80VariableErrors,
  trs80VariableErrors,
  atomVariableErrors,
} from './variableLint';
import { zx81Keywords } from '../dialects/zx81/keywords';
import { c64Keywords } from '../dialects/commodore64/keywords';
import { spectrumKeywords } from '../dialects/zxspectrum/keywords';
import { zx80EditorKeywords } from '../dialects/zx80/keywords';
import { trs80Keywords } from '../dialects/trs80/keywords';
import { atomKeywords } from '../dialects/atom/keywords';

const zx81 = (src: string) => zx81VariableErrors(src, zx81Keywords);
const c64 = (src: string) => c64VariableErrors(src, c64Keywords);
const spectrum = (src: string) => spectrumVariableErrors(src, spectrumKeywords);
const zx80 = (src: string) => zx80VariableErrors(src, zx80EditorKeywords);
const trs80 = (src: string) => trs80VariableErrors(src, trs80Keywords);
const atom = (src: string) => atomVariableErrors(src, atomKeywords);

describe('zx81VariableErrors', () => {
  it('flags a multi-letter string variable at its exact columns', () => {
    const errors = zx81('10 LET AB$="X"');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 1, column: 7, endColumn: 10 });
    expect(errors[0]!.message).toMatch(/string variable.*single letter/i);
  });

  it('allows a single-letter string variable', () => {
    expect(zx81('10 LET A$="X"')).toEqual([]);
  });

  it('allows multi-letter NUMERIC names (ROM-accurate, as the samples use)', () => {
    expect(zx81('10 LET BX=5\n20 LET APPLES=BX+1')).toEqual([]);
  });

  it('flags a multi-letter FOR control variable', () => {
    const errors = zx81('10 FOR IX=1 TO 9');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/FOR\/NEXT control variable/i);
  });

  it('allows a single-letter FOR control variable', () => {
    expect(zx81('10 FOR I=1 TO 9')).toEqual([]);
  });

  it('flags a multi-letter array name but allows a single-letter one', () => {
    expect(zx81('10 DIM AB(5)')[0]!.message).toMatch(/array.*single letter/i);
    expect(zx81('10 DIM A(5)')).toEqual([]);
  });
});

describe('c64VariableErrors', () => {
  it('flags two long names that collapse to the same first two chars', () => {
    const errors = c64('10 PLAYER=1\n20 PLANET=2');
    expect(errors).toHaveLength(2);
    for (const e of errors)
      expect(e.message).toMatch(/only the first two characters \('PL'\)/);
    // Each names the other colliding spelling.
    expect(errors[0]!.message).toContain('PLANET');
    expect(errors[1]!.message).toContain('PLAYER');
  });

  it('allows a lone long name (only the first two chars matter, but no clash)', () => {
    expect(c64('10 HEALTH=100')).toEqual([]);
  });

  it('does not flag names that differ within the first two chars', () => {
    expect(c64('10 PLAYER=1\n20 HEALTH=2')).toEqual([]);
  });

  it('treats a $ / % suffix as a distinct namespace (A vs A$)', () => {
    expect(c64('10 A=1\n20 A$="x"')).toEqual([]);
  });

  it('flags a name that embeds a reserved word', () => {
    const errors = c64('10 SCORE=1');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 1, column: 3, endColumn: 8 });
    expect(errors[0]!.message).toMatch(/embeds the reserved word 'OR'/);
  });

  it('leaves short, keyword-free names alone', () => {
    expect(c64('10 X=1\n20 HP=2')).toEqual([]);
  });
});

describe('spectrumVariableErrors (same single-letter model as ZX81)', () => {
  it('flags a multi-letter string but allows multi-letter numeric names', () => {
    expect(spectrum('10 LET AB$="X"')[0]!.message).toMatch(
      /ZX Spectrum string variable.*single letter/i,
    );
    expect(spectrum('10 LET score=bx+1')).toEqual([]);
  });

  it('flags a multi-letter array name', () => {
    expect(spectrum('10 DIM AB(5)')[0]!.message).toMatch(
      /array.*single letter/i,
    );
    expect(spectrum('10 DIM A(5)')).toEqual([]);
  });
});

describe('zx80VariableErrors (strict: every name a single letter)', () => {
  it('flags a multi-letter NUMERIC name (unlike the ZX81/Spectrum)', () => {
    const errors = zx80('10 LET AB=5');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(
      /ZX80 variable names must be a single letter/i,
    );
  });

  it('allows single-letter names', () => {
    expect(zx80('10 LET A=5\n20 FOR I=1 TO 9')).toEqual([]);
  });

  it('does not treat integral functions (PEEK, RND) as variables', () => {
    // ZX80 keeps functions in a separate table merged into zx80EditorKeywords;
    // the lint must use that combined list or it flags PEEK as a bad name.
    expect(zx80('10 LET A=PEEK(16396)\n20 LET B=RND(9)')).toEqual([]);
  });
});

describe('atomVariableErrors (strict single letter, no suffix, # hex)', () => {
  it('flags a multi-letter scalar but allows single letters', () => {
    expect(atom('10 AB=5')[0]!.message).toMatch(
      /Acorn Atom variable names must be a single letter/i,
    );
    expect(atom('10 A=5\n20 X=A+1')).toEqual([]);
  });

  it('does not mistake # hex, $ or ? indirection for variables', () => {
    expect(atom('10 A=?#DE\n20 !#8000=A')).toEqual([]);
  });
});

describe('trs80VariableErrors (Microsoft model with $%!# suffixes)', () => {
  it('flags a name that embeds a reserved word', () => {
    expect(trs80('10 SCORE=1')[0]!.message).toMatch(
      /TRS-80 variable name 'SCORE' embeds the reserved word 'OR'/,
    );
  });

  it('flags two long names colliding on the first two chars', () => {
    const errors = trs80('10 PLAYER=1\n20 PLANET=2');
    expect(errors).toHaveLength(2);
    for (const e of errors)
      expect(e.message).toMatch(/only the first two characters \('PL'\)/);
  });

  it('treats the ! / # type suffixes as part of the key, not the core', () => {
    // Distinct types (A vs A!) do not collide...
    expect(trs80('10 A=1\n20 A!=2')).toEqual([]);
    // ...but same-type long names still do (suffix stripped from the core).
    expect(trs80('10 PLAYER!=1\n20 PLANET!=2')).toHaveLength(2);
  });
});
