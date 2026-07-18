import { describe, expect, it } from 'vitest';
import { isT64, parseT64 } from './t64';
import { detokenizeT64WithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

const LOADER_SOURCE = '10 PRINT "LOADING"\n';
const GAME_SOURCE = '10 POKE 53280,0\n20 PRINT "THE ACTUAL GAME"\n30 GOTO 20\n';

interface FileSpec {
  name: string;
  start: number;
  bytes: Uint8Array;
  /** Override the directory's declared end address (to fake broken writers). */
  declaredEnd?: number;
  /** Override the entry type byte (0 = free slot). */
  type?: number;
}

/** Hand-build a `.t64` container around `files`, data packed back-to-back. */
function buildT64(
  files: FileSpec[],
  signature = 'C64S tape image file',
): Uint8Array {
  const headerAndDir = 64 + files.length * 32;
  const total = headerAndDir + files.reduce((n, f) => n + f.bytes.length, 0);
  const out = new Uint8Array(total);
  for (let i = 0; i < signature.length; i++) out[i] = signature.charCodeAt(i);
  const u16 = (at: number, v: number) => {
    out[at] = v & 0xff;
    out[at + 1] = (v >> 8) & 0xff;
  };
  u16(32, 0x0100); // version
  u16(34, files.length); // max entries
  u16(36, files.length); // used entries
  let offset = headerAndDir;
  files.forEach((f, i) => {
    const at = 64 + i * 32;
    out[at] = f.type ?? 1;
    out[at + 1] = 0x82; // PRG
    u16(at + 2, f.start);
    u16(at + 4, f.declaredEnd ?? f.start + f.bytes.length);
    u16(at + 8, offset & 0xffff);
    u16(at + 10, offset >> 16);
    const name = f.name.padEnd(16, ' ');
    for (let c = 0; c < 16; c++) out[at + 16 + c] = name.charCodeAt(c);
    out.set(f.bytes, offset);
    offset += f.bytes.length;
  });
  return out;
}

/** Bare tokenized program bytes (no load-address word), as a .t64 stores them. */
function programBytes(source: string): Uint8Array {
  return tokenizeProgram(source).program;
}

describe('isT64 / parseT64', () => {
  it('recognises the signature variants and rejects raw .tap', () => {
    const t64 = buildT64([
      { name: 'GAME', start: 0x0801, bytes: programBytes(GAME_SOURCE) },
    ]);
    expect(isT64(t64)).toBe(true);
    expect(isT64(buildT64([], 'C64 tape image file'))).toBe(true);
    expect(isT64(buildT64([], 'C64-TAPE-RAW'))).toBe(false);
    expect(() => parseT64(buildT64([], 'C64-TAPE-RAW'))).toThrow(/raw .tap/i);
    expect(isT64(new Uint8Array(10))).toBe(false);
  });

  it('reads entries with their name, start address and payload', () => {
    const game = programBytes(GAME_SOURCE);
    const code = Uint8Array.of(0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60);
    const t64 = buildT64([
      { name: 'GAME', start: 0x0801, bytes: game },
      { name: 'SPRITES', start: 0xc000, bytes: code },
    ]);
    const { entries, warnings } = parseT64(t64);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ name: 'GAME', start: 0x0801 });
    expect(Array.from(entries[0]!.bytes)).toEqual(Array.from(game));
    expect(entries[1]).toMatchObject({ name: 'SPRITES', start: 0xc000 });
    expect(Array.from(entries[1]!.bytes)).toEqual(Array.from(code));
  });

  it('skips free directory slots', () => {
    const t64 = buildT64([
      { name: 'FREE', start: 0, bytes: new Uint8Array(0), type: 0 },
      { name: 'GAME', start: 0x0801, bytes: programBytes(GAME_SOURCE) },
    ]);
    const { entries } = parseT64(t64);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('GAME');
  });

  it('clamps a broken end address without swallowing the next entry', () => {
    const first = Uint8Array.of(1, 2, 3, 4);
    const second = Uint8Array.of(9, 9);
    const t64 = buildT64([
      // Declared end far past the real payload - the classic CONVT64 defect.
      { name: 'BAD', start: 0xc000, bytes: first, declaredEnd: 0xffff },
      { name: 'NEXT', start: 0xd000, bytes: second },
    ]);
    const { entries, warnings } = parseT64(t64);
    expect(warnings.some((w) => /bad end address/.test(w))).toBe(true);
    expect(Array.from(entries[0]!.bytes)).toEqual(Array.from(first));
    expect(Array.from(entries[1]!.bytes)).toEqual(Array.from(second));
  });
});

describe('detokenizeT64WithReport', () => {
  it('opens the largest BASIC entry, preserving the loader and code', () => {
    const loader = programBytes(LOADER_SOURCE);
    const game = programBytes(GAME_SOURCE);
    const code = Uint8Array.of(0xa9, 0x00, 0x60);
    const t64 = buildT64([
      { name: 'LOADER', start: 0x0801, bytes: loader },
      { name: 'GAME', start: 0x0801, bytes: game },
      { name: 'SPRITES', start: 0xc000, bytes: code },
    ]);
    const report = detokenizeT64WithReport(t64);
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]).toMatchObject({
      name: 'SPRITES',
      address: 0xc000,
      kind: 'code',
    });
    expect(report.tapeFiles).toHaveLength(1);
    expect(report.tapeFiles![0]!.name).toBe('LOADER');
    // The preserved payload is a ready .prg: load address word + program.
    expect(Array.from(report.tapeFiles![0]!.tap)).toEqual([
      0x01,
      0x08,
      ...loader,
    ]);
    expect(report.warnings.some((w) => /Multi-part tape image/.test(w))).toBe(
      true,
    );
  });

  it('imports a code-only .t64 as blocks with an explanatory warning', () => {
    const t64 = buildT64([
      { name: 'RASTER', start: 0xc000, bytes: Uint8Array.of(0x60) },
    ]);
    const report = detokenizeT64WithReport(t64);
    expect(report.source).toBe('');
    expect(report.blocks).toHaveLength(1);
    expect(report.warnings.some((w) => /no C64 BASIC program/.test(w))).toBe(
      true,
    );
  });

  it('keeps a single-program .t64 clean of multi-part warnings', () => {
    const t64 = buildT64([
      { name: 'GAME', start: 0x0801, bytes: programBytes(GAME_SOURCE) },
    ]);
    const report = detokenizeT64WithReport(t64);
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.warnings).toEqual([]);
    expect(report.blocks).toBeUndefined();
    expect(report.tapeFiles).toBeUndefined();
  });
});
