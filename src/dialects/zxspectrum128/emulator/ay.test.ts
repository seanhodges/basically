import { describe, expect, it } from 'vitest';
import { Ay38912 } from './ay';

describe('Ay38912 register file', () => {
  it('latches a register on 0xFFFD then writes/reads it on 0xBFFD/0xFFFD', () => {
    const ay = new Ay38912();
    ay.selectRegister(7); // mixer (8-bit)
    ay.writeData(0x3c);
    expect(ay.readData()).toBe(0x3c);
    expect(ay.readRegister(7)).toBe(0x3c);
  });

  it('masks narrow registers to their real width', () => {
    const ay = new Ay38912();
    ay.writeRegister(1, 0xff); // tone-coarse: 4 bits
    expect(ay.readRegister(1)).toBe(0x0f);
    ay.writeRegister(8, 0xff); // channel A volume: 5 bits
    expect(ay.readRegister(8)).toBe(0x1f);
    ay.writeRegister(13, 0xff); // envelope shape: 4 bits
    expect(ay.readRegister(13)).toBe(0x0f);
    ay.writeRegister(0, 0xff); // tone-fine: full 8 bits
    expect(ay.readRegister(0)).toBe(0xff);
  });

  it('wraps the register selector to 0-15', () => {
    const ay = new Ay38912();
    ay.selectRegister(0x17); // 0x17 & 0x0F = 7
    ay.writeData(0x42);
    expect(ay.readRegister(7)).toBe(0x42);
  });

  it('clears every register and the selector on reset', () => {
    const ay = new Ay38912();
    ay.selectRegister(5);
    ay.writeData(0x0a);
    ay.reset();
    for (let r = 0; r < 16; r++) expect(ay.readRegister(r)).toBe(0);
    expect(ay.readData()).toBe(0); // selector back to 0
  });
});
