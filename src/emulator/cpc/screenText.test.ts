import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { cpcFontSignatures, readCpcScreenText } from './screenText';
import { Crtc, R } from './crtc';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';

/**
 * The CPC's screen reader, against the real 464 firmware. Everything here needs
 * the ROM's own font and the firmware's own text output, so the suite skips
 * without `public/roms/cpc/cpc464.rom` exactly as the boot tests do.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

const suite = hasRom ? describe : describe.skip;

/** Boot, inject and run a program, then read the screen back. */
function run(source: string, frames = 40) {
  const m = new CpcMachine({ rom });
  const { bytes, errors } = tokenizeProgram(source, 'basic10');
  expect(errors).toHaveLength(0);
  m.loadProgram(bytes);
  for (let i = 0; i < frames; i++) m.runFrame();
  const screen = m.readScreenText();
  m.dispose();
  return screen;
}

suite('cpcFontSignatures', () => {
  it('indexes the firmware font from the lower ROM at &3800', () => {
    // 'A' is the shape at 0x3800 + 0x41 * 8; finding that signature under 0x41
    // is what pins the base - a table read even 8 bytes early would answer
    // with the neighbouring code.
    const sigs = cpcFontSignatures(rom.subarray(0, 0x4000));
    const glyphA = Array.from({ length: 8 }, (_, i) => rom[0x3800 + 0x41 * 8 + i]);
    expect(sigs.get(glyphA.join(','))).toBe(0x41);
  });

  it('reads a blank cell as a space, not as a blank graphic', () => {
    const sigs = cpcFontSignatures(rom.subarray(0, 0x4000));
    expect(sigs.get([0, 0, 0, 0, 0, 0, 0, 0].join(','))).toBe(0x20);
  });
});

suite('CpcMachine readScreenText', () => {
  it('reads the MODE 1 boot banner as 40x25 characters', () => {
    const m = new CpcMachine({ rom });
    for (let i = 0; i < 200; i++) m.runFrame();
    const screen = m.readScreenText();
    expect(screen).not.toBeNull();
    expect(screen!.cols).toBe(40);
    expect(screen!.rows).toBe(25);
    expect(screen!.lines).toHaveLength(25);
    for (const line of screen!.lines) expect([...line]).toHaveLength(40);
    const text = screen!.lines.join('\n');
    expect(text).toContain('Amstrad 64K Microcomputer');
    expect(text).toContain('BASIC 1.0');
    expect(text).toContain('Ready');
    m.dispose();
  });

  it('follows the MODE into 80 columns', () => {
    const screen = run('10 MODE 2:PRINT "WIDE-SCREEN"');
    expect(screen).not.toBeNull();
    expect(screen!.cols).toBe(80);
    expect(screen!.rows).toBe(25);
    for (const line of screen!.lines) expect([...line]).toHaveLength(80);
    expect(screen!.lines.join('\n')).toContain('WIDE-SCREEN');
  });

  it('follows the MODE into 20 columns', () => {
    const screen = run('10 MODE 0:PRINT "BIG"');
    expect(screen).not.toBeNull();
    expect(screen!.cols).toBe(20);
    expect(screen!.lines.join('\n')).toContain('BIG');
  });

  it('reads a cleared screen as spaces rather than as null', () => {
    // The program never ends, so the firmware never prints its own `Ready` (or
    // its cursor) over the cleared screen: what comes back is only the CLS.
    const screen = run('10 MODE 1:PRINT "GONE":CLS\n20 GOTO 20');
    expect(screen).not.toBeNull();
    expect(screen!.lines.join('').trim()).toBe('');
  });

  it('decodes block graphics through the CPC charset, one code point a column', () => {
    // CHR$(233) is the filled square; the charset decodes it to U+25A0, and the
    // column count has to survive that (an astral glyph would break `line[col]`,
    // which is why the seam counts code points).
    const screen = run('10 MODE 1:PRINT CHR$(233);CHR$(233)');
    expect(screen).not.toBeNull();
    expect(screen!.lines.join('\n')).toContain('■■');
    for (const line of screen!.lines) expect([...line]).toHaveLength(40);
  });

  it('follows the CRTC when a program moves the screen base', () => {
    // R12/R13 put the screen at &4000 instead of &C000; the reader derives the
    // base from the CRTC, so the text is still where the firmware drew it.
    const screen = run('10 MODE 1:PRINT "MOVED":OUT &BC00,12:OUT &BD00,&10');
    expect(screen).not.toBeNull();
    expect(screen!.lines.join('\n')).not.toContain('MOVED');
  });
});

const ROM_6128_PATH = join(__dirname, '../../../public/roms/cpc/cpc6128.rom');
const has6128 = existsSync(ROM_6128_PATH);
const rom6128 = has6128
  ? new Uint8Array(readFileSync(ROM_6128_PATH))
  : new Uint8Array(0);
const suite6128 = has6128 ? describe : describe.skip;

suite6128('CpcMachine 6128 readScreenText', () => {
  it('reads the 6128 banner through its own OS ROM font', () => {
    const m = new CpcMachine({ rom: rom6128, model: '6128' });
    for (let i = 0; i < 200; i++) m.runFrame();
    const screen = m.readScreenText();
    expect(screen).not.toBeNull();
    expect(screen!.cols).toBe(40);
    expect(screen!.rows).toBe(25);
    expect(screen!.lines.join('\n')).toContain('BASIC 1.1');
    m.dispose();
  });
});

suite('readCpcScreenText geometry guards', () => {
  it('is null when the CRTC is not showing an 8-scanline text grid', () => {
    const crtc = new Crtc();
    crtc.selectRegister(R.MAX_RASTER);
    crtc.writeData(15); // 16 scanlines a row: no 8x8 grid to slice
    expect(
      readCpcScreenText({
        signatures: cpcFontSignatures(rom.subarray(0, 0x4000)),
        crtc,
        mode: 1,
        readScreenByte: () => 0,
      }),
    ).toBeNull();
  });

  it('is null when the CRTC displays nothing', () => {
    const crtc = new Crtc();
    crtc.selectRegister(R.V_DISPLAYED);
    crtc.writeData(0);
    expect(
      readCpcScreenText({
        signatures: cpcFontSignatures(rom.subarray(0, 0x4000)),
        crtc,
        mode: 1,
        readScreenByte: () => 0,
      }),
    ).toBeNull();
  });
});
