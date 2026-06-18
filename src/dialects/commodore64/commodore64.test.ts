import { describe, expect, it } from 'vitest';
import { commodore64 } from './index';
import { getDialect } from '../registry';

describe('Commodore 64 dialect', () => {
  it('is registered', () => {
    expect(getDialect('commodore64')).toBe(commodore64);
  });

  it('tokenizes to the $0801 .prg layout and round-trips', () => {
    const result = commodore64.tokenize('10 PRINT "HI"\n');
    expect(result.errors).toEqual([]);
    // .prg starts with the load address $01 $08, then the first line's link.
    expect(Array.from(result.image.slice(0, 4))).toEqual([
      0x01, 0x08, 0x0c, 0x08,
    ]);
    expect(result.image).toContain(0x99); // PRINT token
    // ends with the program's null link.
    expect(Array.from(result.image.slice(-2))).toEqual([0x00, 0x00]);
    expect(commodore64.detokenize(result.image)).toBe('10 PRINT "HI"\n');
  });

  it('reports an empty image (but no error) for a blank program', () => {
    expect(commodore64.tokenize('').image.length).toBe(0);
  });

  it('lint reports charset errors with line and column', () => {
    const errors = commodore64.lint('10 PRINT "OK"\n20 PRINT "█"');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(2);
    expect(errors[0]!.column).toBe(10);
  });

  it('declares a .prg binary import/export format', () => {
    expect(commodore64.binaryImports?.[0]?.extension).toBe('.prg');
    expect(commodore64.buildTargets.map((t) => t.fileExtension)).toContain(
      'prg',
    );
  });

  it('bundled samples lint clean', () => {
    for (const sample of commodore64.samples) {
      expect(commodore64.lint(sample.text)).toEqual([]);
    }
  });
});
