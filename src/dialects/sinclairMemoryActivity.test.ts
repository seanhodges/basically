import { describe, expect, it } from 'vitest';
import { Zx80Memory } from './zx80/emulator/memory';
import { Zx81Memory } from './zx81/emulator/memory';
import { READ_BIT, WRITE_BIT } from '../emulator/memoryActivityBuffer';

/**
 * Memory activity recording on the two Sinclair buses, which answer this
 * identically and differ only in how much ROM they carry. Both stamp the raw
 * CPU address rather than the address the read resolves to, which is what makes
 * the echo region legible as itself in the activity view.
 */
interface SinclairMemory {
  read(addr: number): number;
  write(addr: number, value: number): void;
  activity: { enabled: boolean; hits: Uint8Array; drain(): Uint8Array };
}

const BUSES: [string, (ram: number) => SinclairMemory][] = [
  ['ZX80', (ram) => new Zx80Memory(new Uint8Array(4096), ram)],
  ['ZX81', (ram) => new Zx81Memory(new Uint8Array(8192), ram)],
];

describe('Sinclair memory activity recording', () => {
  it('records nothing while disabled', () => {
    for (const [name, make] of BUSES) {
      const mem = make(16);
      mem.read(0x4000);
      mem.write(0x4000, 0x42);
      expect(
        mem.activity.drain().every((b) => b === 0),
        `${name} recorded activity while disabled`,
      ).toBe(true);
    }
  });

  it('stamps read and write bits at the raw CPU address when enabled', () => {
    for (const [name, make] of BUSES) {
      const mem = make(16);
      mem.activity.enabled = true;
      mem.read(0x4000); // RAM read
      mem.write(0x5000, 0x42); // RAM write
      mem.read(0x5000); // read the address it just wrote
      mem.read(0x0000); // ROM read still stamps

      const hits = mem.activity.hits;
      expect(hits[0x4000], `${name} missed a RAM read`).toBe(READ_BIT);
      expect(hits[0x5000], `${name} missed a read after write`).toBe(
        READ_BIT | WRITE_BIT,
      );
      expect(hits[0x0000], `${name} missed a ROM read`).toBe(READ_BIT);
      // An untouched address stays clear.
      expect(hits[0x6000], `${name} stamped an address nothing touched`).toBe(
        0,
      );
    }
  });

  it('records the echo region distinctly from the RAM it mirrors', () => {
    for (const [name, make] of BUSES) {
      const mem = make(16);
      mem.activity.enabled = true;
      mem.read(0xc000); // echo of 0x4000, but stamped at its own CPU address
      expect(mem.activity.hits[0xc000], `${name} lost the echo read`).toBe(
        READ_BIT,
      );
      expect(
        mem.activity.hits[0x4000],
        `${name} stamped the mirrored RAM instead of the echo`,
      ).toBe(0);
    }
  });

  it('still reads and writes RAM correctly while recording', () => {
    for (const [name, make] of BUSES) {
      const mem = make(16);
      mem.activity.enabled = true;
      mem.write(0x4000, 0x7f);
      expect(mem.read(0x4000), `${name} lost a byte while recording`).toBe(
        0x7f,
      );
    }
  });
});
