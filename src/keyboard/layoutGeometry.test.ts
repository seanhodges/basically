import { describe, it, expect } from 'vitest';
import { dialects } from '../dialects/registry';
import { letterCaseFor } from '../dialects/letterCase';
import { resolveEditorAction, resolveEmits } from './editorActions';
import type { KeyDef, KeyboardLayout } from './layoutSchema';
import {
  FLANK_SPAN,
  GRID_COLUMNS,
  KEY_SPAN,
  ROW_KEYS,
  SYMBOL_LAYER_1,
  SYMBOL_LAYER_2,
  SYMBOL_MODE_ID,
  SYMBOL_PAGE_1,
  SYMBOL_PAGE_2,
} from './templateRows';

/**
 * The standard arrangement, pinned for every registered machine: the
 * mobile-convention bands (number row, ten-key letter row, centred nine-key
 * home row, the shift/delete-flanked seven-letter row, and a bottom row
 * ending quote-then-Enter), a keycap the same size on all of them, and the
 * SYM pages at the canonical positions. These are the rules a new dialect's
 * keyboard is authored to; a layout that drifts from them fails here by
 * name.
 *
 * The function-key strip: its tracks are the key rows' own, so a strip key
 * is a keycap whether a machine has three of them or more than a row's
 * worth - past that the strip scrolls rather than shrinking them, which is
 * why `spanX` is the load-bearing number here.
 */
const span = (keys: KeyDef[]): number => keys.reduce((n, k) => n + k.spanX, 0);

const printing = (row: KeyDef[]): KeyDef[] =>
  row.filter((k) => k.emits.length > 0 || k.modifier);

/** The letter bands the SYM pages weld onto: Q row, home row, flanked letters. */
function letterBands(layout: KeyboardLayout): KeyDef[][] {
  return [
    printing(layout.rows[1]!),
    printing(layout.rows[2]!),
    printing(layout.rows[3]!).slice(1, -1),
  ];
}

/**
 * Machines with lower case whose keyboard offers no way to reach it, and why.
 *
 * Named rather than derived, so a machine cannot join them by an omission.
 */
const NO_CASE_KEY: Record<string, string> = {
  pet: 'no Commodore key: the set switch is a POKE, not a keypress',
};

/** Whether locking a modifier on this layout latches the machine's letter case. */
const hasCaseLock = (layout: KeyboardLayout): boolean =>
  layout.modifiers.some((m) => m.caseLock);

/** Whether any letter key carries the two cases across the shift layer. */
function hasCasePair(layout: KeyboardLayout): boolean {
  const base =
    layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0]!;
  const shifted = layout.layers.find((l) => l.activeWhen.length > 0);
  if (!shifted) return false;
  const baseIdx = layout.layers.indexOf(base);
  const shiftIdx = layout.layers.indexOf(shifted);
  return letterBands(layout)
    .flat()
    .some((key) => {
      const off = key.labels[baseIdx]?.text;
      const on = key.labels[shiftIdx]?.text;
      return (
        !!off &&
        !!on &&
        off !== on &&
        off.length === 1 &&
        off.toUpperCase() === on.toUpperCase()
      );
    });
}

describe('both letter cases are reachable where the machine has them', () => {
  for (const dialect of dialects) {
    const facts = letterCaseFor(dialect.id)!;
    const layout = dialect.keyboardLayout;

    if (facts.lowerCase === 'none') {
      it(`${dialect.id} offers neither, having no lower case`, () => {
        // Not an omission but a claim: a keycap typing a character this
        // machine's character generator cannot draw would be inventing one.
        expect(hasCasePair(layout), `${dialect.id} case pair`).toBe(false);
        expect(hasCaseLock(layout), `${dialect.id} case lock`).toBe(false);
        expect(
          layout.powerOnCase,
          `${dialect.id} power-on case`,
        ).toBeUndefined();
      });
      continue;
    }

    it(`${dialect.id} offers both, by the route the machine uses`, () => {
      const excuse = NO_CASE_KEY[dialect.id];
      const reachable = hasCasePair(layout) || hasCaseLock(layout);
      if (excuse) {
        expect(reachable, `${dialect.id} is excused: ${excuse}`).toBe(false);
      } else {
        expect(
          reachable,
          `${dialect.id} draws lower case but its keyboard cannot type it - ` +
            'give it a shift case pair or its own case-lock key',
        ).toBe(true);
      }
      // The case a keycap starts in is a statement, not a default: the BBC
      // powers up caps-locked and the CPC in lower case.
      expect(layout.powerOnCase, `${dialect.id} power-on case`).toBeDefined();
    });
  }

  it('reaches every case lock by locking a sticky modifier', () => {
    // The lock is the shift key's second tap, as a phone keyboard's is, so the
    // modifier carrying it must be one that can be tapped and locked at all.
    for (const dialect of dialects) {
      for (const mod of dialect.keyboardLayout.modifiers) {
        if (!mod.caseLock) continue;
        expect(mod.sticky, `${dialect.id} ${mod.id}`).toBe(true);
        expect(mod.lockable, `${dialect.id} ${mod.id}`).toBe(true);
        expect(
          mod.caseLock.emits.length,
          `${dialect.id} ${mod.id}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('excuses only registered machines that really have lower case', () => {
    for (const id of Object.keys(NO_CASE_KEY)) {
      expect(letterCaseFor(id)?.lowerCase, id).not.toBe('none');
    }
  });
});

describe('every keyboard keeps the template grid', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} sizes its keys off the template`, () => {
      const layout = dialect.keyboardLayout;
      expect(layout.gridColumns).toBe(GRID_COLUMNS);

      for (const [i, row] of layout.rows.entries()) {
        expect(span(row), `${dialect.id} row ${i}`).toBe(layout.gridColumns);
      }

      // The mobile-convention bands: number row, ten-key letter row, a
      // centred nine-key home row, and a bottom letter row of seven keys
      // flanked by shift and the machine's delete key at half again a
      // keycap's width.
      expect(layout.rows, `${dialect.id} rows`).toHaveLength(5);
      expect(printing(layout.rows[0]!), `${dialect.id} numbers`).toHaveLength(
        ROW_KEYS,
      );
      expect(printing(layout.rows[1]!), `${dialect.id} Q row`).toHaveLength(
        ROW_KEYS,
      );
      expect(printing(layout.rows[2]!), `${dialect.id} home row`).toHaveLength(
        9,
      );
      for (const row of layout.rows.slice(0, 3)) {
        for (const key of printing(row)) {
          expect(key.spanX, `${dialect.id} ${key.id}`).toBe(KEY_SPAN);
        }
      }
      const flanked = printing(layout.rows[3]!);
      expect(flanked, `${dialect.id} flanked row`).toHaveLength(9);
      expect(flanked[0]!.modifier, `${dialect.id} shift flank`).toBeTruthy();
      expect(flanked[0]!.spanX, `${dialect.id} shift flank`).toBe(FLANK_SPAN);
      expect(flanked.at(-1)!.spanX, `${dialect.id} delete flank`).toBe(
        FLANK_SPAN,
      );
      for (const key of flanked.slice(1, -1)) {
        expect(key.spanX, `${dialect.id} ${key.id}`).toBe(KEY_SPAN);
      }

      // The letter bands carry letters, never punctuation keycaps: those
      // live in the SYM mode.
      const base =
        layout.layers.find((l) => l.activeWhen.length === 0) ??
        layout.layers[0]!;
      const baseIdx = layout.layers.indexOf(base);
      for (const band of letterBands(layout)) {
        for (const key of band) {
          const text = key.labels[baseIdx]?.text ?? '';
          expect(text, `${dialect.id} ${key.id}`).toMatch(/^[A-Za-z]$/);
        }
      }

      for (const key of layout.functionKeys ?? []) {
        expect(key.spanX, `${dialect.id} ${key.id}`).toBe(KEY_SPAN);
      }
    });

    it(`${dialect.id} ends its bottom row quote-then-Enter`, () => {
      const layout = dialect.keyboardLayout;
      const bottom = printing(layout.rows[4]!);
      const enter = bottom.at(-1)!;
      expect(
        resolveEditorAction(layout, enter, layout.layers[0]!.id),
        `${dialect.id} ${enter.id}`,
      ).toEqual({ action: 'newline' });
      expect(enter.spanX, `${dialect.id} ${enter.id}`).toBeGreaterThanOrEqual(
        FLANK_SPAN,
      );
      const quote = bottom.at(-2)!;
      expect(
        resolveEditorAction(layout, quote, layout.layers[0]!.id),
        `${dialect.id} ${quote.id}`,
      ).toEqual({ insert: '"' });
    });

    it(`${dialect.id} types symbols only through the SYM mode`, () => {
      // The quote key is the one dedicated symbol keycap the bottom row
      // keeps; everywhere else, a symbol on a typing band would be a second
      // way in - a shifted legend or stray keycap the normalised layered
      // view no longer shows.
      const layout = dialect.keyboardLayout;
      const canonical = new Set(
        [...SYMBOL_PAGE_1, ...SYMBOL_PAGE_2].flat().filter((c) => c !== null),
      );
      for (const row of layout.rows.slice(0, 4)) {
        for (const key of printing(row)) {
          for (const [layerIdx, layer] of layout.layers.entries()) {
            if (layer.modeOnly || !key.labels[layerIdx]) continue;
            const action = resolveEditorAction(layout, key, layer.id);
            if (!action || !('insert' in action)) continue;
            expect(
              canonical.has(action.insert),
              `${dialect.id} ${key.id} types "${action.insert}" on ` +
                `layer ${layer.id} outside the SYM mode`,
            ).toBe(false);
          }
        }
      }
    });

    it(`${dialect.id} keeps the SYM pages at the canonical positions`, () => {
      const layout = dialect.keyboardLayout;
      const pages: [string, readonly (readonly (string | null)[])[]][] = [
        [SYMBOL_LAYER_1, SYMBOL_PAGE_1],
        [SYMBOL_LAYER_2, SYMBOL_PAGE_2],
      ];
      // Page 1 is mandatory; page 2 - and the toggle - only where something
      // is mapped on it.
      expect(
        layout.layers.find((l) => l.id === SYMBOL_LAYER_1)?.modeOnly,
        `${dialect.id} has no SYM layer`,
      ).toBe(true);
      const mode = layout.editorModes?.[1];
      expect(mode?.id, `${dialect.id} second tab`).toBe(SYMBOL_MODE_ID);
      const hasPage2 = layout.layers.some((l) => l.id === SYMBOL_LAYER_2);
      expect(mode?.shiftedLayer, `${dialect.id} page toggle`).toBe(
        hasPage2 ? SYMBOL_LAYER_2 : undefined,
      );

      const canonical = new Set(
        [...SYMBOL_PAGE_1, ...SYMBOL_PAGE_2].flat().filter((c) => c !== null),
      );
      let mapped = 0;
      for (const [layerId, page] of pages) {
        const idx = layout.layers.findIndex((l) => l.id === layerId);
        if (idx < 0) continue;
        for (const [bandIdx, band] of letterBands(layout).entries()) {
          for (const [i, key] of band.entries()) {
            const slot = page[bandIdx]![i]!;
            const label = key.labels[idx];
            const cell = `${dialect.id} ${layerId} ${key.id}`;
            if (!label?.text) {
              // A blank cell: present, inert, and pressing nothing.
              expect(label, cell).toEqual({ editor: null, emits: [] });
              continue;
            }
            const insert =
              label.editor && 'insert' in label.editor
                ? label.editor.insert
                : null;
            if (label.editor === null) {
              // The page toggle rides the shift flank and only there.
              expect(key.modifier, cell).toBeTruthy();
              expect(label.text, cell).toBe(
                layerId === SYMBOL_LAYER_1 ? '1/2' : '2/2',
              );
              continue;
            }
            // A symbol never squats on an unassigned or foreign slot: its
            // insert is the slot's own symbol, or a machine variant of it
            // that is no other slot's symbol.
            expect(slot, cell).not.toBeNull();
            if (insert !== null && canonical.has(insert)) {
              expect(insert, cell).toBe(slot);
            }
            mapped++;
          }
        }
      }
      // A SYM mode with nothing in it would satisfy every rule above.
      expect(mapped, `${dialect.id} maps no symbols at all`).toBeGreaterThan(
        10,
      );
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
const NO_CURSOR_KEYS = new Set(['altair8800', 'apple1']);

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

    it(`${dialect.id} blanks every non-arrow key in CURSOR mode`, () => {
      // Above the bottom row, CURSOR mode owns every key: one that carries
      // no arrow is blank and inert, like an unmapped SYM cell, never a
      // character that would type. Only the bottom row keeps working - and
      // the arrows themselves, wherever they sit (the Sinclairs' are on the
      // number row).
      const idx = layout.layers.findIndex((l) => l.id === mode!.layer);
      for (const row of layout.rows.slice(0, 4)) {
        for (const key of row.filter((k) => k.emits.length > 0 || k.modifier)) {
          const label = key.labels[idx];
          const cell = `${dialect.id} ${key.id}`;
          expect(label, `${cell} has no CURSOR label`).toBeTruthy();
          if (label!.editor && 'action' in label!.editor) continue;
          expect(label, cell).toEqual({ editor: null, emits: [] });
        }
      }
    });
  }
});
