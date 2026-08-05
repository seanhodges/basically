import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { c64Samples } from './samples';
import { commodore64 } from './index';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { C64Machine, type C64Roms } from '../../emulator/c64/c64Machine';

describe('commodore64 sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of c64Samples) {
      const { errors } = commodore64.tokenize(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('matches the canonical sample set plus Kaleidoscope', () => {
    expect(c64Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('hello is the starter offered for a fresh document', () => {
    expect(commodore64.samples[0]!.name).toBe('hello.bas');
  });

  it('the kaleidoscope block assembles clean into its C000 slot', () => {
    const kaleido = c64Samples.find((s) => s.name === 'kaleido.bas')!;
    const [block] = materializeSampleBlocks(commodore64, kaleido);
    expect(block).toBeTruthy();
    expect(block!.address).toBe(0xc000);
    expect(block!.entry).toBe(0xc003);
    expect(block!.bytes.length).toBeGreaterThan(0);
  });
});

const ROOT = join(__dirname, '../../../public/roms/commodore64');
const roms: C64Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

describe('commodore64 kaleidoscope runs', () => {
  it('fills colour RAM with a 4-way mirrored pattern', async () => {
    const kaleido = c64Samples.find((s) => s.name === 'kaleido.bas')!;
    const blocks = materializeSampleBlocks(commodore64, kaleido);
    // Drive the routine directly (POKE + SYS) so the test needs no keyboard
    // scripting for the sample's own INPUT prompts.
    // The trailing GOTO keeps BASIC busy so the "READY." prompt never prints
    // over the freshly coloured top rows (the sample's own GET loop does the
    // same job).
    const { image, errors } = commodore64.tokenize(
      '10 POKE 49152,3:POKE 49153,5:POKE 49154,2:SYS 49155\n20 GOTO 20\n',
    );
    expect(errors).toEqual([]);

    const m = new C64Machine({ roms });
    await m.whenReady();
    m.loadProgram(image, { blocks });
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 300; i++) m.runFrame();

    const col = (a: number) => m.machine!.wires.cpuRead(0xd800 + a) & 0x0f;
    // The colour file holds a drawn pattern, not a plain CLS.
    const distinct = new Set(Array.from({ length: 1000 }, (_, a) => col(a)))
      .size;
    expect(distinct).toBeGreaterThan(4);

    // ...with 4-way mirror symmetry on every cell of the 40x25 grid.
    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < 20; x++) {
        const v = col(y * 40 + x);
        expect(col(y * 40 + (39 - x))).toBe(v);
        expect(col((24 - y) * 40 + x)).toBe(v);
        expect(col((24 - y) * 40 + (39 - x))).toBe(v);
      }
    }
    m.dispose();
  }, 20_000);
});
