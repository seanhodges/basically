import { describe, it, expect } from 'vitest';
import { BASIC_RAM_BASE, PROGRAM_BASE } from './addresses';

describe('vic20 addresses', () => {
  it('starts BASIC text one byte above the RAM base', () => {
    // Not an off-by-one: the ROM keeps a zero link byte at the foot of BASIC
    // RAM and begins the first line record after it, which is why the memory
    // map's program region starts one byte below TXTTAB.
    expect(PROGRAM_BASE).toBe(BASIC_RAM_BASE + 1);
  });

  it('pins the documented addresses', () => {
    expect(BASIC_RAM_BASE).toBe(0x1000);
    expect(PROGRAM_BASE).toBe(0x1001);
  });
});
