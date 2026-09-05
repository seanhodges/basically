// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The tape, checked against the machine that has to read and write it.
 *
 * Every number in `../tape.ts` and `../audio/cassetteEncoder.ts` was read off
 * this ROM in the first place, so nothing here is a self-consistency check: the
 * shipped Monitor writes the blocks and is handed the signal back, and if the
 * container layout or the modulation drifts, BASIC-G stops loading.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitRomImage } from '../romImage';
import { tokenizeProgram } from '../tokenizer';
import { PROGRAM_BASE, VARTAB } from '../addresses';
import { buildTapeFile } from '../audio/cassetteEncoder';
import type { MachineFileEntry, MachineFileStore } from '../../types';
import {
  BASIC_FILE_TYPE,
  DATA_FILE_TYPE,
  DEFAULT_FILE_NUMBER,
  buildPtpImage,
  parseTapeImage,
  programTapeFile,
  tapeBlocks,
  type Pmd85TapeFile,
} from '../tape';
import { Pmd85Machine } from './pmd85Machine';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/pmd85.rom')),
);

function machine(files?: MachineFileStore): Pmd85Machine {
  return new Pmd85Machine({ ...splitRomImage(rom), files });
}

/** Map-backed MachineFileStore, same shape as commodore/diskDrive.test.ts. */
function fakeStore() {
  const files = new Map<string, { data: Uint8Array; kind?: string }>();
  const store: MachineFileStore = {
    save: (name, data, meta) =>
      void files.set(name, { data: data.slice(), kind: meta?.kind }),
    load: (name) => files.get(name)?.data.slice() ?? null,
    list: (): MachineFileEntry[] =>
      [...files.entries()].map(([name, f]) => ({
        name,
        size: f.data.length,
        updatedAt: 1,
        kind: f.kind,
      })),
    delete: (name) => files.delete(name),
  };
  return { store, files };
}

function screenLines(pmd: Pmd85Machine): string[] {
  return pmd.readScreenText()!.lines.map((l) => l.trimEnd());
}

/** Type at the emulated keyboard; the machine's own helper, as `RUN` uses it. */
function type(pmd: Pmd85Machine, line: string): void {
  (pmd as unknown as { type(line: string): void }).type(line);
}

function readByte(pmd: Pmd85Machine, address: number): number {
  return (pmd as unknown as { mem: { read(a: number): number } }).mem.read(
    address,
  );
}

/**
 * Run frames until `done`, rather than for a fixed count.
 *
 * A tape command takes as long as the tape does - a header block alone is 63
 * bytes at 1200 baud behind nearly three seconds of leader - so a frame count
 * would be either a guess or a long wait.
 */
function runUntil(pmd: Pmd85Machine, what: string, done: () => boolean): void {
  for (let frame = 0; frame < 1200; frame++) {
    pmd.runFrame();
    if (done()) return;
  }
  throw new Error(`BASIC-G never ${what}`);
}

function readWord(pmd: Pmd85Machine, address: number): number {
  return readByte(pmd, address) | (readByte(pmd, address + 1) << 8);
}

describe('PMD 85 tape', () => {
  it('writes the blocks tape.ts builds when BASIC-G runs SAVE', () => {
    // The whole container format, pinned against its author. The program goes
    // in through loadProgram (the keyboard helper can only type letters,
    // digits and spaces), and SAVE is typed once it has finished.
    const pmd = machine();
    const { program } = tokenizeProgram('10 END\n');
    pmd.loadProgram(program);
    for (let frame = 0; frame < 120 && pmd.isProgramRunning(); frame++) {
      pmd.runFrame();
    }
    // BASIC-G saves TXTTAB through VARTAB inclusive - one byte more than the
    // program - which is what programTapeFile() appends. That is also how long
    // the recording is: a 63-byte header block, then the body and its checksum.
    const varTab = readWord(pmd, VARTAB);
    expect(varTab).toBe(PROGRAM_BASE + program.length);
    const tapeBytes = 63 + program.length + 2;
    type(pmd, `SAVE ${DEFAULT_FILE_NUMBER}`);
    runUntil(
      pmd,
      'wrote the tape',
      () => pmd.recordedTape().length >= tapeBytes,
    );
    const expected = programTapeFile(program, {
      name: '',
      start: PROGRAM_BASE,
    });
    expected.bytes[program.length] = readByte(pmd, varTab);

    const written = pmd.recordedTape();
    const blocks = tapeBlocks([expected]);
    expect(Array.from(written)).toEqual([
      ...Array.from(blocks[0]!),
      ...Array.from(blocks[1]!),
    ]);

    // And what it wrote reads back as the file it was: the type letter is `>`,
    // the load address is the program area, and the name field is blank
    // because the machine's tape commands take a number instead.
    const parsed = parseTapeImage(written);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]!.header).toEqual({
      number: DEFAULT_FILE_NUMBER,
      type: BASIC_FILE_TYPE,
      start: PROGRAM_BASE,
      name: '',
    });
  });

  it('loads a program back off the tape the exporter writes', () => {
    // The modulation, end to end: the deck plays what the `.wav` export
    // records, and the Monitor's software receiver - which is polling one bit
    // of the 8251's status register - has to find the bits in it.
    const source = '10 PRINT "TAPE"\n20 END\n';
    const pmd = machine();
    pmd.bootToReady();
    pmd.playTape([buildTapeFile(source, 'TAPE')]);
    const { program } = tokenizeProgram(source);
    type(pmd, `LOAD ${DEFAULT_FILE_NUMBER}`);
    // LOAD derives the end of the program from the header's length field, so
    // VARTAB moving is the interpreter saying the whole file arrived.
    runUntil(
      pmd,
      'read the tape',
      () => readWord(pmd, VARTAB) === PROGRAM_BASE + program.length,
    );

    const loaded = Array.from({ length: program.length }, (_, i) =>
      readByte(pmd, PROGRAM_BASE + i),
    );
    expect(loaded).toEqual(Array.from(program));
  });

  it('runs a program with a tape still turning in the deck', () => {
    // A multi-file import mounts its other files, and from then on the tape is
    // moving under everything the machine does. The keyboard reads the same
    // status register the tape arrives on, so this is where a deck that
    // answered the wrong bit would show up: as a machine that cannot type.
    const data: Pmd85TapeFile = {
      header: { number: 2, type: 0x44, start: 0x7000, name: 'SCORES' },
      bytes: Uint8Array.of(1, 2, 3, 4),
    };
    const pmd = machine();
    pmd.loadProgram(tokenizeProgram('10 PRINT "RUNS"\n20 END\n').program, {
      tapeFiles: [{ name: 'SCORES', kind: 'data', tap: buildPtpImage([data]) }],
    });
    for (let frame = 0; frame < 200 && pmd.isProgramRunning(); frame++) {
      pmd.runFrame();
    }
    expect(pmd.isProgramRunning()).toBe(false);
    expect(pmd.readScreenText()!.lines.map((l) => l.trimEnd())).toContain(
      'RUNS',
    );
  });

  it('writes a headed data file when a program runs DSAVE', () => {
    // What `DSAVE` puts on the tape, read off the interpreter rather than
    // assumed. It is a whole file and not a bare block: a 63-byte header
    // carrying the number the program named it by and the `D` type letter that
    // separates a program's data from a program, then the array.
    //
    // The spelling is the interpreter's own and is not the one a comma-shaped
    // reading of `DSAVE n,v` would suggest: the argument parser wants a
    // semicolon and an array's first element, and a comma is `Syntax err`.
    const { store, files } = fakeStore();
    const pmd = machine(store);
    pmd.loadProgram(
      tokenizeProgram(
        '10 DIM A(3)\n20 A(1)=4\n30 A(2)=9\n40 DSAVE 2;A(0)\n50 END\n',
      ).program,
    );
    runUntil(pmd, 'wrote the array', () => files.size > 0);

    expect([...files.keys()]).toEqual(['FILE 2']);
    const parsed = parseTapeImage(files.get('FILE 2')!.data);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.headerless).toEqual([]);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]!.header.number).toBe(2);
    expect(parsed.files[0]!.header.type).toBe(DATA_FILE_TYPE);
    // The header's name field is not the machine's to fill - `DSAVE` leaves
    // whatever was lying above the array in it - which is why the store keys on
    // the number instead.
    expect(files.get('FILE 2')!.kind).toBe('data');
  });

  it('reads a saved array back inside the same run', () => {
    // The whole point of keeping the file: the deck puts what the program saved
    // back on the tape, so its own `DLOAD` finds it with no user to rewind
    // anything. Without that the program does not fail, it waits.
    const { store } = fakeStore();
    const pmd = machine(store);
    pmd.loadProgram(
      tokenizeProgram(
        '10 DIM A(3)\n' +
          '20 A(1)=4\n' +
          '30 A(2)=9\n' +
          '40 DSAVE 2;A(0)\n' +
          '50 DIM B(3)\n' +
          '60 DLOAD 2;B(0)\n' +
          '70 PRINT "B=";B(2)\n' +
          '80 END\n',
      ).program,
    );
    runUntil(pmd, 'read the array back', () =>
      screenLines(pmd).some((l) => l.includes('B= 9')),
    );
  });

  it('keeps nothing when the machine was handed no store', () => {
    // The deck records and plays exactly as it did before there was a store to
    // hand it; a machine constructed without one must not start behaving as if
    // it had one.
    const pmd = machine();
    pmd.loadProgram(
      tokenizeProgram('10 DIM A(3)\n20 A(1)=4\n30 DSAVE 2;A(0)\n40 END\n')
        .program,
    );
    runUntil(
      pmd,
      'wrote the array',
      () => parseTapeImage(pmd.recordedTape()).files.length === 1,
    );
  });

  it('leaves the status register alone with no tape in the deck', () => {
    // The keyboard depends on this register, so a deck that answered when it
    // was empty would break typing rather than tape loading.
    const pmd = machine();
    pmd.bootToReady();
    const read = (pmd as unknown as { readPort(p: number): number }).readPort;
    const status = read.call(pmd, 0x1f);
    expect(status & 0x80).toBe(0);
  });
});
