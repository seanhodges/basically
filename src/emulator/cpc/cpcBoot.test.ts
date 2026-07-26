import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcMachine } from './cpcMachine';
import { Crtc } from './crtc';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';
import { cpc464Samples } from '../../dialects/cpc464/samples';

/**
 * Acceptance tests for the real CPC 464 firmware. The combined 32K `cpc464.rom`
 * (OS 16K + BASIC 16K) ships at public/roms/cpc/cpc464.rom under the terms in
 * public/roms/ATTRIBUTION.md; the suite still skips if it is absent, so a
 * checkout with the ROM removed stays green. With it, these are the acceptance
 * checks: the firmware boots to its BASIC banner and a tokenized program runs
 * to output.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

const suite = hasRom ? describe : describe.skip;

// The CPC character matrices live in the lower (OS) ROM at &3800: char c is
// 8 bytes at 0x3800 + c*8, bit 7 = leftmost pixel. That lets us OCR the screen.
function ocr(m: CpcMachine): string {
  const crtc = new Crtc();
  const sigToChar = new Map<string, string>();
  for (let c = 32; c < 128; c++) {
    const base = 0x3800 + c * 8;
    const s = Array.from({ length: 8 }, (_, i) => rom[base + i]!).join(',');
    if (!sigToChar.has(s)) sigToChar.set(s, String.fromCharCode(c));
  }
  const decode = (b: number) => [
    ((b & 0x80) >> 7) | ((b & 0x08) >> 2),
    ((b & 0x40) >> 6) | ((b & 0x04) >> 1),
    ((b & 0x20) >> 5) | ((b & 0x02) >> 0),
    ((b & 0x10) >> 4) | ((b & 0x01) << 1),
  ];
  const rows: string[] = [];
  for (let row = 0; row < 25; row++) {
    let text = '';
    for (let col = 0; col < 40; col++) {
      const bytes: number[] = [];
      for (let r = 0; r < 8; r++) {
        const addr = crtc.byteAddress(row, r, col);
        const pens = [
          ...decode(m.mem.readScreen(addr)),
          ...decode(m.mem.readScreen(addr + 1)),
        ];
        let mask = 0;
        for (let i = 0; i < 8; i++) if (pens[i]) mask |= 0x80 >> i;
        bytes.push(mask);
      }
      text += sigToChar.get(bytes.join(',')) ?? ' ';
    }
    rows.push(text);
  }
  return rows.join('\n');
}

suite('CpcMachine firmware boot', () => {
  it('boots the ROM to the BASIC 1.0 "Ready" banner', () => {
    const m = new CpcMachine({ rom });
    for (let i = 0; i < 200; i++) m.runFrame();
    const screen = ocr(m);
    expect(screen).toContain('Amstrad 64K Microcomputer');
    expect(screen).toContain('BASIC 1.0');
    expect(screen).toContain('Ready');

    // The rendered framebuffer is live too (non-background pixels present).
    const fb = m.frame;
    expect(fb.length).toBe(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    let nonBlack = 0;
    for (let i = 0; i < fb.length; i += 4) {
      if (fb[i] || fb[i + 1] || fb[i + 2]) nonBlack++;
    }
    expect(nonBlack).toBeGreaterThan(0);
    m.dispose();
  });
});

suite('CpcMachine loadProgram', () => {
  it('injects a tokenized program at &0170', () => {
    const m = new CpcMachine({ rom });
    const { bytes } = tokenizeProgram('10 PRINT 1', 'basic10');
    m.loadProgram(bytes);
    for (let i = 0; i < bytes.length; i++) {
      expect(m.mem.readScreen(0x0170 + i)).toBe(bytes[i]);
    }
    m.dispose();
  });

  it('boots, injects and RUNs a program to its printed output', () => {
    const m = new CpcMachine({ rom });
    const { bytes, errors } = tokenizeProgram(
      '10 PRINT "BASICALLY-CPC"',
      'basic10',
    );
    expect(errors).toHaveLength(0);
    m.loadProgram(bytes);
    // Let the program run and print.
    for (let i = 0; i < 30; i++) m.runFrame();
    expect(ocr(m)).toContain('BASICALLY-CPC');
    m.dispose();
  });

  it('runs a computed PRINT (arithmetic through the real interpreter)', () => {
    const m = new CpcMachine({ rom });
    const { bytes } = tokenizeProgram('10 PRINT 6*7', 'basic10');
    m.loadProgram(bytes);
    for (let i = 0; i < 30; i++) m.runFrame();
    // Locomotive prints a leading space for the sign of a positive number.
    expect(ocr(m)).toContain(' 42');
    m.dispose();
  });
});

suite('CpcMachine sample programs run without BASIC errors', () => {
  // Every bundled sample must reach and stay in the interpreter without
  // tripping a runtime report - guards against tokenizer regressions (e.g. the
  // integer-10 token) and sample bugs (reserved-word variables, bad array
  // bounds) that only surface on the real ROM. 400 frames is enough for each to
  // reach its idle GOTO loop (or a natural GAME OVER, which is not an error).
  for (const sample of cpc464Samples) {
    it(`${sample.name}`, () => {
      const m = new CpcMachine({ rom });
      const { bytes, errors } = tokenizeProgram(sample.text, 'basic10');
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
