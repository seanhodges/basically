import { describe, it, expect } from 'vitest';
import { dialects } from '../dialects/registry';
import { resolveEditorAction, resolveEmits } from './editorActions';
import type { KeyDef } from './layoutSchema';
import { GRID_COLUMNS, KEY_SPAN, ROW_KEYS } from './templateRows';

/**
 * The shared template's geometry, pinned for every registered machine: a keycap
 * is the same size on all of them, which is the whole reason the layouts author
 * legends and matrix tokens but never a width.
 *
 * The function-key strip is the part that drifted. Its tracks are the key rows'
 * own, so a strip key is a keycap whether a machine has three of them or more
 * than a row's worth - past that the strip scrolls rather than shrinking them,
 * which is why `spanX` is the load-bearing number here.
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

      for (const key of layout.functionKeys ?? []) {
        expect(key.spanX, `${dialect.id} ${key.id}`).toBe(KEY_SPAN);
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

/**
 * Machines whose keyboards carry no cursor keys, so their layouts must not
 * pretend otherwise. Listed rather than derived, because "does this machine
 * have arrow keys" is a fact about the hardware that only a person can answer.
 */
const NO_CURSOR_KEYS = new Set(['altair8800']);

/** Direction → the arrow a CURSOR legend prints for it. */
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' } as const;

describe('every machine offers the cursor keys it has', () => {
  for (const dialect of dialects) {
    const layout = dialect.keyboardLayout;
    const mode = layout.editorModes?.find((m) => m.id === 'cursor');

    if (NO_CURSOR_KEYS.has(dialect.id)) {
      it(`${dialect.id} has none, and offers none`, () => {
        expect(mode).toBeUndefined();
      });
      continue;
    }

    it(`${dialect.id} presses its own cursor keys, not the letters`, () => {
      // A new dialect that ships without this either has to wire its cursor
      // keys up or say, above, that the machine has none.
      expect(mode, `${dialect.id} declares no CURSOR mode`).toBeDefined();

      const keys = new Map(layout.rows.flat().map((k) => [k.id, k]));
      const found = new Map<string, string[]>();
      for (const [action, arrow] of Object.entries(ARROWS)) {
        for (const key of keys.values()) {
          const label = layout.layers
            .map((l, i) => (l.id === mode!.layer ? key.labels[i] : null))
            .find((l) => l?.text === arrow);
          if (!label) continue;
          // The legend moves the caret in the editor and presses the machine's
          // own key on the machine - never the letter the keycap carries.
          expect(label.editor, `${dialect.id} ${arrow}`).toEqual({ action });
          const tokens = resolveEmits(layout, key, mode!.layer);
          expect(tokens, `${dialect.id} ${arrow}`).not.toEqual(key.emits);
          found.set(action, tokens);
        }
      }
      // Three is the floor: the PMD 85 has no down key, and its layout says so.
      expect(found.size, `${dialect.id} cursor directions`).toBeGreaterThan(2);
    });
  }
});
