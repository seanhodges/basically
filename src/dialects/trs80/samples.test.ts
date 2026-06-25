import { describe, expect, it } from 'vitest';
import { trs80Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { Interpreter } from './interpreter/interpreter';

describe('trs80 samples', () => {
  it('ships the canonical four with hello first', () => {
    expect(trs80Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
    ]);
  });

  for (const sample of trs80Samples) {
    it(`${sample.name} tokenizes and runs without error`, () => {
      const { program, errors } = tokenizeProgram(sample.text);
      expect(errors, sample.name).toEqual([]);

      const interp = new Interpreter();
      interp.load(program);
      // Run a bounded number of frames: programs that END settle; the
      // interactive ones (breakout) loop forever but must never error.
      for (let i = 0; i < 80 && interp.state === 'running'; i++) {
        interp.runBudget(5000);
      }
      expect(interp.state, sample.name).not.toBe('error');
    });
  }

  it('hello prints its banner to the screen', () => {
    const { program } = tokenizeProgram(trs80Samples[0]!.text);
    const interp = new Interpreter();
    interp.load(program);
    for (let i = 0; i < 50 && interp.state === 'running'; i++) {
      interp.runBudget(5000);
    }
    const text = Array.from(interp.screen.video)
      .map((c) => (c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : ' '))
      .join('');
    expect(text).toContain('BASICALLY');
  });

  function load(name: string): Interpreter {
    const { program, errors } = tokenizeProgram(
      trs80Samples.find((s) => s.name === name)!.text,
    );
    expect(errors, name).toEqual([]);
    const interp = new Interpreter();
    interp.load(program);
    return interp;
  }
  const settle = (interp: Interpreter, slices: number) => {
    for (let i = 0; i < slices && interp.state === 'running'; i++) {
      interp.runBudget(2000);
    }
  };

  // The maze rows come from `DATA "…"` lines; the player is POKEd into video RAM
  // by column, so the maze must render flush to column 0 (this also guards the
  // DATA leading-space fix). Then a breadth-first solver replays a real path of
  // W/A/S/D moves and the game must reach its YOU ESCAPED end state.
  it('maze renders flush-left and is solvable to the exit', () => {
    const rows = trs80Samples
      .find((s) => s.name === 'maze.bas')!
      .text.split('\n')
      .filter((l) => /DATA "/.test(l))
      .map((l) => l.replace(/.*DATA "/, '').replace(/".*/, ''));
    const H = rows.length;
    const W = rows[0]!.length;

    const interp = load('maze.bas');
    settle(interp, 60);
    // Top border drawn at column 0 of row 0 ('#' === 0x23): no print offset.
    expect(interp.screen.video[0]).toBe(0x23);

    // BFS for a path from (1,1) to the 'E' cell.
    const dirs: [number, number, string][] = [
      [0, -1, 'W'],
      [0, 1, 'S'],
      [-1, 0, 'A'],
      [1, 0, 'D'],
    ];
    const seen = new Set([1 * 100 + 1]);
    const queue: [number, number, string][] = [[1, 1, '']];
    let moves = '';
    while (queue.length) {
      const [x, y, path] = queue.shift()!;
      if (rows[y]![x] === 'E') {
        moves = path;
        break;
      }
      for (const [dx, dy, key] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (rows[ny]![nx] === '#' || seen.has(ny * 100 + nx)) continue;
        seen.add(ny * 100 + nx);
        queue.push([nx, ny, path + key]);
      }
    }
    expect(moves.length).toBeGreaterThan(0);

    for (const key of moves) {
      interp.input.setToken(`Key${key}`, true);
      interp.runBudget(3000);
      interp.runBudget(3000);
    }
    settle(interp, 20);
    expect(interp.state).toBe('ended');
    const text = Array.from(interp.screen.video)
      .map((c) => (c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : ' '))
      .join('');
    expect(text).toContain('YOU ESCAPED');
  });

  // Breakout must lay out its bricks, and the ball must knock them out and score
  // when it reaches them. A simple tracking paddle keeps the ball in play long
  // enough to clear several bricks.
  it('breakout breaks bricks and scores as the ball returns', () => {
    const interp = load('breakout.bas');
    for (let i = 0; i < 6; i++) interp.runBudget(300);
    expect(Number(interp.getVar('NB'))).toBe(32);
    expect(interp.screen.video.some((c) => c >= 0x80)).toBe(true);

    let bricksGone = 0;
    for (let i = 0; i < 6000 && interp.state === 'running'; i++) {
      const bx = Number(interp.getVar('BX'));
      const px = Number(interp.getVar('PX'));
      if (px < bx - 5) interp.input.setToken('KeyD', true);
      else if (px > bx - 5) interp.input.setToken('KeyA', true);
      interp.runBudget(50);
      bricksGone = Math.max(bricksGone, 32 - Number(interp.getVar('NB')));
    }
    expect(bricksGone).toBeGreaterThan(0);
    expect(Number(interp.getVar('S'))).toBe(bricksGone);
  });
});
