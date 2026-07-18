import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { buildPFile, parsePFile, withAutoStart } from './pfile';
import * as sv from './sysvars';

const word = (img: Uint8Array, addr: number) =>
  img[addr - sv.SYSVARS_BASE]! | (img[addr - sv.SYSVARS_BASE + 1]! << 8);

describe('buildPFile', () => {
  const { bytes: program } = tokenizeProgram('10 PRINT "HELLO"\n20 GOTO 10\n');

  it('lays out consistent system variables', () => {
    const img = buildPFile(program);
    const dFile = word(img, sv.D_FILE);
    const vars = word(img, sv.VARS);
    const eLine = word(img, sv.E_LINE);

    expect(dFile).toBe(sv.PROGRAM_BASE + program.length);
    expect(vars).toBe(dFile + 25);
    expect(eLine).toBe(vars + 1);
    // File covers 0x4009 .. E_LINE-1
    expect(img.length).toBe(eLine - sv.SYSVARS_BASE);
    // Display file: 25 NEWLINEs
    for (let i = 0; i < 25; i++) {
      expect(img[dFile - sv.SYSVARS_BASE + i]).toBe(0x76);
    }
    // Variables terminator
    expect(img[vars - sv.SYSVARS_BASE]).toBe(0x80);
    // Auto-run points at the first program line
    expect(word(img, sv.NXTLIN)).toBe(sv.PROGRAM_BASE);
    // SLOW mode flag
    expect(img[sv.CDFLAG - sv.SYSVARS_BASE]).toBe(0x40);
  });

  it('supports no-autorun and FAST options', () => {
    const img = buildPFile(program, { autoRun: false, slow: false });
    expect(word(img, sv.NXTLIN)).toBe(word(img, sv.D_FILE));
    expect(img[sv.CDFLAG - sv.SYSVARS_BASE]).toBe(0x00);
  });

  it('round-trips through parsePFile', () => {
    const img = buildPFile(program);
    const parsed = parsePFile(img);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('rejects garbage', () => {
    expect(() => parsePFile(new Uint8Array(10))).toThrow();
    expect(() => parsePFile(new Uint8Array(300))).toThrow();
  });
});

describe('auto-start via NXTLIN', () => {
  const { bytes: program } = tokenizeProgram(
    '10 PRINT "A"\n20 PRINT "B"\n30 GOTO 30\n',
  );

  /** Address of the record for `line` inside a built image's program area. */
  function lineAddress(img: Uint8Array, line: number): number {
    let addr = sv.PROGRAM_BASE;
    const dFile = word(img, sv.D_FILE);
    while (addr < dFile) {
      const off = addr - sv.SYSVARS_BASE;
      const lineNo = (img[off]! << 8) | img[off + 1]!;
      if (lineNo === line) return addr;
      addr += 4 + (img[off + 2]! | (img[off + 3]! << 8));
    }
    throw new Error(`line ${line} not found`);
  }

  it('parsePFile reports the NXTLIN line when it is not the first', () => {
    const img = buildPFile(program);
    const nxtlinOff = sv.NXTLIN - sv.SYSVARS_BASE;
    const addr = lineAddress(img, 20);
    img[nxtlinOff] = addr & 0xff;
    img[nxtlinOff + 1] = (addr >> 8) & 0xff;
    expect(parsePFile(img).autoStart).toBe(20);
  });

  it('parsePFile reports null for default first-line autorun', () => {
    expect(parsePFile(buildPFile(program)).autoStart).toBeNull();
  });

  it('parsePFile reports null for a non-auto-running image', () => {
    const img = buildPFile(program, { autoRun: false });
    expect(parsePFile(img).autoStart).toBeNull();
  });

  it('withAutoStart points NXTLIN at the requested line', () => {
    const img = buildPFile(program);
    const patched = withAutoStart(img, 20);
    expect(word(patched, sv.NXTLIN)).toBe(lineAddress(img, 20));
    // Original untouched.
    expect(word(img, sv.NXTLIN)).toBe(sv.PROGRAM_BASE);
    expect(parsePFile(patched).autoStart).toBe(20);
  });

  it('withAutoStart falls forward to the next line (GOTO semantics)', () => {
    const img = buildPFile(program);
    const patched = withAutoStart(img, 15);
    expect(word(patched, sv.NXTLIN)).toBe(lineAddress(img, 20));
  });

  it('withAutoStart leaves the image unchanged when the line is past the end', () => {
    const img = buildPFile(program);
    expect(withAutoStart(img, 5000)).toBe(img);
  });
});
