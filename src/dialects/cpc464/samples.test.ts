import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CPC464_KALEIDO_BLOCK, cpc464Samples } from './samples';
import { cpc464MemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import { cpc464Keywords } from './keywords';
import { asmEngineFor } from '../../asm/registry';
import { CpcMachine } from '../../emulator/cpc/cpcMachine';

const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

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

  it('the kaleidoscope block assembles clean inside its valid range', () => {
    const engine = asmEngineFor(cpc464MemoryBlocks.cpu)!;
    const result = engine.assemble(
      CPC464_KALEIDO_BLOCK.asmSource,
      CPC464_KALEIDO_BLOCK.address,
    );
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors)).toBe(
      true,
    );
    if (!result.ok) return;
    expect(result.bytes.length).toBeGreaterThan(0);
    const end = CPC464_KALEIDO_BLOCK.address + result.bytes.length - 1;
    const inRange = cpc464MemoryBlocks.validRanges.some(
      (r) => CPC464_KALEIDO_BLOCK.address >= r.start && end <= r.end,
    );
    expect(inRange).toBe(true);
    // The BASIC program POKEs &8000-&8002 and calls &8003: pin the entry so an
    // asm edit that moves it breaks loudly here, not silently at run.
    expect(CPC464_KALEIDO_BLOCK.entry).toBe(CPC464_KALEIDO_BLOCK.address + 3);
  });

  // The render check drives the genuine firmware, so it skips without the ROM.
  (hasRom ? it : it.skip)(
    'the kaleidoscope routine fills the Mode 0 screen with a 4-way mirror',
    () => {
      // The sample's own BASIC INPUTs the parameters; drive the same routine
      // with POKEd values instead so the test needs no keyboard scripting.
      // Line 40 loops forever so the run stays alive and the "Ready" prompt
      // doesn't scroll the screen and disturb the drawn cells.
      const driver = [
        '10 POKE &8000,3:POKE &8001,5:POKE &8002,2',
        '20 MODE 0',
        '30 CALL &8003',
        '40 GOTO 40',
      ].join('\n');
      const { bytes, errors } = tokenizeProgram(driver, 'basic10');
      expect(errors).toEqual([]);
      const engine = asmEngineFor(cpc464MemoryBlocks.cpu)!;
      const assembled = engine.assemble(
        CPC464_KALEIDO_BLOCK.asmSource,
        CPC464_KALEIDO_BLOCK.address,
      );
      expect(assembled.ok).toBe(true);
      if (!assembled.ok) return;

      const machine = new CpcMachine({ rom });
      machine.loadProgram(bytes, {
        blocks: [
          {
            id: 'sample-kaleido',
            name: CPC464_KALEIDO_BLOCK.name,
            address: CPC464_KALEIDO_BLOCK.address,
            bytes: assembled.bytes,
            kind: 'code',
          },
        ],
      });
      for (let i = 0; i < 120; i++) machine.runFrame();

      // The block's bytes landed at its address...
      expect(machine.mem.readScreen(0x8003)).toBe(assembled.bytes[3]);

      // Read the top-left byte of every Mode 0 cell (20 cols x 25 rows). A cell
      // (cx, cy) starts at &C000 + cy*80 + cx*4 (scanline 0 of the cell).
      const cellByte = (cx: number, cy: number) =>
        machine.mem.readScreen(0xc000 + cy * 80 + cx * 4);

      // ...the screen holds a drawn pattern, not a plain MODE 0 clear.
      const distinct = new Set<number>();
      for (let cy = 0; cy < 25; cy++) {
        for (let cx = 0; cx < 20; cx++) distinct.add(cellByte(cx, cy));
      }
      expect(distinct.size).toBeGreaterThan(4);

      // ...and every cell holds the routine's 4-way mirror symmetry.
      for (let cy = 0; cy < 13; cy++) {
        for (let cx = 0; cx < 10; cx++) {
          const v = cellByte(cx, cy);
          expect(cellByte(19 - cx, cy)).toBe(v);
          expect(cellByte(cx, 24 - cy)).toBe(v);
          expect(cellByte(19 - cx, 24 - cy)).toBe(v);
        }
      }
    },
  );

  it('the maze sample DATA is a solvable maze from start to the exit', () => {
    const text = cpc464Samples.find((s) => s.name === 'maze.bas')!.text;
    // Pull the DATA rows in order; each is a quoted 14-char field.
    const rows = [...text.matchAll(/^\d+\s+DATA\s+"([^"]*)"/gm)].map(
      (m) => m[1]!,
    );
    expect(rows).toHaveLength(11);
    for (const row of rows) expect(row).toHaveLength(14);

    // The program walks a 1-based grid: start (col2,row2), walls '#', exit 'E'.
    const at = (c: number, r: number) => rows[r - 1]![c - 1]!;
    expect(at(2, 2)).toBe('.'); // the '@' start cell must be walkable

    // BFS over walkable cells ('.'/'E'); the exit must be reachable.
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
        if (nc < 1 || nc > 14 || nr < 1 || nr > 11) continue;
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
