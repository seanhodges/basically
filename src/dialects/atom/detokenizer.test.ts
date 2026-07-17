import { describe, expect, it } from 'vitest';
import { ATM_HEADER_SIZE, buildAtm } from './atm';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';

/** Hand-build a `.atm` file (header + payload) at an arbitrary load address. */
function makeAtm(name: string, load: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(ATM_HEADER_SIZE + data.length);
  for (let i = 0; i < name.length && i < 16; i++) out[i] = name.charCodeAt(i);
  const u16 = (off: number, v: number) => {
    out[off] = v & 0xff;
    out[off + 1] = (v >> 8) & 0xff;
  };
  u16(16, load); // load address
  u16(18, load); // exec address
  u16(20, data.length); // data length
  out.set(data, ATM_HEADER_SIZE);
  return out;
}

describe('detokenizeProgramWithReport', () => {
  it('imports a non-#2900 .atm as a memory block with empty source', () => {
    const data = new Uint8Array([0xa9, 0x01, 0x85, 0x50, 0x60]); // some 6502
    const atm = makeAtm('CODE', 0x3000, data);
    const result = detokenizeProgramWithReport(atm);

    expect(result.source).toBe('');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('3000');
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks![0]!;
    expect(block.id).toBe('imported-code-1');
    expect(block.name).toBe('code1');
    expect(block.name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    expect(block.address).toBe(0x3000);
    expect(block.kind).toBe('code');
    expect(Array.from(block.bytes)).toEqual(Array.from(data));
    // The block owns a copy, decoupled from the source file bytes.
    expect(block.bytes.buffer).not.toBe(atm.buffer);
  });

  it('decodes a #2900 BASIC .atm to source with no blocks', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT "HI"\n20 GOTO 10\n');
    expect(errors).toEqual([]);
    const atm = buildAtm(bytes, 'DEMO');
    const result = detokenizeProgramWithReport(atm);

    expect(result.source).toContain('10');
    expect(result.source).toContain('GOTO 10');
    expect(result.warnings).toEqual([]);
    expect(result.blocks).toBeUndefined();
  });

  it('leaves detokenizeProgram empty for a non-#2900 .atm', () => {
    const atm = makeAtm('CODE', 0x3000, new Uint8Array([0xa9, 0x01, 0x60]));
    expect(detokenizeProgram(atm)).toBe('');
  });
});
