import { describe, it, expect } from 'vitest';
import { dialects } from '../dialects/registry';
import { resolveEditorAction } from './editorActions';
import type { KeyDef } from './layoutSchema';
import {
  GRID_COLUMNS,
  KEY_SPAN,
  ROW_KEYS,
  functionStrip,
} from './templateRows';

/**
 * The shared template's geometry, pinned for every registered machine: a keycap
 * is the same size on all of them, which is the whole reason the layouts author
 * legends and matrix tokens but never a width.
 *
 * The function-key strip is the part that drifted. It renders on the key rows'
 * own grid, so a strip key is a keycap wide whether a machine has three of them
 * or more than a line holds - it wraps rather than shrinking.
 */
const span = (keys: KeyDef[]): number => keys.reduce((n, k) => n + k.spanX, 0);

describe('every keyboard keeps the template grid', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} sizes its keys off the template`, () => {
      const layout = dialect.keyboardLayout;
      expect(layout.gridColumns).toBe(GRID_COLUMNS);

      for (const [i, row] of layout.rows.entries()) {
        expect(span(row), `${dialect.id} row ${i}`).toBe(layout.gridColumns);
      }

      // The four typing bands are keycaps only, ten at most - a band that ran
      // to eleven, or paid for an extra key by widening one, would be reading
      // its own machine's board rather than the template. A short band (the
      // Sinclairs' ZXCV row) is centred instead of stretched.
      for (const [i, row] of layout.rows.slice(0, 4).entries()) {
        const printing = row.filter((k) => k.emits.length > 0);
        expect(printing.length, `${dialect.id} band ${i}`).toBeLessThanOrEqual(
          ROW_KEYS,
        );
        for (const key of printing) {
          expect(key.spanX, `${dialect.id} ${key.id}`).toBe(KEY_SPAN);
        }
      }

      const functionKeys = layout.functionKeys ?? [];
      for (const key of functionKeys) {
        expect(key.spanX, `${dialect.id} ${key.id}`).toBe(KEY_SPAN);
      }
      for (const [i, line] of functionStrip(functionKeys).entries()) {
        expect(span(line), `${dialect.id} strip line ${i}`).toBe(GRID_COLUMNS);
      }
    });
  }
});

describe('every function key is a function key', () => {
  for (const dialect of dialects) {
    const strip = dialect.keyboardLayout.functionKeys ?? [];
    if (strip.length === 0) continue;
    it(`${dialect.id} keeps its strip out of the editor`, () => {
      // The strip's keys press the machine's matrix and nothing else. Without
      // an explicit `editor: null` a label falls back to inserting its own
      // text, so a key marked `f1` types "f1" into the program.
      const layout = dialect.keyboardLayout;
      const base =
        layout.layers.find((l) => l.activeWhen.length === 0) ??
        layout.layers[0]!;
      for (const key of strip) {
        expect(key.style, `${dialect.id} ${key.id}`).toBe('fn');
        expect(
          resolveEditorAction(layout, key, base.id),
          `${dialect.id} ${key.id}`,
        ).toBeNull();
      }
    });
  }
});

describe('functionStrip', () => {
  const keys = (n: number): KeyDef[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `K${i}`,
      spanX: KEY_SPAN,
      emits: [`K${i}`],
      labels: [{ text: `K${i}` }],
    }));
  const ids = (line: KeyDef[]): string[] =>
    line.filter((k) => k.emits.length > 0).map((k) => k.id);

  it('leaves a full line alone', () => {
    const [line, ...rest] = functionStrip(keys(ROW_KEYS));
    expect(rest).toHaveLength(0);
    expect(line).toHaveLength(ROW_KEYS);
  });

  it('centres a short line', () => {
    const [line] = functionStrip(keys(3));
    expect(ids(line!)).toEqual(['K0', 'K1', 'K2']);
    // A spacer either side, equal, so the keys sit under the middle of the board.
    expect(line![0]!.spanX).toBe(line!.at(-1)!.spanX);
  });

  it('wraps a strip wider than a line, and centres what is left over', () => {
    // Squeezing them onto one line is what made a key narrower than a keycap.
    const lines = functionStrip(keys(13));
    expect(lines).toHaveLength(2);
    expect(ids(lines[0]!)).toHaveLength(ROW_KEYS);
    expect(ids(lines[1]!)).toEqual(['K10', 'K11', 'K12']);
  });

  it('gives an empty strip no lines', () => {
    expect(functionStrip([])).toEqual([]);
  });
});
