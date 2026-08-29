import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';
import { cpc664Samples } from '../../dialects/cpc664/samples';

/**
 * Acceptance tests for the real CPC 664 firmware (OS v2 + Locomotive BASIC
 * 1.1), the 664 half of the cpcBoot suite. The combined 32K `cpc664.rom` ships
 * at public/roms/cpc/cpc664.rom under the terms in public/roms/ATTRIBUTION.md;
 * the suite skips if it is absent.
 *
 * The 664's BASIC 1.1 is an earlier revision than the 6128's and a different
 * image, so "1.1 works" is not inherited from the 6128 suite - these run it.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc664.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

const suite = hasRom ? describe : describe.skip;

/** The machine's own screen reading, as one string to search. */
function ocr(m: CpcMachine): string {
  return m.readScreenText()?.lines.join('\n') ?? '';
}

suite('CpcMachine 664 firmware boot', () => {
  it('boots the ROM to the 64K BASIC 1.1 banner', () => {
    const m = new CpcMachine({ rom, model: '664' });
    for (let i = 0; i < 200; i++) m.runFrame();
    const screen = ocr(m);
    // The 664 announces itself as a 64K machine at firmware v2 - the middle
    // banner between the 464's "64K ... (v1)" and the 6128's "128K ... (v3)".
    expect(screen).toContain('Amstrad 64K Microcomputer');
    expect(screen).toContain('(v2)');
    expect(screen).toContain('BASIC 1.1');
    expect(screen).toContain('Ready');
    m.dispose();
  });

  it('reports its free BASIC RAM through PRINT FRE(0)', () => {
    const m = new CpcMachine({ rom, model: '664' });
    const { bytes, errors } = tokenizeProgram('10 PRINT FRE(0)', 'basic11');
    expect(errors).toEqual([]);
    m.loadProgram(bytes);
    for (let i = 0; i < 40; i++) m.runFrame();
    // Pinned against the running ROM, and the same figure the 464 and the 6128
    // print for this program: BASIC 1.1 moved its workspace pointers but not
    // the amount of RAM it leaves for a program, and the 664 has no AMSDOS
    // below HIMEM here. That equality is the check - reading 1.1's pointers at
    // 1.0's addresses would not land on it.
    expect(ocr(m)).toContain(' 43521');
    m.dispose();
  });

  it('has no second bank to switch to, whatever BASIC writes to &7Fxx', () => {
    // The 6128's banking test, run on the machine that does not bank: the same
    // Gate Array command group must leave the base RAM showing through.
    const m = new CpcMachine({ rom, model: '664' });
    const { bytes, errors } = tokenizeProgram(
      [
        '10 POKE &7000,17',
        '20 OUT &7F00,&C4',
        '30 PRINT "STILL";PEEK(&7000)',
        '40 OUT &7F00,&C0',
      ].join('\n'),
      'basic11',
    );
    expect(errors).toEqual([]);
    m.loadProgram(bytes);
    for (let i = 0; i < 60; i++) m.runFrame();
    expect(ocr(m)).toContain('STILL 17');
    expect(m.mem.ramConfiguration).toBe(0);
    m.dispose();
  });

  it('runs a BASIC 1.1-only keyword the 464 cannot', () => {
    const m = new CpcMachine({ rom, model: '664' });
    const { bytes, errors } = tokenizeProgram(
      '10 MODE 1:GRAPHICS PEN 2:FRAME:PRINT "BASIC-11-OK"',
      'basic11',
    );
    expect(errors).toEqual([]);
    m.loadProgram(bytes);
    for (let i = 0; i < 40; i++) m.runFrame();
    expect(ocr(m)).toContain('BASIC-11-OK');
    expect(m.readReport()?.isError ?? false).toBe(false);
    m.dispose();
  });
});

suite('CpcMachine 664 runtime introspection', () => {
  /**
   * The 1.1 workspace table is shared with the 6128, and the 664's firmware is
   * a different build - so these confirm the shared addresses are right for
   * this ROM too, rather than assuming it.
   */
  const running = (src: string, frames = 80) => {
    const m = new CpcMachine({ rom, model: '664' });
    const { bytes, errors } = tokenizeProgram(src, 'basic11');
    expect(errors, src).toEqual([]);
    m.loadProgram(bytes);
    for (let i = 0; i < frames; i++) m.runFrame();
    return m;
  };

  it('walks live BASIC variables from the 1.1 workspace', () => {
    const m = running(
      '10 A=42\n20 B$="HI"\n30 DIM C(3)\n40 C(1)=7\n50 GOTO 50',
    );
    expect(m.readVariables()).toEqual([
      { name: 'A', kind: 'number', value: '42' },
      { name: 'B$', kind: 'string', value: '"HI"' },
      { name: 'C()', kind: 'number-array', value: '[4] = 0, 7, 0, 0' },
    ]);
    expect(m.readMemoryStats()?.used).toBeGreaterThan(0);
    m.dispose();
  });

  it('reports the current BASIC line for the debugger', () => {
    const m = running('10 PRINT "GO"\n20 REM\n30 GOTO 30');
    expect(m.currentLine()).toBe(30);
    m.dispose();
  });

  it('reads a runtime error and its line from the 1.1 workspace', () => {
    const m = running('10 DIM A(2)\n20 REM\n30 REM\n40 PRINT A(99)');
    expect(m.readReport()).toEqual({
      isError: true,
      message: 'Subscript out of range',
      code: '9',
      line: 40,
    });
    m.dispose();
  });
});

suite('CpcMachine 664 sample programs run without BASIC errors', () => {
  // The shared samples are BASIC 1.0 source; they must run on the 664 too,
  // tokenized under 1.1. Same guard as the 464 suite.
  for (const sample of cpc664Samples) {
    it(`${sample.name}`, () => {
      const m = new CpcMachine({ rom, model: '664' });
      const { bytes, errors } = tokenizeProgram(sample.text, 'basic11');
      expect(errors, sample.name).toEqual([]);
      m.loadProgram(bytes);
      for (let i = 0; i < 400; i++) m.runFrame();
      const report = m.readReport();
      expect(
        report?.isError ?? false,
        `${sample.name}: ${report?.message}`,
      ).toBe(false);
      m.dispose();
    });
  }
});
