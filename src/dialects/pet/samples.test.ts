import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { petSamples } from './samples';
import { pet } from './index';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { PetMachine, type PetRoms } from '../../emulator/pet/petMachine';

describe('pet sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of petSamples) {
      const { errors } = pet.tokenize(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('ships the canonical four plus Kaleidoscope, hello first', () => {
    expect(petSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('the kaleidoscope block assembles clean into its 7000 slot', () => {
    const kaleido = petSamples.find((s) => s.name === 'kaleido.bas')!;
    const [block] = materializeSampleBlocks(pet, kaleido);
    expect(block).toBeTruthy();
    expect(block!.address).toBe(0x7000);
    expect(block!.entry).toBe(0x7003);
    expect(block!.bytes.length).toBeGreaterThan(0);
  });
});

const ROOT = join(__dirname, '../../../public/roms/pet');
const roms: PetRoms = {
  basicB: readFileSync(join(ROOT, 'basic-4-b000.901465-23.bin')),
  basicC: readFileSync(join(ROOT, 'basic-4-c000.901465-20.bin')),
  basicD: readFileSync(join(ROOT, 'basic-4-d000.901465-21.bin')),
  editor: readFileSync(join(ROOT, 'edit-4-40-n-50Hz.901498-01.bin')),
  kernal: readFileSync(join(ROOT, 'kernal-4.901465-22.bin')),
  character: readFileSync(join(ROOT, 'characters-2.901447-10.bin')),
};

describe('pet kaleidoscope runs', () => {
  it('fills screen RAM with a 4-way mirrored pattern', async () => {
    const kaleido = petSamples.find((s) => s.name === 'kaleido.bas')!;
    const blocks = materializeSampleBlocks(pet, kaleido);
    // Drive the routine directly (POKE + SYS); the trailing GOTO keeps BASIC
    // busy so "READY." never prints over the top rows.
    const { image, errors } = pet.tokenize(
      '10 POKE 28672,3:POKE 28673,5:POKE 28674,2:SYS 28675\n20 GOTO 20\n',
    );
    expect(errors).toEqual([]);

    const m = new PetMachine({ roms });
    await m.whenReady();
    m.loadProgram(image, { blocks });
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 300; i++) m.runFrame();

    const cell = (a: number) => m.peek(0x8000 + a) & 0x7f;
    const distinct = new Set(Array.from({ length: 1000 }, (_, a) => cell(a)))
      .size;
    expect(distinct).toBeGreaterThan(4);

    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < 20; x++) {
        const v = cell(y * 40 + x);
        expect(cell(y * 40 + (39 - x))).toBe(v);
        expect(cell((24 - y) * 40 + x)).toBe(v);
        expect(cell((24 - y) * 40 + (39 - x))).toBe(v);
      }
    }
    m.dispose();
  }, 20_000);
});
