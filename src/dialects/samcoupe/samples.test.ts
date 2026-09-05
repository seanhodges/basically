import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { samcoupeSamples, SAMCOUPE_KALEIDO_BLOCK } from './samples';
import { samcoupe } from './index';
import { samcoupeKeywords } from './keywords';
import { samcoupeMemoryBlocks } from './memoryBlocks';
import { samcoupeKeyboardLayout } from './keyboardLayout';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { tokenizeProgram } from './tokenizer';
import { buildSamFile } from './samfile';
import { SamMachine } from './emulator/samMachine';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './emulator/display';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/samcoupe/samcoupe.rom')),
);

const sample = (name: string) => samcoupeSamples.find((s) => s.name === name)!;

/**
 * Frames each sample is given, and why that many.
 *
 * Every figure is what the machine was measured needing when the sample was
 * written, rounded up: the picture the assertion below it reads has to be on
 * the screen by then, and nothing here waits longer than that.
 */
/** hello's cascade fills the screen and prints the banner in about six seconds. */
const HELLO_FRAMES = 400;
/** circles integrates three rings in about ten and a half. */
const CIRCLES_FRAMES = 700;
/** breakout draws its menu in about two seconds, then its brick wall. */
const MENU_FRAMES = 150;
const WALL_FRAMES = 400;
/** maze reads its DATA and paints twenty-one rows in about three. */
const MAZE_FRAMES = 220;
/** kaleido's routine fills 24K in one frame; the INPUTs are what take time. */
const KALEIDO_FRAMES = 90;
/** Frames a key is held, and the frames after it a program gets to act. */
const HOLD_FRAMES = 3;
const REACT_FRAMES = 2;

/** Boot the machine on a sample, with whatever blocks it bundles. */
function run(name: string, frames: number): SamMachine {
  const s = sample(name);
  const { bytes, errors } = tokenizeProgram(s.text);
  expect(errors, `${name}: ${JSON.stringify(errors)}`).toEqual([]);
  const machine = new SamMachine({ rom });
  machine.loadProgram(buildSamFile(bytes, name.replace('.bas', '')), {
    blocks: materializeSampleBlocks(samcoupe, s),
  });
  for (let i = 0; i < frames; i++) machine.runFrame();
  return machine;
}

const screen = (m: SamMachine): string[] =>
  (m.readScreenText()?.lines ?? []).map((l) => l.trimEnd());

function tap(m: SamMachine, token: string): void {
  m.setKey(token, true);
  for (let i = 0; i < HOLD_FRAMES; i++) m.runFrame();
  m.setKey(token, false);
  for (let i = 0; i < REACT_FRAMES; i++) m.runFrame();
}

/** The raster as one number per pixel, for the drawn samples. */
function pixels(m: SamMachine): Uint32Array {
  const fb = (m as unknown as { frameBuffer: Uint8Array }).frameBuffer;
  const out = new Uint32Array(DISPLAY_WIDTH * DISPLAY_HEIGHT);
  for (let i = 0; i < out.length; i++)
    out[i] = (fb[i * 4]! << 16) | (fb[i * 4 + 1]! << 8) | fb[i * 4 + 2]!;
  return out;
}

/** The map the maze's DATA lines carry. */
const mazeRows: string[] = [
  ...sample('maze.bas').text.matchAll(/^\d+ DATA "(.*)"$/gm),
].map((m) => m[1]!);

/** The maze's start cell, as the program sets it. */
const MAZE_START: [number, number] = [2, 2];

/** Direction keys, in the order `controller.bindings` names them. */
const MOVE_KEYS: Record<string, string> = {
  left: '6',
  right: '7',
  down: '8',
  up: '9',
};

/**
 * Breadth-first path from the start cell to the exit, as the keys that walk it.
 * Returns null when there is no path, which is the failure the maze must never
 * have.
 */
function solveMaze(): string[] | null {
  const height = mazeRows.length;
  const width = mazeRows[0]!.length;
  const at = (x: number, y: number) => mazeRows[y - 1]![x - 1]!;
  const steps: [number, number, string][] = [
    [-1, 0, MOVE_KEYS.left!],
    [1, 0, MOVE_KEYS.right!],
    [0, 1, MOVE_KEYS.down!],
    [0, -1, MOVE_KEYS.up!],
  ];
  const from = new Map<string, [number, number, string]>();
  const seen = new Set([MAZE_START.join(',')]);
  const queue: [number, number][] = [MAZE_START];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy, key] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 1 || nx > width || ny < 1 || ny > height) continue;
      const cell = at(nx, ny);
      if (cell === '#' || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      from.set(`${nx},${ny}`, [x, y, key]);
      if (cell === 'E') {
        const path: string[] = [];
        for (
          let c: [number, number] = [nx, ny];
          c[0] !== MAZE_START[0] || c[1] !== MAZE_START[1];
        ) {
          const [px, py, k] = from.get(`${c[0]},${c[1]}`)!;
          path.unshift(k);
          c = [px, py];
        }
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

describe('samcoupe sample programs', () => {
  it('ships the canonical sample set in the canonical order', () => {
    expect(samcoupeSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
    // hello is the starter a fresh document opens on.
    expect(samcoupe.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of samcoupeSamples) {
      const { errors, image } = samcoupe.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(image.length, s.name).toBeGreaterThan(80);
      expect(samcoupe.lint(s.text), s.name).toEqual([]);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // A name that tokenizes to a keyword byte does not error - the ROM runs the
    // line and means something else by it, which is the worst kind of bug to
    // ship in a sample.
    const words = new Set(samcoupeKeywords.map((k) => k.word));
    for (const s of samcoupeSamples) {
      const noStrings = s.text.replace(/"[^"\n]*"/g, '""');
      for (const m of noStrings.matchAll(
        /(?:LET |FOR )([A-Za-z][A-Za-z0-9_]*)\$?\s*=/g,
      )) {
        expect(
          words.has(m[1]!.toUpperCase()),
          `${s.name}: variable "${m[1]}" collides with a keyword`,
        ).toBe(false);
      }
    }
  });

  it('reads the keys the on-screen controller presses, in both games', () => {
    // The pad sends the joystick's own matrix keys, so a game reading anything
    // else answers its arrows with the wrong move.
    const bindings = samcoupeKeyboardLayout.controller!.bindings;
    for (const name of ['breakout.bas', 'maze.bas']) {
      const text = sample(name).text;
      expect(text, name).toContain('INKEY$');
      for (const role of ['left', 'right'] as const) {
        const digit = bindings[role]!.replace('Digit', '');
        expect(text, `${name} ${role}`).toContain(`="${digit}"`);
      }
    }
  });

  it('lays the maze out as a solvable grid', () => {
    expect(mazeRows).toHaveLength(21);
    expect(new Set(mazeRows.map((r) => r.length))).toEqual(new Set([39]));
    const [sx, sy] = MAZE_START;
    expect(mazeRows[sy - 1]![sx - 1]).toBe(' ');
    expect(mazeRows.join('')).toContain('E');
    expect(
      solveMaze(),
      'the maze must be walkable start to exit',
    ).not.toBeNull();
  });

  it('assembles the kaleidoscope block into the window it declares', () => {
    const blocks = materializeSampleBlocks(samcoupe, sample('kaleido.bas'));
    expect(blocks).toHaveLength(1);
    const block = blocks[0]!;
    expect(block.address).toBe(SAMCOUPE_KALEIDO_BLOCK.address);
    // The three parameter bytes sit at the block's base, so the entry is three
    // bytes in and the BASIC POKEs address them directly.
    expect(SAMCOUPE_KALEIDO_BLOCK.entry).toBe(block.address + 3);
    expect(block.bytes.length).toBeGreaterThan(3);
    const last = block.address + block.bytes.length - 1;
    expect(
      samcoupeMemoryBlocks.validRanges.some(
        (r) => block.address >= r.start && last <= r.end,
      ),
    ).toBe(true);
  });

  it('greets and signs off on the machine', () => {
    const m = run('hello.bas', HELLO_FRAMES);
    const lines = screen(m);
    expect(
      lines.filter((l) => l.includes('HELLO FROM THE SAM COUPE')).length,
    ).toBeGreaterThan(10);
    expect(lines.some((l) => l.includes('* BASICALLY *'))).toBe(true);
    m.dispose();
  });

  it('draws three closed, round rings', () => {
    const m = run('circles.bas', CIRCLES_FRAMES);
    expect(screen(m).some((l) => l.includes('CONCENTRIC CIRCLES'))).toBe(true);
    // The rings only, above the caption row: the ink box of a closed circle is
    // as wide as it is tall, and a recurrence run with the full E rather than
    // E/2 integrates an ellipse that fails here.
    const px = pixels(m);
    let x0 = DISPLAY_WIDTH;
    let x1 = -1;
    let y0 = DISPLAY_HEIGHT;
    let y1 = -1;
    for (let y = 8; y < 162; y++) {
      for (let x = 0; x < DISPLAY_WIDTH; x++) {
        if (px[y * DISPLAY_WIDTH + x] === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const aspect = (x1 - x0 + 1) / (y1 - y0 + 1);
    expect(aspect).toBeGreaterThan(0.95);
    expect(aspect).toBeLessThan(1.05);
    // Three rings, counted where a horizontal cut through the centre crosses
    // them: six edges on the left half.
    const midY = Math.round((y0 + y1) / 2);
    let crossings = 0;
    for (let x = x0; x <= Math.round((x0 + x1) / 2); x++) {
      const here = px[midY * DISPLAY_WIDTH + x] !== 0;
      const before = px[midY * DISPLAY_WIDTH + x - 1] !== 0;
      if (here && !before) crossings++;
    }
    expect(crossings).toBe(3);
    m.dispose();
  });

  it('scores, bounces and ends breakout', () => {
    const m = run('breakout.bas', MENU_FRAMES);
    expect(screen(m).some((l) => l.includes('KEYS 6 AND 7 MOVE'))).toBe(true);
    tap(m, 'Digit0');

    // The paddle follows the pad's own left/right keys, and only those.
    const paddleLeft = (): number => {
      const px = pixels(m);
      const y = 18 * 9 + 4;
      let best = -1;
      let bestRun = 0;
      let run = 0;
      for (let x = 0; x <= DISPLAY_WIDTH; x++) {
        const lit = x < DISPLAY_WIDTH && px[y * DISPLAY_WIDTH + x] !== 0;
        if (lit) run++;
        else {
          if (run > bestRun) {
            bestRun = run;
            best = x - run;
          }
          run = 0;
        }
      }
      return best;
    };
    // Wait for the wall and the bat rather than a fixed count: the press has to
    // land while the ball is still in play, and drawing 112 bricks is what
    // decides when that is.
    let drawn = 0;
    while (drawn < WALL_FRAMES && paddleLeft() < 0) {
      m.runFrame();
      drawn++;
    }
    expect(screen(m)[0]).toMatch(/^SCORE /);
    const start = paddleLeft();
    expect(start).toBeGreaterThan(0);
    m.setKey('Digit6', true);
    for (let i = 0; i < 20; i++) m.runFrame();
    m.setKey('Digit6', false);
    expect(paddleLeft()).toBeLessThan(start);

    // Left alone, the ball is lost and the game says so - and it says so after
    // clearing bricks, which is what the rising score records.
    for (let i = 0; i < 900 && !screen(m).join('').includes('GAME OVER'); i++)
      m.runFrame();
    const lines = screen(m);
    expect(lines.join('\n')).toContain('GAME OVER');
    expect(Number(/^SCORE (\d+)/.exec(lines[0] ?? '')?.[1])).toBeGreaterThan(0);
    m.dispose();
  });

  it('walks the maze one cell a press, and out of it', () => {
    const m = run('maze.bas', MAZE_FRAMES);
    const lines = screen(m);
    expect(lines[0]).toContain('REACH E - KEYS 6 7 8 9');
    expect(lines[1]).toContain('#######');
    const markerRow = 2;
    const markerCol = 12 + MAZE_START[0] - 1;
    expect(lines[markerRow]![markerCol]).toBe('O');

    // One press moves one cell and repaints only the two cells involved.
    const before = pixels(m);
    tap(m, 'Digit7');
    const after = pixels(m);
    let changedRows = 0;
    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
      for (let x = 0; x < DISPLAY_WIDTH; x++) {
        if (before[y * DISPLAY_WIDTH + x] !== after[y * DISPLAY_WIDTH + x]) {
          changedRows++;
          break;
        }
      }
    }
    expect(changedRows).toBeLessThanOrEqual(8);
    expect(screen(m)[markerRow]![markerCol + 1]).toBe('O');

    // And the whole way out, along the path the map itself admits.
    const path = solveMaze()!;
    for (const key of path.slice(1)) tap(m, `Digit${key}`);
    for (let i = 0; i < 40; i++) m.runFrame();
    expect(screen(m)[0]).toContain('YOU ESCAPED!');
    m.dispose();
  });

  it('asks for the three parameters and mirrors what it draws', () => {
    const m = run('kaleido.bas', KALEIDO_FRAMES);
    expect(screen(m).join('\n')).toContain('SEED (0-255)?');
    for (const [answer, prompt] of [
      ['7', 'TWIST (0-255)?'],
      ['3', 'PASSES (1-9)?'],
      ['2', null],
    ] as const) {
      tap(m, `Digit${answer}`);
      tap(m, 'Enter');
      for (let i = 0; i < 20; i++) m.runFrame();
      if (prompt) expect(screen(m).join('\n')).toContain(prompt);
    }
    for (let i = 0; i < 60; i++) m.runFrame();

    // The routine paged the screen in, drew, and put BASIC's pages back: the
    // picture is symmetric about both axes and is not blank.
    const px = pixels(m);
    let lit = 0;
    for (let y = 0; y < DISPLAY_HEIGHT / 2; y += 3) {
      for (let x = 0; x < DISPLAY_WIDTH / 2; x += 5) {
        const here = px[y * DISPLAY_WIDTH + x]!;
        if (here !== 0) lit++;
        const flipX = px[y * DISPLAY_WIDTH + (DISPLAY_WIDTH - 1 - x)];
        const flipY = px[(DISPLAY_HEIGHT - 1 - y) * DISPLAY_WIDTH + x];
        expect(flipX, `mirror at ${x},${y}`).toBe(here);
        expect(flipY, `mirror at ${x},${y}`).toBe(here);
      }
    }
    expect(lit).toBeGreaterThan(100);
    m.dispose();
  });
});
