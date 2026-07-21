import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vic20Samples } from './samples';
import { vic20 } from './index';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { Vic20Machine } from '../../emulator/vic20/vic20Machine';
import type { Vic20Roms } from '../../emulator/vic20/memory';

describe('vic20 sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of vic20Samples) {
      const { errors } = vic20.tokenize(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('ships the canonical four plus Kaleidoscope, hello first', () => {
    expect(vic20Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('the kaleidoscope block assembles clean into its 1C00 slot', () => {
    const kaleido = vic20Samples.find((s) => s.name === 'kaleido.bas')!;
    const [block] = materializeSampleBlocks(vic20, kaleido);
    expect(block).toBeTruthy();
    expect(block!.address).toBe(0x1c00);
    expect(block!.entry).toBe(0x1c03);
    expect(block!.bytes.length).toBeGreaterThan(0);
  });
});

const ROOT = join(__dirname, '../../../public/roms/vic20');
const roms: Vic20Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

describe('vic20 kaleidoscope runs', () => {
  it('fills colour RAM with a 4-way mirrored pattern', async () => {
    const kaleido = vic20Samples.find((s) => s.name === 'kaleido.bas')!;
    const blocks = materializeSampleBlocks(vic20, kaleido);
    // Drive the routine directly (POKE + SYS); the trailing GOTO keeps BASIC
    // busy so "READY." never prints over the top rows.
    const { image, errors } = vic20.tokenize(
      '10 POKE 7168,3:POKE 7169,5:POKE 7170,2:SYS 7171\n20 GOTO 20\n',
    );
    expect(errors).toEqual([]);

    const m = new Vic20Machine({ roms });
    await m.whenReady();
    m.loadProgram(image, { blocks });
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 300; i++) m.runFrame();

    const col = (a: number) => m.peek(0x9600 + a) & 0x0f;
    const distinct = new Set(Array.from({ length: 22 * 23 }, (_, a) => col(a)))
      .size;
    expect(distinct).toBeGreaterThan(4);

    // 4-way mirror symmetry on the 22x23 grid.
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 11; x++) {
        const v = col(y * 22 + x);
        expect(col(y * 22 + (21 - x))).toBe(v);
        expect(col((22 - y) * 22 + x)).toBe(v);
        expect(col((22 - y) * 22 + (21 - x))).toBe(v);
      }
    }
    m.dispose();
  }, 20_000);
});
