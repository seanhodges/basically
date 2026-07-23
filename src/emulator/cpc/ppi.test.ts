import { describe, expect, it } from 'vitest';
import { Ppi, AyFunction, type PpiHost } from './ppi';

/** A fake host: a tiny AY register file plus a keyboard whose lines echo back. */
function makeHost(overrides: Partial<PpiHost> = {}) {
  const regs = new Uint8Array(16);
  let selected = 0;
  const keyLines = new Uint8Array(16).fill(0xff);
  const host: PpiHost = {
    aySelectRegister: (r) => {
      selected = r & 0x0f;
    },
    ayWrite: (v) => {
      regs[selected] = v;
    },
    ayPortRead: (line) => (selected === 14 ? keyLines[line]! : regs[selected]!),
    vsyncActive: () => false,
    tapeInput: () => 0,
    ...overrides,
  };
  return { host, regs, keyLines, selected: () => selected };
}

describe('Ppi AY control', () => {
  it('selects an AY register when Port C carries the select function', () => {
    const { host, selected } = makeHost();
    const ppi = new Ppi(host);
    ppi.write(0, 7); // Port A = register number 7
    ppi.write(2, AyFunction.Select << 6); // Port C: BDIR=1 BC1=1
    expect(selected()).toBe(7);
  });

  it('writes the selected AY register with the Port A value', () => {
    const { host, regs } = makeHost();
    const ppi = new Ppi(host);
    ppi.write(0, 12); // select register 12...
    ppi.write(2, AyFunction.Select << 6);
    ppi.write(0, 0x3c); // ...Port A = data
    ppi.write(2, AyFunction.Write << 6); // BDIR=1 BC1=0
    expect(regs[12]).toBe(0x3c);
  });
});

describe('Ppi keyboard read path', () => {
  it('reads the selected matrix line back through the AY on Port A', () => {
    const { host, keyLines } = makeHost();
    keyLines[3] = 0xfe; // a key pressed on line 3, bit 0
    const ppi = new Ppi(host);
    // Point the AY at its I/O port (register 14).
    ppi.write(0, 14);
    ppi.write(2, AyFunction.Select << 6);
    // Configure Port A as input (control word bit7 + bit4).
    ppi.write(3, 0x90);
    // Select line 3 and set the read function on Port C.
    ppi.write(2, (AyFunction.Read << 6) | 3);
    expect(ppi.read(0)).toBe(0xfe);
    expect(ppi.keyboardLine).toBe(3);
  });
});

describe('Ppi Port B inputs', () => {
  it('reports the Amstrad id and 50Hz link with VSYNC low', () => {
    const { host } = makeHost();
    const ppi = new Ppi(host);
    // bits1-3 = 7 (Amstrad) → 0x0E, bit4 50Hz → 0x10, bit5 /EXP → 0x20.
    expect(ppi.read(1)).toBe(0x0e | 0x10 | 0x20);
  });

  it('sets bit 0 while the CRTC asserts VSYNC', () => {
    let vsync = false;
    const { host } = makeHost({ vsyncActive: () => vsync });
    const ppi = new Ppi(host);
    expect(ppi.read(1) & 0x01).toBe(0);
    vsync = true;
    expect(ppi.read(1) & 0x01).toBe(0x01);
  });

  it('sets bit 7 from the cassette read line', () => {
    const { host } = makeHost({ tapeInput: () => 1 });
    const ppi = new Ppi(host);
    expect(ppi.read(1) & 0x80).toBe(0x80);
  });
});

describe('Ppi Port C bit set/reset', () => {
  it('toggles a single Port C bit via the BSR control word', () => {
    const { host } = makeHost();
    const ppi = new Ppi(host);
    ppi.write(2, 0x00); // Port C all low
    ppi.write(3, (4 << 1) | 1); // set bit 4 (cassette motor)
    expect(ppi.tapeMotorOn).toBe(true);
    ppi.write(3, 4 << 1); // reset bit 4
    expect(ppi.tapeMotorOn).toBe(false);
  });
});
