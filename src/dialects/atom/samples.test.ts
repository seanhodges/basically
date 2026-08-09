import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { atomSamples } from './samples';
import { atom } from './index';
import { tokenizeProgram } from './tokenizer';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import {
  AtomMachine,
  configureNodeRomPath,
} from '../../emulator/atom/atomMachine';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/** The Atom's MC6847 screen RAM (0x8000–0x83FF) as printable text. */
function screenText(machine: AtomMachine): string {
  return machine.readScreenText()?.lines.join('\n') ?? '';
}

async function runFrames(machine: AtomMachine, frames: number): Promise<void> {
  for (let i = 0; i < frames; i++) {
    machine.runFrame();
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

async function runUntil(
  machine: AtomMachine,
  predicate: () => boolean,
  maxFrames = 600,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

/** Tap a virtual key (press, hold a few frames, release). */
async function tap(machine: AtomMachine, token: string): Promise<void> {
  machine.setKey(token, true);
  await runFrames(machine, 8);
  machine.setKey(token, false);
  await runFrames(machine, 10);
}

describe('atom sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of atomSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('ships circles, maze, files and Kaleidoscope with hello first (no breakout, like the ZX80)', () => {
    expect(atomSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'maze.bas',
      'files.bas',
      'kaleido.bas',
    ]);
  });

  it('runs the Kaleidoscope machine code and mirrors the screen four ways', async () => {
    const kaleido = atomSamples.find((s) => s.name === 'kaleido.bas')!;
    const blocks = materializeSampleBlocks(atom, kaleido);
    expect(blocks[0]!.address).toBe(0x3800);
    expect(blocks[0]!.entry).toBe(0x3803);
    // Drive the routine directly (poke params + LINK) so the test needs no
    // keyboard scripting for the sample's own INPUT prompts. The GOTO self-loop
    // keeps BASIC busy so the prompt never scrolls over the drawn screen.
    const { bytes } = tokenizeProgram(
      '10 ?#3800=3\n20 ?#3801=5\n30 ?#3802=2\n40 LINK #3803\n50 GOTO 50\n',
    );
    const machine = new AtomMachine();
    machine.loadProgram(bytes, { blocks });
    await runFrames(machine, 400);

    const cell = (a: number) => machine.processor.readmem(0x8000 + a) & 0xff;
    const distinct = new Set(Array.from({ length: 32 * 16 }, (_, a) => cell(a)))
      .size;
    expect(distinct).toBeGreaterThan(4);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        const v = cell(y * 32 + x);
        expect(cell(y * 32 + (31 - x))).toBe(v);
        expect(cell((15 - y) * 32 + x)).toBe(v);
        expect(cell((15 - y) * 32 + (31 - x))).toBe(v);
      }
    }
    machine.dispose();
  }, 60000);

  it('hello is the starter offered for a fresh document', () => {
    expect(atom.samples[0]!.name).toBe('hello.bas');
  });

  it('hello runs on the real Atom and prints its banner', async () => {
    const hello = atomSamples.find((s) => s.name === 'hello.bas')!;
    const { bytes } = tokenizeProgram(hello.text);
    const machine = new AtomMachine();
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO FROM THE ATOM'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  // The Atom's MOVE/DRAW reject compound coordinate expressions (e.g.
  // `MOVE 128+P,96+Q` raises ERROR 94), so circles.bas precomputes each point
  // into a plain variable. Running it on the real ROM and asserting the screen
  // never drops to a BASIC error guards that the graphics statements all parse.
  it('circles draws on the real Atom without a BASIC error', async () => {
    const circles = atomSamples.find((s) => s.name === 'circles.bas')!;
    const { bytes } = tokenizeProgram(circles.text);
    const machine = new AtomMachine();
    machine.loadProgram(bytes);
    await runFrames(machine, 2500);
    expect(screenText(machine)).not.toContain('ERROR');
    machine.dispose();
  }, 60000);

  // files.bas writes five squares to a VFS file with FOUT/BPUT and reads them
  // back with FIN/BGET. Running it on the real ROM (with a store wired) proves
  // the whole file path parses and round-trips: the last square (25) only
  // appears if the read-back reached the fifth byte.
  it('runs files.bas and reads its data back through the VFS', async () => {
    const files = atomSamples.find((s) => s.name === 'files.bas')!;
    const { bytes } = tokenizeProgram(files.text);
    const store = new Map<string, Uint8Array>();
    const machine = new AtomMachine({
      files: {
        save: (name, data) => void store.set(name, data.slice()),
        load: (name) => store.get(name)?.slice() ?? null,
        list: () => [],
        delete: (name) => store.delete(name),
      },
    });
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('DONE'),
    );
    expect(ran).toBe(true);
    expect(screenText(machine)).toContain('25');
    expect([...(store.get('SQUARES') ?? [])]).toEqual([1, 4, 9, 16, 25]);
    machine.dispose();
  }, 60000);
});

// The Atom has no INKEY, so the maze is turn-based: it draws once into the
// fixed #8000 screen RAM (forcing the OS cursor #DE/#DF to home so PRINT lands
// at row 0), reads walls back from the screen for collision, and moves the
// player by POKEing the two changed cells. Moves arrive as a Z/X/K/M direction
// key (read into a buffer via INPUT). This drives the real ROM to prove the
// draw + read-back + POKE-move path works.
describe('atom maze in the emulator', () => {
  /** Count '#' wall cells on the screen, as the machine reads it back. */
  function countWalls(machine: AtomMachine): number {
    const lines = machine.readScreenText()?.lines ?? [];
    return lines
      .slice(0, 13)
      .reduce((n, line) => n + [...line].filter((c) => c === '#').length, 0);
  }

  /** Find the player marker 'O' (code 0x0f) in the maze rows. */
  function findPlayer(
    machine: AtomMachine,
  ): { row: number; col: number } | null {
    const lines = machine.readScreenText()?.lines ?? [];
    for (let row = 0; row < lines.length; row++) {
      const col = [...lines[row]!].indexOf('O');
      if (col !== -1) return { row, col };
    }
    return null;
  }

  it('draws its walls, then moves the player by POKE', async () => {
    const maze = atomSamples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new AtomMachine();
    machine.loadProgram(bytes);

    // The maze now opens on a welcome screen (PRINT title, then INPUT to start).
    // Reach that prompt, press RETURN to begin, then let the maze draw.
    await runFrames(machine, 200);
    await tap(machine, 'Enter');
    // Run long enough for the one-time draw to reach the move INPUT prompt.
    await runFrames(machine, 500);

    const wallsBefore = countWalls(machine);
    expect(wallsBefore).toBeGreaterThan(40);
    const before = findPlayer(machine);
    expect(before).toEqual({ row: 1, col: 1 });

    // Pressing X (right) + RETURN walks the player into the open cell to its
    // right; the move is a two-cell POKE, so the wall count is unchanged.
    await tap(machine, 'KeyX');
    await tap(machine, 'Enter');
    await runFrames(machine, 60);

    const after = findPlayer(machine);
    expect(after).toEqual({ row: 1, col: 2 });
    expect(countWalls(machine)).toBe(wallsBefore);

    machine.dispose();
  }, 60000);
});
