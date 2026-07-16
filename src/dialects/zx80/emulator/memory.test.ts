import { describe, expect, it } from 'vitest';
import { Zx80Memory } from './memory';
import { READ_BIT, WRITE_BIT } from '../../../emulator/memoryActivityBuffer';

const rom = () => new Uint8Array(4096);

describe('Zx80Memory activity recording', () => {
  it('records nothing while disabled', () => {
    const mem = new Zx80Memory(rom(), 16);
    mem.read(0x4000);
    mem.write(0x4000, 0x42);
    const drained = mem.activity.drain();
    expect(drained.every((b) => b === 0)).toBe(true);
  });

  it('stamps read and write bits at the raw CPU address when enabled', () => {
    const mem = new Zx80Memory(rom(), 16);
    mem.activity.enabled = true;
    mem.read(0x4000); // RAM read
    mem.write(0x5000, 0x42); // RAM write
    mem.read(0x5000); // read the address it just wrote
    mem.read(0x0000); // ROM read still stamps

    const hits = mem.activity.hits;
    expect(hits[0x4000]).toBe(READ_BIT);
    expect(hits[0x5000]).toBe(READ_BIT | WRITE_BIT);
    expect(hits[0x0000]).toBe(READ_BIT);
    // An untouched address stays clear.
    expect(hits[0x6000]).toBe(0);
  });

  it('records the echo region distinctly from the RAM it mirrors', () => {
    const mem = new Zx80Memory(rom(), 16);
    mem.activity.enabled = true;
    mem.read(0xc000); // echo of 0x4000, but stamped at its own CPU address
    expect(mem.activity.hits[0xc000]).toBe(READ_BIT);
    expect(mem.activity.hits[0x4000]).toBe(0);
  });

  it('still reads and writes RAM correctly while recording', () => {
    const mem = new Zx80Memory(rom(), 16);
    mem.activity.enabled = true;
    mem.write(0x4000, 0x7f);
    expect(mem.read(0x4000)).toBe(0x7f);
  });
});
