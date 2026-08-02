import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';
import { cpc6128Samples } from '../../dialects/cpc6128/samples';

/**
 * Acceptance tests for the real CPC 6128 firmware (OS 2.x + Locomotive BASIC
 * 1.1), the 6128 half of the cpcBoot suite. The combined 32K `cpc6128.rom`
 * ships at public/roms/cpc/cpc6128.rom under the terms in
 * public/roms/ATTRIBUTION.md; the suite skips if it is absent.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc6128.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

const suite = hasRom ? describe : describe.skip;

/** The machine's own screen reading, as one string to search. */
function ocr(m: CpcMachine): string {
  return m.readScreenText()?.lines.join('\n') ?? '';
}

suite('CpcMachine 6128 firmware boot', () => {
  it('boots the ROM to the BASIC 1.1 banner', () => {
    const m = new CpcMachine({ rom, model: '6128' });
    for (let i = 0; i < 200; i++) m.runFrame();
    const screen = ocr(m);
    expect(screen).toContain('Amstrad 128K Microcomputer');
    expect(screen).toContain('BASIC 1.1');
    expect(screen).toContain('Ready');
    m.dispose();
  });

  it('reports its free BASIC RAM through PRINT FRE(0)', () => {
    const m = new CpcMachine({ rom, model: '6128' });
    const { bytes, errors } = tokenizeProgram('10 PRINT FRE(0)', 'basic11');
    expect(errors).toEqual([]);
    m.loadProgram(bytes);
    for (let i = 0; i < 40; i++) m.runFrame();
    // Pinned against the running ROM, and identical to what the 464 prints for
    // the same 14-byte program: BASIC 1.1 moved its workspace pointers but not
    // the amount of RAM it leaves for a program. That equality is the check -
    // reading 1.1's pointers at 1.0's addresses inflates this figure.
    //
    // This is the emulator's own reading, and deliberately NOT the dialect's
    // programRamBytes, which is the real machine's documented no-AMSDOS budget
    // of 42619 - the same on both CPCs, since AMSDOS is exactly the 370 bytes
    // that take a disc-equipped 6128 down to 42249.
    expect(ocr(m)).toContain(' 43521');
    m.dispose();
  });

  it('banks RAM from BASIC through a &7Fxx configuration write', () => {
    // The end-to-end path the memory unit tests cannot reach: a real OUT from
    // the firmware's own interpreter, through the Gate Array's %11xxxxxx
    // command group, into the PAL RAM configuration. &7000 sits in free BASIC
    // RAM inside the &4000-&7FFF window that configuration 4 banks.
    const m = new CpcMachine({ rom, model: '6128' });
    const { bytes, errors } = tokenizeProgram(
      [
        '10 POKE &7000,17',
        '20 OUT &7F00,&C4',
        '30 POKE &7000,153',
        '40 OUT &7F00,&C0',
        '50 PRINT "BASE";PEEK(&7000)',
        '60 OUT &7F00,&C4',
        '70 PRINT "BANK";PEEK(&7000)',
        '80 OUT &7F00,&C0',
      ].join('\n'),
      'basic11',
    );
    expect(errors).toEqual([]);
    m.loadProgram(bytes);
    for (let i = 0; i < 60; i++) m.runFrame();
    const screen = ocr(m);
    expect(screen).toContain('BASE 17'); // the banked write missed the base RAM
    expect(screen).toContain('BANK 153'); // and is still there in bank 4
    expect(m.mem.ramConfiguration).toBe(0);
    m.dispose();
  });

  it('runs a BASIC 1.1-only keyword the 464 cannot', () => {
    const m = new CpcMachine({ rom, model: '6128' });
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

suite('CpcMachine 6128 runtime introspection', () => {
  /** Park a program in an idle loop so the readers see a live interpreter. */
  const running = (src: string, frames = 80) => {
    const m = new CpcMachine({ rom, model: '6128' });
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

  it('reports used and free BASIC RAM', () => {
    const m = running(
      '10 A=42\n20 B$="HI"\n30 DIM C(3)\n40 C(1)=7\n50 GOTO 50',
    );
    const stats = m.readMemoryStats();
    expect(stats).not.toBeNull();
    expect(stats!.used).toBeGreaterThan(0);
    expect(stats!.free).toBeGreaterThan(40000);
    m.dispose();
  });
});

suite('CpcMachine 6128 sample programs run without BASIC errors', () => {
  // The shared samples are BASIC 1.0 source; they must run on the 6128 too,
  // tokenized under 1.1. Same guard as the 464 suite.
  for (const sample of cpc6128Samples) {
    it(`${sample.name}`, () => {
      const m = new CpcMachine({ rom, model: '6128' });
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
