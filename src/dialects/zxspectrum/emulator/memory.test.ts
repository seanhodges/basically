import { describe, expect, it } from 'vitest';
import { SpectrumMemory } from './memory';
import { READ_BIT, WRITE_BIT } from '../../../emulator/memoryActivityBuffer';

const rom = () => new Uint8Array(16384);

describe('SpectrumMemory activity recording', () => {
  it('records nothing while disabled', () => {
    const mem = new SpectrumMemory(rom());
    mem.read(0x8000);
    mem.write(0x8000, 0x42);
    const drained = mem.activity.drain();
    expect(drained.every((b) => b === 0)).toBe(true);
  });

  it('stamps read and write bits when enabled', () => {
    const mem = new SpectrumMemory(rom());
    mem.activity.enabled = true;
    mem.read(0x8000); // RAM read
    mem.write(0x9000, 0x42); // RAM write
    mem.read(0x9000); // read the address it just wrote
    mem.read(0x0000); // ROM read still stamps

    const hits = mem.activity.hits;
    expect(hits[0x8000]).toBe(READ_BIT);
    expect(hits[0x9000]).toBe(READ_BIT | WRITE_BIT);
    expect(hits[0x0000]).toBe(READ_BIT);
    // An untouched address stays clear.
    expect(hits[0xa000]).toBe(0);
  });

  it('masks addresses to 16 bits before stamping', () => {
    const mem = new SpectrumMemory(rom());
    mem.activity.enabled = true;
    mem.read(0x18000); // wraps to 0x8000
    expect(mem.activity.hits[0x8000]).toBe(READ_BIT);
  });

  it('still reads and writes RAM correctly while recording', () => {
    const mem = new SpectrumMemory(rom());
    mem.activity.enabled = true;
    mem.write(0x8000, 0x7f);
    expect(mem.read(0x8000)).toBe(0x7f);
  });
});
