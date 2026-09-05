import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MsxMachine } from './msxMachine';
import { READ_BIT, WRITE_BIT } from '../memoryActivityBuffer';
import { hb10pCharset } from '../../dialects/hb10p/charset';
import { tokenizeProgram } from '../../dialects/hb10p/tokenizer';
import { buildBasFile } from '../../dialects/hb10p/basfile';
import { STREND, TXTTAB } from './workspace';
import type { MsxModel } from './model';

/**
 * Runtime introspection against the genuine HB-10P system ROM: the workspace
 * addresses in `workspace.ts` were read off this image, so these confirm that
 * the variable walk, the report reader and the memory figures hold up end to
 * end against a program the interpreter really ran. Skips until the ROM is
 * present (see public/roms/ATTRIBUTION.md).
 *
 * A boot is nearly three hundred frames on this machine - MSX BASIC's own
 * start-up delay, not the emulation - so each case here earns its boot by
 * asking a question the others cannot. The decoders themselves are tested
 * without a ROM next door, in `src/dialects/hb10p/{vars,reports}.test.ts`.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/msx/hb10p.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);
const suite = hasRom ? describe : describe.skip;

const HB10P: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  slot0Page3: 'ram-mirror',
};

/** Frames a program is given to finish before it is read back. */
const RUN_FRAMES = 300;
/** Frames the BIOS needs to reach its prompt unaided, plus room to settle. */
const COLD_BOOT_FRAMES = 400;

function runProgram(source: string): MsxMachine {
  const m = new MsxMachine({ rom, model: HB10P, charset: hb10pCharset });
  const { bytes, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  m.loadProgram(buildBasFile(bytes));
  for (let i = 0; i < RUN_FRAMES && m.isProgramRunning(); i++) m.runFrame();
  expect(m.isProgramRunning()).toBe(false);
  return m;
}

suite('MsxMachine runtime introspection', () => {
  it('reads back live variables of all four value types', () => {
    // Every type the machine has, plus the two array shapes, in one program:
    // an integer, the double an unsuffixed name gets by default, an explicit
    // single, a string, and arrays of an integer and of a double.
    const m = runProgram(
      [
        '10 A%=-1234',
        '20 BB=1.5',
        '30 C!=2.5',
        '40 D$="HI"',
        '50 DIM E%(1,2)',
        '60 E%(1,2)=7',
        '70 DIM F$(1)',
        '80 F$(1)="Q"',
        '90 END',
      ].join('\n'),
    );
    const vars = m.readVariables();
    const named = (n: string) => vars.find((v) => v.name === n);

    expect(named('A%')).toEqual({ name: 'A%', kind: 'number', value: '-1234' });
    // No suffix on BB: double is what a bare name means on a clean boot, so
    // that is how the program spells it and how the watcher shows it.
    expect(named('BB')).toEqual({ name: 'BB', kind: 'number', value: '1.5' });
    expect(named('C!')).toEqual({ name: 'C!', kind: 'number', value: '2.5' });
    expect(named('D$')).toEqual({ name: 'D$', kind: 'string', value: '"HI"' });

    expect(named('E%()')).toMatchObject({ kind: 'number-array' });
    expect(named('E%()')!.value).toContain('[2,3]');
    expect(named('F$()')).toMatchObject({
      kind: 'string-array',
      value: '[2] = "", "Q"',
    });
    // Scalars first, then arrays, each in the order the program created them.
    expect(vars.map((v) => v.name)).toEqual([
      'A%',
      'BB',
      'C!',
      'D$',
      'E%()',
      'F$()',
    ]);

    // The program ended on its own END, which the machine reports as no report
    // at all - it printed nothing but its next Ok.
    expect(m.readReport()).toEqual({ isError: false, message: 'Ok' });

    m.dispose();
  });

  it('counts both the pools a program spends, and charges them per line', () => {
    // The string pool is filled downwards from the top of BASIC's RAM, nowhere
    // near the program area, so a figure covering only program-plus-variables
    // would read this loop as a program that allocates nothing - and the
    // profiler above it would have no bytes to charge to the line that took
    // them. The loop never ends, so it is run for a fixed window instead.
    const m = new MsxMachine({ rom, model: HB10P, charset: hb10pCharset });
    const { bytes, errors } = tokenizeProgram(
      [
        '10 A$=""',
        '20 FOR I=1 TO 20',
        '30 A$=A$+"X"',
        '40 NEXT I',
        '50 A$=""',
        '60 GOTO 20',
      ].join('\n'),
    );
    expect(errors).toEqual([]);
    m.loadProgram(buildBasFile(bytes));
    m.setProfileRecording(true);
    for (let i = 0; i < RUN_FRAMES; i++) m.runFrame();

    const stats = m.readMemoryStats()!;
    expect(stats).not.toBeNull();
    // What the program text, variables and arrays occupy, straight off the
    // pointers: the reported figure has to be more than that, and the excess
    // is the strings the loop is holding.
    const belowStrend = m.bus.readRamWord(STREND) - m.bus.readRamWord(TXTTAB);
    expect(belowStrend).toBeGreaterThan(0);
    expect(stats.used).toBeGreaterThan(belowStrend);
    expect(stats.free).toBeGreaterThan(0);
    // The two figures partition one fixed pool, so their total does not move as
    // a program spends it.
    const total = stats.used + stats.free;

    const costs = m.drainProfile()!;
    const allocated = (line: number) =>
      costs.find((c) => c.line === line)?.allocated ?? 0;
    expect(allocated(30)).toBeGreaterThan(0);
    expect(allocated(20) + allocated(40)).toBe(0);
    m.dispose();

    const bare = new MsxMachine({ rom, model: HB10P, charset: hb10pCharset });
    // Nothing is answerable until the ROM has laid its pointers down, and a
    // guessed figure then would be worse than none.
    expect(bare.readMemoryStats()).toBeNull();
    for (let i = 0; i < COLD_BOOT_FRAMES; i++) bare.runFrame();
    const cold = bare.readMemoryStats()!;
    expect(cold.used + cold.free).toBe(total);
    // The machine's own sign-on figure, which the dialect's budget is written
    // from, sits just below the free program area this reports.
    expect(cold.free).toBeGreaterThan(28815);
    bare.dispose();
  });

  it('reports the error a program stopped on, with its code and line', () => {
    const m = runProgram(['10 A=1', '20 GOTO 900', '30 END'].join('\n'));
    expect(m.readReport()).toEqual({
      isError: true,
      message: 'Undefined line number',
      code: '8',
      line: 20,
    });
    // The machine printed the same thing, which is what pins ERRFLG and ERRLIN
    // to the cells read here rather than to two others holding 8 and 20.
    expect(m.readScreenText()?.lines.join('\n')).toContain(
      'Undefined line number in 20',
    );
    m.dispose();
  });

  it('reports a break where the program stopped at a STOP', () => {
    const m = runProgram(['10 A=1', '20 STOP', '30 PRINT A'].join('\n'));
    expect(m.readReport()).toEqual({
      isError: false,
      message: 'Break in 20',
      line: 20,
    });
    expect(m.readScreenText()?.lines.join('\n')).toContain('Break in 20');
    m.dispose();
  });

  it('records what the CPU touches, and only while it is asked to', () => {
    const m = new MsxMachine({ rom, model: HB10P, charset: hb10pCharset });
    for (let i = 0; i < 10; i++) m.runFrame();
    // Off by default: an overlay nobody opened costs the machine nothing.
    expect(m.drainMemoryActivity()).toBeNull();

    m.setMemoryActivityRecording(true);
    for (let i = 0; i < 10; i++) m.runFrame();
    const hits = m.drainMemoryActivity()!;
    expect(hits.length).toBe(0x10000);
    // The BIOS is being executed out of ROM and its workspace written, so both
    // halves of the bus have to show.
    expect(hits.slice(0x0000, 0x4000).some((b) => (b & READ_BIT) !== 0)).toBe(
      true,
    );
    expect(hits.slice(0xf380, 0x10000).some((b) => (b & WRITE_BIT) !== 0)).toBe(
      true,
    );

    // A drain hands the filled buffer over and installs a clean one.
    expect(m.drainMemoryActivity()!.some((b) => b !== 0)).toBe(false);

    // The machine's own introspection reads through a non-recording path, so
    // the overlay never reports the IDE's polling as the program's accesses.
    m.readMemoryStats();
    m.readVariables();
    m.readReport();
    expect(m.drainMemoryActivity()!.some((b) => b !== 0)).toBe(false);

    m.setMemoryActivityRecording(false);
    for (let i = 0; i < 10; i++) m.runFrame();
    expect(m.drainMemoryActivity()).toBeNull();
    m.dispose();
  });
});
