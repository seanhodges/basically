/**
 * The SAM's runtime introspection, against the machine rather than against a
 * second table: the variable watcher, the report decoder, the memory figures,
 * and the address space `./memoryMap.ts` says PEEK and POKE work in.
 *
 * One boot carries the whole journey. Booting this ROM is dearer than most -
 * it sizes 256K a page at a time before it will show a prompt - so the typed
 * checks are staged inside one test rather than each paying for a machine.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SamMachine } from './emulator/samMachine';
import { samcoupe } from './index';
import { samcoupeMemoryMap } from './memoryMap';
import { samcoupeMemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import { buildSamFile } from './samfile';
import { PAGE_BYTES } from './emulator/memory';

const ROM = new Uint8Array(
  readFileSync(
    path.resolve(__dirname, '../../../public/roms/samcoupe/samcoupe.rom'),
  ),
);

/** Frames a key is held, and the frames after it the ROM's scan needs. */
const KEY_FRAMES = 3;
/** Frames a typed command is given to finish and print. */
const COMMAND_FRAMES = 25;

/** The punctuation this test types; the SAM's is not the host's. */
const CHORDS: Record<string, string[]> = {
  ' ': ['Space'],
  '"': ['Quote'],
  '=': ['Equal'],
  $: ['ShiftLeft', 'Digit4'],
  '(': ['ShiftLeft', 'Digit8'],
  ')': ['ShiftLeft', 'Digit9'],
  ',': ['Comma'],
};

function tap(machine: SamMachine, chord: string[]): void {
  for (const token of chord) machine.setKey(token, true);
  for (let i = 0; i < KEY_FRAMES; i++) machine.runFrame();
  for (const token of chord) machine.setKey(token, false);
  for (let i = 0; i < KEY_FRAMES; i++) machine.runFrame();
}

function typeLine(machine: SamMachine, text: string): void {
  for (const ch of text) {
    const chord =
      CHORDS[ch] ?? (/[0-9]/.test(ch) ? [`Digit${ch}`] : [`Key${ch}`]);
    tap(machine, chord);
  }
  tap(machine, ['Enter']);
  for (let i = 0; i < COMMAND_FRAMES; i++) machine.runFrame();
}

/** The non-blank screen lines, which is where the ROM prints its own reports. */
function screen(machine: SamMachine): string[] {
  return (machine.readScreenText()?.lines ?? [])
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function named(machine: SamMachine, name: string) {
  return machine.readVariables().find((v) => v.name === name);
}

describe('samcoupe runtime introspection', () => {
  it('reads its variables, reports and memory figures off the running ROM', () => {
    const machine = new SamMachine({ rom: ROM });
    try {
      machine.bootToReady();

      // The declared budget is the machine's own free figure at a cold prompt,
      // not a brochure number. `programRamBudget.test.ts` re-checks this
      // through the registry once the dialect is registered.
      const cold = machine.readMemoryStats()!;
      expect(cold.free).toBe(samcoupe.programRamBytes);
      expect(cold.used).toBeGreaterThan(0);

      // A fresh machine is not a machine with no variables: SAM BASIC creates
      // the four graphics scaling variables before BASIC starts, and the
      // watcher shows what is there rather than what the user typed.
      expect(machine.readVariables().map((v) => v.name)).toEqual([
        'XOS',
        'XRG',
        'YOS',
        'YRG',
      ]);
      expect(named(machine, 'XRG')!.value).toBe('256');
      expect(named(machine, 'YRG')!.value).toBe('192');

      typeLine(machine, 'LET Z=5');
      typeLine(machine, 'LET COUNT=1024');
      typeLine(machine, 'LET Q$="HELLO"');
      typeLine(machine, 'DIM N(3)');
      typeLine(machine, 'LET N(2)=9');
      typeLine(machine, 'DIM S$(4)');

      // A multi-letter name, a string, a numeric array with a written element
      // and a string array - the four record shapes the two areas hold.
      expect(named(machine, 'Z')!.value).toBe('5');
      expect(named(machine, 'COUNT')!.value).toBe('1024');
      expect(named(machine, 'Q$')).toMatchObject({
        kind: 'string',
        value: '"hello"',
      });
      expect(named(machine, 'N()')).toMatchObject({
        kind: 'number-array',
        value: '[3] = 0, 9, 0',
      });
      expect(named(machine, 'S$()')).toMatchObject({
        kind: 'string-array',
        value: '[4]',
      });

      // Every pool the variables went into is charged, not just the program
      // area: the string and the two arrays are all above WKEND's reach.
      const after = machine.readMemoryStats()!;
      expect(after.used).toBeGreaterThan(cold.used);
      expect(cold.free - after.free).toBe(after.used - cold.used);

      // FREE is the ROM's own arithmetic over the same two pointers, so the
      // machine's answer and ours differ only by the workspace the PRINT
      // itself is holding while it evaluates.
      typeLine(machine, 'PRINT FREE');
      const reported = Number(screen(machine).at(-2));
      expect(reported).toBeGreaterThan(machine.readMemoryStats()!.free - 64);
      expect(reported).toBeLessThanOrEqual(machine.readMemoryStats()!.free);

      // A clean prompt is not an error, and the decoder says the same thing
      // the ROM printed on the line below it.
      expect(machine.readReport()).toMatchObject({ isError: false, code: '0' });
      expect(screen(machine).at(-1)).toContain('0 OK');

      typeLine(machine, 'NEXT J');
      expect(machine.readReport()).toMatchObject({
        isError: true,
        code: '5',
        message: 'NEXT without FOR',
      });
      expect(screen(machine).at(-1)).toContain('5 NEXT without FOR');

      // Report 2 is the one whose message the ROM assembles from the name it
      // could not find, so the decoder has to read that name back too.
      typeLine(machine, 'PRINT MISSING');
      expect(machine.readReport()).toMatchObject({
        isError: true,
        code: '2',
        message: 'MISSING not found',
      });
      expect(screen(machine).at(-1)).toContain('missing not found');

      // A FOR control variable's record carries its limit, step and loop
      // position after the value, and the next variable of the same letter is
      // reached through the chain rather than by stepping over the record - so
      // the extra bytes cost the walk nothing. Typed last, because an open FOR
      // at the prompt changes what the reports above would have said.
      typeLine(machine, 'FOR J=7 TO 9');
      expect(named(machine, 'J')).toMatchObject({ kind: 'number', value: '7' });

      // The map's central claim: a POKE address is relative to BASIC's base
      // page, so 0x4000 up is page 0 and 0x8000 up is the page above it -
      // whatever the CPU happens to have paged into those sections.
      typeLine(machine, 'POKE 20480,123');
      typeLine(machine, 'POKE 40960,77');
      expect(machine.mem.pageByte(0, 20480 - 0x4000)).toBe(123);
      expect(machine.mem.pageByte(1, 40960 - 0x8000)).toBe(77);
    } finally {
      machine.dispose();
    }
  }, 120000);

  it('lands a memory block where the map and the linter both say it goes', () => {
    // The round trip the two files have to agree on: a block declared at
    // `defaultAddress` is written into the machine, and the program reads it
    // back with a PEEK at that same number.
    const address = samcoupeMemoryBlocks.defaultAddress;
    const region = samcoupeMemoryMap.regions.find(
      (r) => address >= r.start && address <= r.end,
    )!;
    expect(region.kind).toBe('program');

    const { bytes } = tokenizeProgram(`10 PRINT PEEK ${address}\n20 STOP\n`);
    const machine = new SamMachine({ rom: ROM });
    try {
      machine.loadProgram(buildSamFile(bytes, 'peek'), {
        blocks: [
          {
            id: 'b1',
            name: 'probe',
            kind: 'code',
            address,
            bytes: new Uint8Array([0xa5]),
          },
        ],
      });
      // The block is in BASIC's own page at the offset the map's address names.
      expect(
        machine.mem.pageByte(
          Math.floor(address / PAGE_BYTES) - 1,
          address % PAGE_BYTES,
        ),
      ).toBe(0xa5);
      expect(screen(machine)).toContain('165');
    } finally {
      machine.dispose();
    }
  }, 120000);
});
