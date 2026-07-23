import { describe, expect, it } from 'vitest';
import { cpc464Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { cpc464Keywords } from './keywords';

describe('cpc464 samples', () => {
  it('ships the canonical five with hello first', () => {
    expect(cpc464Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  for (const sample of cpc464Samples) {
    it(`${sample.name} tokenizes without fatal errors`, () => {
      const { bytes, errors } = tokenizeProgram(sample.text, 'basic10');
      // Only statement-shape lint may be non-fatal; nothing here should trip it.
      expect(errors, sample.name).toEqual([]);
      // A real image: program body plus its zero end-marker word.
      expect(bytes.length, sample.name).toBeGreaterThan(2);
    });
  }

  it('the game samples read the cursor keys via INKEY so the pad drives them', () => {
    for (const name of ['breakout.bas', 'maze.bas']) {
      const text = cpc464Samples.find((s) => s.name === name)!.text;
      expect(text, name).toMatch(/INKEY\(/);
    }
  });

  it('the maze sample DATA is a solvable maze from start to the exit', () => {
    const text = cpc464Samples.find((s) => s.name === 'maze.bas')!.text;
    // Pull the DATA rows in order; each is a quoted 14-char field.
    const rows = [...text.matchAll(/^\d+\s+DATA\s+"([^"]*)"/gm)].map(
      (m) => m[1]!,
    );
    expect(rows).toHaveLength(21);
    for (const row of rows) expect(row).toHaveLength(39);

    // The program walks a 1-based grid: start (col2,row2), walls '#', exit 'E'.
    const at = (c: number, r: number) => rows[r - 1]![c - 1]!;
    expect(at(2, 2)).toBe(' '); // the '@' start cell must be walkable

    // BFS over walkable cells (spaces/'E'); the exit must be reachable.
    const seen = new Set<string>(['2,2']);
    const queue: [number, number][] = [[2, 2]];
    let reachedExit = false;
    while (queue.length) {
      const [c, r] = queue.shift()!;
      if (at(c, r) === 'E') reachedExit = true;
      for (const [dc, dr] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 1 || nc > 39 || nr < 1 || nr > 21) continue;
        if (at(nc, nr) === '#') continue;
        const key = `${nc},${nr}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([nc, nr]);
      }
    }
    expect(rows.join('\n')).toContain('E'); // there is an exit
    expect(reachedExit, 'exit reachable from the start cell').toBe(true);
  });

  it('no sample uses a reserved BASIC keyword as a variable name', () => {
    // A variable name colliding with a keyword (e.g. RAD/DEG) tokenizes to the
    // keyword byte and the ROM mis-runs the line - the circles hang was `RAD=`.
    const keywords = new Set(
      cpc464Keywords
        .map((k) => k.word.toUpperCase())
        .filter((n) => /^[A-Z][A-Z0-9]*$/.test(n)),
    );
    for (const sample of cpc464Samples) {
      // Any NAME immediately followed by a lone '=' is a variable target (a
      // keyword would never sit before '='); '<='/'>=' don't match (the char
      // before '=' isn't a letter). Strip strings so text like "A=B" is ignored.
      const noStrings = sample.text.replace(/"[^"]*"/g, '""');
      for (const m of noStrings.matchAll(
        /([A-Za-z][A-Za-z0-9]*)[$%]?\s*=(?!=)/g,
      )) {
        const name = m[1]!.toUpperCase();
        expect(
          keywords.has(name),
          `${sample.name}: variable "${name}" collides with a keyword`,
        ).toBe(false);
      }
    }
  });
});
