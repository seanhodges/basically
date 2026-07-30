import { describe, expect, it } from 'vitest';
import {
  buildCasImage,
  casFormat,
  casNameByte,
  isCasImage,
  isSystemCas,
  parseCasAllFiles,
  parseCasImage,
  parseSystemCas,
  programByteLength,
  BASIC_MARKER,
  SYNC_BYTE,
  type CasBasicFile,
  type CasSystemFile,
} from './casfile';
import { tokenizeProgram } from './tokenizer';
import { PROG_START } from './addresses';
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
      name: 'MYCODE',
      address: 0x7000,
      kind: 'code',
      entry: 0x7000,
    });
    expect(Array.from(report.blocks![0]!.bytes)).toEqual([0xc9]);
  });

  it('programByteLength stops at the 0x0000 link', () => {
    const { program } = tokenizeProgram(SOURCE);
    expect(programByteLength(program)).toBe(program.length);
  });

  it('parseSystemCas reports where it stopped and clean termination', () => {
    const cas = buildSystemCas('MYCODE', 0x7000, [1, 2, 3], 0x7003);
    const parsed = parseSystemCas(cas);
    expect(parsed.terminated).toBe(true);
    expect(parsed.end).toBe(cas.length);

    // Chop the entry record off: not terminated.
    const cut = parseSystemCas(cas.subarray(0, cas.length - 3));
    expect(cut.terminated).toBe(false);
    expect(cut.blocks).toHaveLength(1);
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

/** Concatenate byte arrays into one tape image. */
function tape(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const LOADER_SOURCE = '10 PRINT "LOADING"\n';
const GAME_SOURCE = '10 CLS\n20 PRINT "THE ACTUAL GAME"\n30 GOTO 20\n';

describe('parseCasAllFiles', () => {
  it('finds every file on a loader-then-game tape', () => {
    const loader = buildCasImage(tokenizeProgram(LOADER_SOURCE).program, 'L');
    const game = buildCasImage(tokenizeProgram(GAME_SOURCE).program, 'G', 32);
    const { files, warnings } = parseCasAllFiles(tape(loader, game));
    expect(warnings).toEqual([]);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.kind)).toEqual(['basic', 'basic']);
    expect((files[0] as CasBasicFile).name).toBe('L');
    expect((files[1] as CasBasicFile).name).toBe('G');
    expect(Array.from((files[1] as CasBasicFile).program)).toEqual(
      Array.from(tokenizeProgram(GAME_SOURCE).program),
    );
  });

  it('finds a SYSTEM file after a BASIC loader', () => {
    const loader = buildCasImage(tokenizeProgram(LOADER_SOURCE).program, 'L');
    const sys = buildSystemCas('GAME', 0x7000, [0xc9, 0x00], 0x7000);
    // buildSystemCas writes only a 4-byte leader; pad to a real one so the
    // scanner's next-file boundary (>= 16 zeros + sync) can see it.
    const { files } = parseCasAllFiles(tape(loader, new Uint8Array(32), sys));
    expect(files.map((f) => f.kind)).toEqual(['basic', 'system']);
    const system = files[1] as CasSystemFile;
    expect(system.name).toBe('GAME');
    expect(system.entry).toBe(0x7000);
    expect(system.terminated).toBe(true);
    expect(system.records).toHaveLength(1);
  });

  it('keeps machine code trailing a program with that file', () => {
    const program = tokenizeProgram(LOADER_SOURCE).program;
    const trailing = Uint8Array.of(0xc3, 0x00, 0x70, 0x00, 0xa5, 0xc9);
    const next = buildCasImage(tokenizeProgram(GAME_SOURCE).program, 'G', 32);
    // The trailing code contains a zero and a literal 0xA5, but not a >=16
    // zero run, so the boundary heuristic must not split the file there.
    const { files } = parseCasAllFiles(
      tape(buildCasImage(program, 'L'), trailing, next),
    );
    expect(files).toHaveLength(2);
    const first = files[0] as CasBasicFile;
    expect(Array.from(first.trailing)).toEqual(Array.from(trailing));
    // raw preserves the whole file verbatim, trailing included.
    expect(first.raw.length).toBeGreaterThan(program.length + trailing.length);
  });

  it('warns about and skips unrecognized data after the last file', () => {
    const cas = buildCasImage(tokenizeProgram(LOADER_SOURCE).program, 'L');
    // Junk after the file that is neither a leader+sync nor pure padding.
    // (A gap under MIN_NEXT_LEADER zeros stays with the file as "trailing",
    // so put the junk behind a valid boundary-sized gap plus a bad sync.)
    const junk = Uint8Array.of(0x01, 0x02, 0x03);
    const { files, warnings } = parseCasAllFiles(
      tape(cas, new Uint8Array(32), Uint8Array.of(SYNC_BYTE, 0x99), junk),
    );
    expect(files).toHaveLength(1);
    expect(warnings.some((w) => /unrecognized/i.test(w))).toBe(true);
  });

  it('treats pure zero padding after the last file as a clean end', () => {
    const cas = buildCasImage(tokenizeProgram(LOADER_SOURCE).program, 'L');
    const { files, warnings } = parseCasAllFiles(tape(cas, new Uint8Array(64)));
    expect(files).toHaveLength(1);
    expect((files[0] as CasBasicFile).trailing.length).toBe(0);
    expect(warnings).toEqual([]);
  });
});

describe('detokenizeProgramWithReport on multi-file tapes', () => {
  it('opens the largest program and preserves the loader as a tape file', () => {
    const loader = buildCasImage(tokenizeProgram(LOADER_SOURCE).program, 'L');
    const game = buildCasImage(tokenizeProgram(GAME_SOURCE).program, 'G', 32);
    const report = detokenizeProgramWithReport(tape(loader, game));
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.tapeFiles).toHaveLength(1);
    expect(report.tapeFiles![0]!.name).toBe('L');
    expect(report.tapeFiles![0]!.kind).toBe('program');
    // The preserved payload is the verbatim loader file.
    expect(Array.from(report.tapeFiles![0]!.tap)).toEqual(Array.from(loader));
    expect(report.warnings.some((w) => /Multi-part tape/.test(w))).toBe(true);
  });

  it('imports SYSTEM records alongside the BASIC program, entry kept', () => {
    const basic = buildCasImage(tokenizeProgram(GAME_SOURCE).program, 'G');
    const sys = buildSystemCas('ENGINE', 0x8000, [0x3e, 0x01, 0xc9], 0x8001);
    const report = detokenizeProgramWithReport(
      tape(basic, new Uint8Array(32), sys),
    );
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]).toMatchObject({
      name: 'ENGINE',
      address: 0x8000,
      entry: 0x8001,
    });
    expect(report.tapeFiles).toBeUndefined();
  });

  it('preserves machine code trailing the chosen program as a block', () => {
    const program = tokenizeProgram(GAME_SOURCE).program;
    const trailing = Uint8Array.of(0x3e, 0x2a, 0xc9);
    const report = detokenizeProgramWithReport(
      tape(buildCasImage(program, 'G'), trailing),
    );
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]!.address).toBe(PROG_START + program.length);
    expect(Array.from(report.blocks![0]!.bytes)).toEqual(Array.from(trailing));
    expect(report.warnings.some((w) => /memory block/.test(w))).toBe(true);
  });

  it('preserves a bare image’s trailing bytes as a block too', () => {
    const { program } = tokenizeProgram(GAME_SOURCE);
    const trailing = Uint8Array.of(0x3e, 0x2a, 0xc9);
    const report = detokenizeProgramWithReport(tape(program, trailing));
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]!.address).toBe(PROG_START + program.length);
    expect(
      report.warnings.some((w) => /preserved as a memory block/.test(w)),
    ).toBe(true);
  });

  it('still imports a single-file tape with no multi-part warnings', () => {
    const report = detokenizeProgramWithReport(
      buildCasImage(tokenizeProgram(GAME_SOURCE).program, 'G'),
    );
    expect(report.source).toBe(GAME_SOURCE);
    expect(report.warnings).toEqual([]);
    expect(report.blocks).toBeUndefined();
    expect(report.tapeFiles).toBeUndefined();
  });
});
