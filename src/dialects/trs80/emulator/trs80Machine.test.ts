import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Trs80Machine } from './trs80Machine';
import { tokenizeProgram } from '../tokenizer';

// The Level II ROM is copyright Tandy/Microsoft and is NOT bundled (see the
// licensing note in public/roms/ATTRIBUTION.md). This Z80 + ROM machine is the
// optional accuracy mode; these tests boot the real ROM when the user has
// supplied it and skip cleanly otherwise, so CI stays green without it.
const ROM_PATH = path.resolve(__dirname, '../../../../public/roms/trs80.rom');
const ROM = existsSync(ROM_PATH)
  ? new Uint8Array(readFileSync(ROM_PATH))
  : null;
const withRom = ROM ? it : it.skip;

describe('trs80 machine', () => {
  withRom('boots the ROM, injects a program and renders to video RAM', () => {
    const machine = new Trs80Machine({ rom: ROM!, ramKb: 16 });
    const { program, errors } = tokenizeProgram(
      '10 PRINT "HELLO"\n20 GOTO 20\n',
    );
    expect(errors).toEqual([]);

    machine.loadProgram(program);
    for (let i = 0; i < 60; i++) machine.runFrame();

    // The program tokens were poked at TXTTAB (0x42E8): link(2) + lineNo(2).
    expect(machine.mem.read(0x42e8 + 4)).toBe(0xb2); // PRINT token

    // "HELLO" should have been printed somewhere on the 64×16 screen.
    let found = false;
    for (let row = 0; row < 16; row++) {
      if (machine.readScreenRow(row).includes('HELLO')) found = true;
    }
    expect(found).toBe(true);

    machine.dispose();
  });
});
