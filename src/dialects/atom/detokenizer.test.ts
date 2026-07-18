import { describe, expect, it } from 'vitest';
import { ATM_HEADER_SIZE, buildAtm } from './atm';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';

/** Hand-build a `.atm` file (header + payload) at an arbitrary load address. */
function makeAtm(
  name: string,
  load: number,
  data: Uint8Array,
  exec = load,
): Uint8Array {
  const out = new Uint8Array(ATM_HEADER_SIZE + data.length);
  for (let i = 0; i < name.length && i < 16; i++) out[i] = name.charCodeAt(i);
  const u16 = (off: number, v: number) => {
    out[off] = v & 0xff;
    out[off + 1] = (v >> 8) & 0xff;
  };
  u16(16, load); // load address
  u16(18, exec); // exec address
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
    expect(block.name).toBe('CODE');
    expect(block.name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    expect(block.address).toBe(0x3000);
    expect(block.kind).toBe('code');
    // makeAtm defaults exec = load, so the block carries that entry address.
    expect(block.entry).toBe(0x3000);
    expect(Array.from(block.bytes)).toEqual(Array.from(data));
    // The block owns a copy, decoupled from the source file bytes.
    expect(block.bytes.buffer).not.toBe(atm.buffer);
  });

  it('carries a distinct exec address through as the block entry', () => {
    const data = new Uint8Array([0xea, 0xa9, 0x01, 0x60]);
    const atm = makeAtm('BOOT', 0x8200, data, 0x8201);
    const result = detokenizeProgramWithReport(atm);
    expect(result.blocks![0]!.entry).toBe(0x8201);
    expect(result.warnings[0]).toContain('8201');
    expect(result.warnings[0]).toContain('LINK');
  });

  it('records no entry when the exec address is 0', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const atm = makeAtm('DATA', 0x3000, data, 0);
    const result = detokenizeProgramWithReport(atm);
    expect('entry' in result.blocks![0]!).toBe(false);
    expect(result.warnings[0]).not.toContain('LINK');
  });

  it('falls back to a generated block name for an unusable .atm name', () => {
    const data = new Uint8Array([0x60]);
    const result = detokenizeProgramWithReport(makeAtm('', 0x3000, data));
    expect(result.blocks![0]!.name).toBe('code1');
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
