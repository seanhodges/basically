import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BbcMachine, configureNodeRomPath } from './bbcMachine';
import { tokenizeProgram } from '../../dialects/bbcmicro/tokenizer';

/**
 * The Acorn screen reader, against the real OS 1.20 and MOS 3.20 ROMs: the
 * teletext matrix in MODE 7 and the OCR path in the graphics modes, plus the
 * two font tables the OCR depends on.
 */
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** Run frames (yielding to the microtask queue) until the predicate holds. */
async function runUntil(
  machine: BbcMachine,
  predicate: () => boolean,
  maxFrames = 500,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

/** The screen as one string, or '' while the machine cannot answer. */
function text(machine: BbcMachine): string {
  return machine.readScreenText()?.lines.join('\n') ?? '';
}

/** Boot a machine, run `source`, and wait for `want` to appear on screen. */
async function show(
  source: string,
  want: string,
  model = 'B',
): Promise<BbcMachine> {
  const machine = new BbcMachine(model);
  const { bytes } = tokenizeProgram(source);
  machine.loadProgram(bytes);
  const seen = await runUntil(machine, () => text(machine).includes(want));
  expect(seen, `"${want}" reaches the screen`).toBe(true);
  return machine;
}

describe('BbcMachine readScreenText (MODE 7)', () => {
  it('is null before the machine is up', () => {
    const machine = new BbcMachine();
    expect(machine.readScreenText()).toBeNull();
    machine.dispose();
  });

  it('reads the boot banner as a 40x25 teletext matrix', async () => {
    const machine = new BbcMachine();
    await machine.whenReady();
    const booted = await runUntil(
      machine,
      () =>
        text(machine).includes('BBC Computer 32K') &&
        text(machine).includes('BASIC'),
    );
    expect(booted).toBe(true);
    const screen = machine.readScreenText()!;
    expect(screen.cols).toBe(40);
    expect(screen.rows).toBe(25);
    expect(screen.lines).toHaveLength(25);
    for (const line of screen.lines) expect([...line]).toHaveLength(40);
    machine.dispose();
  }, 30000);

  it('shows teletext control codes as the blank cell they occupy', async () => {
    // CHR$(129) is "alphanumeric red": it takes a cell and draws nothing, so
    // the text starts one column in from where a naive read would put it.
    const machine = await show(
      '10 MODE 7\n20 PRINT CHR$(129);"RED"\n30 GOTO 30\n',
      'RED',
    );
    const row = machine.readScreenText()!.lines.find((l) => l.includes('RED'))!;
    expect(row.indexOf('RED')).toBe(1);
    machine.dispose();
  }, 60000);

  it('decodes mosaics only once a graphics colour has opened the row', async () => {
    // The SAA5050 sees seven bits and starts every row alphanumeric, so the
    // same byte is a letter before a graphics colour and a sextant after one.
    const machine = await show(
      '10 MODE 7\n' +
        '20 PRINT CHR$(255);CHR$(151);CHR$(255)\n' +
        '30 GOTO 30\n',
      '█',
    );
    const row = machine.readScreenText()!.lines.find((l) => l.includes('█'))!;
    // Byte &FF ahead of the colour draws the letter its low seven bits name
    // (&7F), which the MOS font has no plain form for, so it reads as a space;
    // after the colour the same byte is the full sextant block.
    expect([...row][0]).not.toBe('█');
    expect(row).toContain('█');
    machine.dispose();
  }, 60000);
});

describe('BbcMachine readScreenText (graphics modes)', () => {
  const cases: ReadonlyArray<{ mode: number; cols: number; rows: number }> = [
    { mode: 0, cols: 80, rows: 32 }, // 1 bit a pixel
    { mode: 1, cols: 40, rows: 32 }, // 2 bits a pixel
    { mode: 2, cols: 20, rows: 32 }, // 4 bits a pixel
    { mode: 6, cols: 40, rows: 25 }, // 1 bit a pixel, with blank scanline gaps
  ];

  for (const { mode, cols, rows } of cases) {
    it(`OCRs MODE ${mode} at ${cols}x${rows}`, async () => {
      const machine = await show(
        `10 MODE ${mode}\n20 PRINT "BEEB"\n30 GOTO 30\n`,
        'BEEB',
      );
      const screen = machine.readScreenText()!;
      expect(screen.cols).toBe(cols);
      expect(screen.rows).toBe(rows);
      for (const line of screen.lines) expect([...line]).toHaveLength(cols);
      machine.dispose();
    }, 60000);
  }

  it('reads a cleared graphics screen as spaces, not as null', async () => {
    const machine = await show(
      '10 MODE 1\n20 PRINT "GONE"\n30 CLS\n40 GOTO 40\n',
      '',
    );
    const seen = await runUntil(
      machine,
      () => machine.readScreenText()?.lines.join('').trim() === '',
    );
    expect(seen).toBe(true);
    machine.dispose();
  }, 60000);

  it('follows a hardware scroll rather than the memory order', async () => {
    // Scrolling moves the CRTC start address, not the bytes, so a reader that
    // walked memory from the mode's base would report the rows rotated.
    const machine = await show(
      '10 MODE 6\n' +
        '20 FOR I%=1 TO 30:PRINT "LINE";I%:NEXT\n' +
        '30 PRINT "LAST"\n' +
        '40 GOTO 40\n',
      'LAST',
    );
    const lines = machine.readScreenText()!.lines;
    const last = lines.findIndex((l) => l.includes('LAST'));
    const prev = lines.findIndex((l) => l.includes('LINE30'));
    expect(prev).toBeGreaterThanOrEqual(0);
    expect(last).toBe(prev + 1);
    machine.dispose();
  }, 60000);
});

describe('BbcMachine readScreenText (BBC Master)', () => {
  it('reads its teletext boot banner', async () => {
    const machine = new BbcMachine('Master');
    await machine.whenReady();
    const booted = await runUntil(machine, () =>
      text(machine).includes('BASIC'),
    );
    expect(booted).toBe(true);
    machine.dispose();
  }, 30000);

  it('OCRs a graphics mode through the font in its ROM bank 15', async () => {
    // MOS 3.20 keeps no font at &C000 - that is code. Its character
    // definitions are the last 1792 bytes of sideways ROM bank 15, which is
    // not paged in while BASIC runs, so this only passes if the reader goes to
    // the ROM image rather than through the CPU's current mapping.
    const machine = await show(
      '10 MODE 1\n20 PRINT "MASTER"\n30 GOTO 30\n',
      'MASTER',
      'Master',
    );
    expect(machine.readScreenText()!.cols).toBe(40);
    machine.dispose();
  }, 60000);
});
