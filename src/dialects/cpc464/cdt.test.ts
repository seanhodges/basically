import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { buildCdt, parseCdt, isCdt } from './cdt';

const SRC = '10 MODE 1\n20 PEN 2\n30 PRINT "HELLO"\n40 GOTO 30\n';
const program = (s = SRC): Uint8Array => tokenizeProgram(s).bytes;

describe('cpc464 .cdt tape image', () => {
  it('has the TZX signature and version', () => {
    const cdt = buildCdt(program(), 'hello');
    expect(new TextDecoder('latin1').decode(cdt.subarray(0, 8))).toBe(
      'ZXTape!\x1a',
    );
    expect(cdt[8]).toBe(1); // major
    expect(cdt[9]).toBe(20); // minor
    expect(isCdt(cdt)).toBe(true);
  });

  it('round-trips a tokenized program through build/parse', () => {
    const p = program();
    const decoded = parseCdt(buildCdt(p, 'hello'));
    expect(decoded.name).toBe('HELLO');
    expect(Array.from(decoded.program)).toEqual(Array.from(p));
    expect(decoded.warnings).toEqual([]);
  });

  it('carries each firmware record in its own turbo data block (&11)', () => {
    const cdt = buildCdt(program(), 'hello');
    let p = 10; // past signature + version
    const ids: number[] = [];
    // A one-block program is a header record + a data record => two &11 blocks.
    while (p < cdt.length) {
      const id = cdt[p]!;
      ids.push(id);
      expect(id).toBe(0x11);
      const len = cdt[p + 16]! | (cdt[p + 17]! << 8) | (cdt[p + 18]! << 16);
      p += 1 + 18 + len;
    }
    expect(ids).toEqual([0x11, 0x11]);
  });

  it('rejects a non-TZX buffer', () => {
    expect(isCdt(Uint8Array.from([0, 1, 2, 3]))).toBe(false);
    expect(() => parseCdt(Uint8Array.from([0, 1, 2, 3]))).toThrow(/cdt/i);
  });
});
