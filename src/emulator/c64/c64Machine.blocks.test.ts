import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { C64Machine, type C64Roms } from './c64Machine';
import type { MemoryBlock } from '../../dialects/types';
import { commodore64 } from '../../dialects/commodore64';

const ROOT = join(__dirname, '../../../public/roms/commodore64');
const roms: C64Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

const BOOT_TIMEOUT_MS = 20_000;

/** A side-effect-free CPU-bus read (default banking: RAM at $C000, I/O at $D020). */
function peek(m: C64Machine, addr: number): number {
  return m.machine!.wires.cpuRead(addr);
}

describe('C64Machine memory blocks', () => {
  it(
    'injects a code block that RUN can SYS into',
    async () => {
      // LDA #$02 / STA $D020 / RTS - turns the border red ($D020 low nibble 2).
      const codeBytes = [0xa9, 0x02, 0x8d, 0x20, 0xd0, 0x60];
      const block: MemoryBlock = {
        id: 'blk1',
        name: 'border',
        address: 0xc000,
        bytes: Uint8Array.from(codeBytes),
        kind: 'code',
      };
      // 49152 = $C000.
      const { image, errors } = commodore64.tokenize('10 SYS 49152\n');
      expect(errors).toEqual([]);

      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image, { blocks: [block] });
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();

      // The block bytes are readable back at their address ($C000 is always RAM).
      for (let i = 0; i < codeBytes.length; i++) {
        expect(peek(m, 0xc000 + i)).toBe(codeBytes[i]);
      }
      // ...and running SYS 49152 executed them, painting the border red.
      expect(peek(m, 0xd020) & 0x0f).toBe(2);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'loads normally when no blocks are supplied',
    async () => {
      const { image, errors } = commodore64.tokenize('10 PRINT "HI"\n');
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();
      // Border untouched from its power-on light blue ($0E).
      expect(peek(m, 0xd020) & 0x0f).toBe(0x0e);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );
});
