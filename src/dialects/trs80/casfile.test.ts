import { describe, expect, it } from 'vitest';
import {
  buildCasImage,
  casFormat,
  casNameByte,
  isCasImage,
  isSystemCas,
  parseCasImage,
  parseSystemCas,
  programByteLength,
  BASIC_MARKER,
  SYNC_BYTE,
} from './casfile';
import { tokenizeProgram, PROG_START } from './tokenizer';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';

/**
 * Hand-build a minimal Model I SYSTEM tape: leader, 0xA5 sync, 0x55 header, a
 * six-character name, one 0x3C data record (length, LE load address, data,
 * checksum) then a 0x78 entry record with a LE entry address. `checksum`
 * defaults to the correct value; pass a wrong one to exercise the lenient path.
 */
function buildSystemCas(
  name: string,
  address: number,
  data: number[],
  entry: number,
  checksum?: number,
): Uint8Array {
  const nameBytes = name.padEnd(6, ' ').slice(0, 6);
  const lo = address & 0xff;
  const hi = (address >> 8) & 0xff;
  const sum = checksum ?? (lo + hi + data.reduce((a, b) => a + b, 0)) & 0xff;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) out.push(0x00); // leader
  out.push(0xa5, 0x55);
  for (const ch of nameBytes) out.push(ch.charCodeAt(0));
  out.push(0x3c, data.length & 0xff, lo, hi, ...data, sum);
  out.push(0x78, entry & 0xff, (entry >> 8) & 0xff);
  return Uint8Array.from(out);
}

const SOURCE = '10 PRINT "HI"\n20 GOTO 10\n';

describe('trs80 cassette image', () => {
  it('lays out leader, sync, BASIC marker, filename then program', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'BREAKOUT', 8);

    // 8-byte leader of zeros.
    expect(Array.from(cas.subarray(0, 8))).toEqual(Array(8).fill(0));
    expect(cas[8]).toBe(SYNC_BYTE);
    expect(Array.from(cas.subarray(9, 12))).toEqual([
      BASIC_MARKER,
      BASIC_MARKER,
      BASIC_MARKER,
    ]);
    // One-character filename: the first letter of the title.
    expect(cas[12]).toBe('B'.charCodeAt(0));
    expect(Array.from(cas.subarray(13))).toEqual(Array.from(program));
  });

  it('round-trips name and program through parseCasImage', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'MAZE');
    const parsed = parseCasImage(cas);
    expect(parsed.programName).toBe('M');
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('trims trailing junk after the program via the linked-list length', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'A', 4);
    const noisy = new Uint8Array(cas.length + 5);
    noisy.set(cas);
    noisy.fill(0xff, cas.length); // garbage past the end (e.g. tape run-out)
    const parsed = parseCasImage(noisy);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('detokenizes a raw .cas image (Import path) back to source', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'P');
    expect(detokenizeProgram(cas)).toBe(SOURCE);
  });

  it('isCasImage recognises a block with or without a leader', () => {
    const { program } = tokenizeProgram(SOURCE);
    expect(isCasImage(buildCasImage(program, 'A', 32))).toBe(true);
    expect(isCasImage(buildCasImage(program, 'A', 0))).toBe(true);
    expect(isCasImage(program)).toBe(false); // a bare program is not a cas block
  });

  it('rejects a non-cassette buffer', () => {
    expect(() => parseCasImage(Uint8Array.of(1, 2, 3))).toThrow(/0xA5/);
  });

  it('casNameByte folds to a single A–Z/0–9, defaulting to A', () => {
    expect(casNameByte('breakout')).toBe('B'.charCodeAt(0));
    expect(casNameByte('  ')).toBe('A'.charCodeAt(0));
    expect(casNameByte('9lives')).toBe('9'.charCodeAt(0));
  });

  it('classifies a SYSTEM tape as system, not model1/model3', () => {
    const cas = buildSystemCas('MYCODE', 0x7000, [1, 2, 3], 0x7000);
    expect(casFormat(cas)).toBe('system');
    expect(isSystemCas(cas)).toBe(true);
    expect(isCasImage(cas)).toBe(false);
  });

  it('parses SYSTEM data blocks with their load address and entry point', () => {
    const cas = buildSystemCas('MYCODE', 0x7000, [10, 20, 30], 0x7003);
    const warnings: string[] = [];
    const { name, blocks, entry } = parseSystemCas(cas, warnings);
    expect(name).toBe('MYCODE');
    expect(entry).toBe(0x7003);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.address).toBe(0x7000);
    expect(Array.from(blocks[0]!.bytes)).toEqual([10, 20, 30]);
    expect(warnings).toEqual([]);
  });

  it('keeps a bad-checksum SYSTEM block but records a warning', () => {
    const cas = buildSystemCas('BAD', 0x7000, [1, 2, 3], 0x7000, 0x00);
    const warnings: string[] = [];
    const { blocks } = parseSystemCas(cas, warnings);
    expect(blocks).toHaveLength(1);
    expect(Array.from(blocks[0]!.bytes)).toEqual([1, 2, 3]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/checksum/i);
  });

  it('imports a SYSTEM tape as memory blocks via detokenizeProgramWithReport', () => {
    const cas = buildSystemCas('MYCODE', 0x7000, [0xc9], 0x7000);
    const report = detokenizeProgramWithReport(cas);
    expect(report.source).toBe('');
    expect(report.blocks).toBeDefined();
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]).toMatchObject({
      id: 'imported-code-1',
      name: 'code1',
      address: 0x7000,
      kind: 'code',
    });
    expect(Array.from(report.blocks![0]!.bytes)).toEqual([0xc9]);
  });

  it('programByteLength stops at the 0x0000 link', () => {
    const { program } = tokenizeProgram(SOURCE);
    expect(programByteLength(program)).toBe(program.length);
  });

  it('lays out link pointers on the real TXTTAB base 0x42E9', () => {
    expect(PROG_START).toBe(0x42e9);
    const { program } = tokenizeProgram(SOURCE);
    // The first link is an absolute address = base + first record length.
    const firstLink = program[0]! | (program[1]! << 8);
    // 10 PRINT "HI": body = B2 20 22 48 49 22 (6) -> record 2+2+6+1 = 11.
    expect(firstLink).toBe(PROG_START + 11);
    // The chain walks on the real base and trims tape run-out noise past it.
    const noisy = new Uint8Array(program.length + 6);
    noisy.set(program);
    noisy.fill(0xff, program.length);
    expect(programByteLength(noisy)).toBe(program.length);
  });
});
