import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { atomSamples } from './samples';
import { atom } from './index';
import { tokenizeProgram } from './tokenizer';
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
  let text = '';
  for (let addr = 0x8000; addr < 0x8400; addr++) {
    const code = machine.processor.readmem(addr) & 0x7f;
    const ascii = code < 0x20 ? code | 0x40 : code;
    text += ascii >= 0x20 && ascii < 0x7f ? String.fromCharCode(ascii) : ' ';
  }
  return text;
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

  it('ships circles and maze with hello first (no breakout, like the ZX80)', () => {
    expect(atomSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'maze.bas',
    ]);
  });

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
});

// The Atom has no INKEY, so the maze is turn-based: it draws once into the
// fixed #8000 screen RAM (forcing the OS cursor #DE/#DF to home so PRINT lands
// at row 0), reads walls back from the screen for collision, and moves the
// player by POKEing the two changed cells. Moves arrive as a Z/X/K/M direction
// key (read into a buffer via INPUT). This drives the real ROM to prove the
// draw + read-back + POKE-move path works.
describe('atom maze in the emulator', () => {
  /** Count '#' wall cells (code 0x23) in the 13 maze rows. */
  function countWalls(machine: AtomMachine): number {
    let walls = 0;
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 29; c++) {
        if ((machine.processor.readmem(0x8000 + r * 32 + c) & 0x7f) === 0x23)
          walls++;
      }
    }
    return walls;
  }

  /** Find the player marker 'O' (code 0x0f) in the maze rows. */
  function findPlayer(
    machine: AtomMachine,
  ): { row: number; col: number } | null {
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 29; c++) {
        if ((machine.processor.readmem(0x8000 + r * 32 + c) & 0x7f) === 0x0f)
          return { row: r, col: c };
      }
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
