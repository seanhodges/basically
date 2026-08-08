import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { AtomMachine, configureNodeRomPath } from './atomMachine';
import { tokenizeProgram } from '../../dialects/atom/tokenizer';
import type {
  MachineFileEntry,
  MachineFileStore,
  MemoryBlock,
} from '../../dialects/types';
import { WRITE_BIT } from '../memoryActivityBuffer';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/**
 * The Atom's MC6847 screen RAM (0x8000–0x83FF) as printable text. The VDG
 * stores letters at 0x00–0x1F (ASCII minus 0x40) and keeps 0x20–0x3F as ASCII,
 * with the high bit meaning inverse video — so masking 0x80 and folding the
 * low range back up to ASCII recovers the displayed characters.
 */
function screenText(machine: AtomMachine): string {
  return machine.readScreenText()?.lines.join('\n') ?? '';
}

/** Map-backed MachineFileStore, same shape as diskDrive.test.ts. */
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

/** Run frames (yielding to the microtask queue) until the predicate holds. */
async function runUntil(
  machine: AtomMachine,
  predicate: () => boolean,
  maxFrames = 600,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    // Let async work (ROM loads, the load pipeline) make progress.
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('AtomMachine (jsbeeb Atom adapter)', () => {
  it('boots the Atom ROM to the ACORN ATOM banner', async () => {
    const machine = new AtomMachine();
    await machine.whenReady();
    const booted = await runUntil(machine, () =>
      screenText(machine).includes('ACORN ATOM'),
    );
    expect(booted).toBe(true);
    machine.dispose();
  }, 30000);

  it('loads a program, auto-RUNs it and shows its output', async () => {
    const machine = new AtomMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO ATOM"\n20 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO ATOM'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('reads the booted screen back as text', async () => {
    const machine = new AtomMachine();
    expect(machine.readScreenText()).toBeNull(); // not up yet: no answer
    await machine.whenReady();
    await runUntil(machine, () =>
      (machine.readScreenText()?.lines.join('\n') ?? '').includes('ACORN ATOM'),
    );
    const s = machine.readScreenText()!;
    expect(s.cols).toBe(32);
    expect(s.rows).toBe(16);
    for (const line of s.lines) expect([...line]).toHaveLength(32);
    expect(s.lines.join('\n')).toContain('ACORN ATOM');
    machine.dispose();
  }, 30000);

  it('reads lower case back as lower case, though the VDG stores it inverse', async () => {
    // The MC6847 has no lower-case glyphs: OSWRCH writes 'a' as #81, an
    // inverse 'A'. Verified against the real kernel ROM - PRINTing "AZ az"
    // stores 01 1A 20 81 9A - so the reader has to undo it or a program's own
    // output comes back in the wrong case.
    const machine = new AtomMachine();
    machine.loadProgram(tokenizeProgram('10 PRINT "AZ az"\n20 END\n').bytes);
    const ran = await runUntil(machine, () =>
      (machine.readScreenText()?.lines.join('\n') ?? '').includes('AZ az'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('reads an inverse-video cell as the character it draws', async () => {
    const machine = new AtomMachine();
    await machine.whenReady();
    await runUntil(machine, () =>
      (machine.readScreenText()?.lines.join('\n') ?? '').includes('ACORN ATOM'),
    );
    // #A0 is an inverse space - what the cursor is drawn with - and must read
    // as a space, not as a stray glyph.
    machine.processor.writemem(0x8000, 0xa0);
    // #21 is '!' in the chip's own set and stays itself.
    machine.processor.writemem(0x8001, 0x21);
    const line = machine.readScreenText()!.lines[0]!;
    expect([...line].slice(0, 2).join('')).toBe(' !');
    machine.dispose();
  }, 30000);

  it('records live memory activity only while enabled', async () => {
    const machine = new AtomMachine();
    machine.loadProgram(tokenizeProgram('10 A=1\n20 GOTO 10\n').bytes);
    // Wait until BASIC is up and the program is running.
    await runUntil(machine, () => machine.readMemoryStats() !== null);
    // Off by default: nothing to drain.
    expect(machine.drainMemoryActivity()).toBeNull();

    machine.setMemoryActivityRecording(true);
    for (let i = 0; i < 3; i++) machine.runFrame();
    const hits = machine.drainMemoryActivity();
    expect(hits).not.toBeNull();
    expect(hits!.length).toBe(0x10000);
    // The Atom ROMs (kernel + FP + BASIC) live at 0xC000-0xFFFF and are executed
    // constantly, so some address there must have been read while looping.
    let romTouched = false;
    for (let a = 0xc000; a < 0x10000; a++) if (hits![a]) romTouched = true;
    expect(romTouched).toBe(true);
    // Zero page is written as BASIC runs.
    let zpWritten = false;
    for (let a = 0; a < 0x100; a++)
      if ((hits![a]! & WRITE_BIT) !== 0) zpWritten = true;
    expect(zpWritten).toBe(true);

    machine.setMemoryActivityRecording(false);
    machine.runFrame();
    expect(machine.drainMemoryActivity()).toBeNull();
    machine.dispose();
  }, 60000);

  it('reports plausible actual RAM figures while a program runs', async () => {
    const machine = new AtomMachine();
    expect(machine.readMemoryStats()).toBeNull(); // not initialised yet
    const { bytes } = tokenizeProgram('10 PRINT "HELLO ATOM"\n20 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO ATOM'),
    );
    expect(ran).toBe(true);
    const stats = machine.readMemoryStats();
    expect(stats).not.toBeNull();
    // At least the injected program text is in use.
    expect(stats!.used).toBeGreaterThanOrEqual(bytes.length);
    expect(stats!.free).toBeGreaterThan(0);
    // TEXT_START (#2900) to the VDG screen (#8000).
    expect(stats!.used + stats!.free).toBe(0x8000 - 0x2900);
    machine.dispose();
  }, 60000);

  it('exposes the audio seam and drains without error', async () => {
    const machine = new AtomMachine();
    // The seam is detected per-machine via these two members.
    expect(typeof machine.readAudio).toBe('function');
    expect(machine.audioSampleRate).toBeGreaterThan(0);
    await machine.whenReady();
    // Run a few frames and drain; a silent boot yields a finite Float32 stream
    // (empty or otherwise), never a throw.
    for (let i = 0; i < 20; i++) {
      machine.runFrame();
      const samples = machine.readAudio!();
      expect(samples).toBeInstanceOf(Float32Array);
      for (let j = 0; j < samples.length; j++) {
        expect(Number.isFinite(samples[j]!)).toBe(true);
      }
    }
    machine.dispose();
  }, 30000);

  it('pokes the program image at #2900 and fixes the top-of-text pointer', async () => {
    const machine = new AtomMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HI"\n');
    machine.loadProgram(bytes);
    // Wait until the program has been injected and run.
    await runUntil(machine, () => screenText(machine).includes('HI'));
    const cpu = machine.processor;
    // The image sits at #2900 byte-for-byte…
    for (let i = 0; i < bytes.length; i++) {
      expect(cpu.readmem(0x2900 + i)).toBe(bytes[i]);
    }
    // …and the top-of-text pointer at #0D/#0E points just past it.
    const top = cpu.readmem(0x0d) | (cpu.readmem(0x0e) << 8);
    expect(top).toBe(0x2900 + bytes.length);
    machine.dispose();
  }, 60000);

  it('writes a memory block into RAM before running the program', async () => {
    const machine = new AtomMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HI"\n');
    const block: MemoryBlock = {
      id: 'b1',
      name: 'code1',
      address: 0x5000,
      bytes: new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a]),
      kind: 'code',
    };
    machine.loadProgram(bytes, { blocks: [block] });
    // Wait until the program has been injected and run (proof the injection,
    // block writes included, has completed).
    await runUntil(machine, () => screenText(machine).includes('HI'));
    const cpu = machine.processor;
    for (let i = 0; i < block.bytes.length; i++) {
      expect(cpu.readmem(block.address + i)).toBe(block.bytes[i]);
    }
    machine.dispose();
  }, 60000);

  it('starts an entry-carrying block with LINK when there is no BASIC program', async () => {
    const machine = new AtomMachine();
    // 6502 at #5000: write VDG codes for "OK" into screen RAM, then RTS back
    // to BASIC. 'O' = 0x0F, 'K' = 0x0B (ASCII minus 0x40 in the low range).
    const block: MemoryBlock = {
      id: 'b1',
      name: 'boot',
      address: 0x5000,
      bytes: new Uint8Array([
        0xa9, 0x0f, 0x8d, 0x00, 0x81, 0xa9, 0x0b, 0x8d, 0x01, 0x81, 0x60,
      ]),
      kind: 'code',
      entry: 0x5000,
    };
    // An empty source tokenizes to just the 0D FF end marker - the
    // machine-code-.atm import shape (empty source + one entry block).
    const { bytes } = tokenizeProgram('');
    machine.loadProgram(bytes, { blocks: [block] });
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('OK'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('loads a plain program unchanged when no blocks are supplied', async () => {
    const machine = new AtomMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO ATOM"\n20 END\n');
    machine.loadProgram(bytes, {});
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO ATOM'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('feeds virtual-keyboard tokens into the PPIA key matrix', async () => {
    const machine = new AtomMachine();
    await machine.whenReady();
    await runUntil(machine, () => screenText(machine).includes('ACORN ATOM'));
    machine.setKey('KeyA', true);
    for (let i = 0; i < 6; i++) machine.runFrame();
    machine.setKey('KeyA', false);
    for (let i = 0; i < 6; i++) machine.runFrame();
    // The prompt line now echoes the typed character.
    expect(screenText(machine)).toContain('>A');
    machine.dispose();
  }, 30000);

  it('reports 256×192 as its native display size', () => {
    const machine = new AtomMachine();
    expect(machine.displayWidth).toBe(256);
    expect(machine.displayHeight).toBe(192);
    machine.dispose();
  });

  it('round-trips a data file through the VFS (FOUT/BPUT then FIN/BGET)', async () => {
    const s = fakeStore();
    const machine = new AtomMachine({ files: s.store });
    // Write two bytes to "DAT", then open it for input and print them back.
    const { bytes } = tokenizeProgram(
      '10 F=FOUT"DAT"\n' +
        '20 BPUT F,49\n' +
        '30 BPUT F,50\n' +
        '40 G=FIN"DAT"\n' +
        '50 P.BGET G\n' +
        '60 P.BGET G\n' +
        '70 END\n',
    );
    machine.loadProgram(bytes);
    // The read-back path (FIN a file the program itself wrote, then BGET the
    // bytes) only prints "4950" if BASIC's FOUT/BPUT/FIN/BGET were all served
    // from the VFS and the forged returns round-tripped the handle in A.
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('49'),
    );
    expect(ran).toBe(true);
    expect(screenText(machine)).toContain('50');
    // The write path is visible in the store immediately (write-through: there
    // is no SHUT on the tape ROM), tagged as data.
    expect([...(s.files.get('DAT')?.data ?? [])]).toEqual([49, 50]);
    expect(s.files.get('DAT')!.kind).toBe('data');
    machine.dispose();
  }, 60000);

  it('serves FIN of a missing file as absent (handle 0) rather than hanging', async () => {
    const s = fakeStore();
    const machine = new AtomMachine({ files: s.store });
    // FIN returns 0 for a file that does not exist; the program prints a marker.
    const { bytes } = tokenizeProgram('10 G=FIN"NOPE"\n20 P."H="G\n30 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('H='),
    ); // prints the handle
    expect(ran).toBe(true);
    expect(screenText(machine)).toContain('H=       0');
    machine.dispose();
  }, 60000);
});
