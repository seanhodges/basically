import { describe, it, expect } from 'vitest';
import { bbcKeyboardLayout } from './keyboardLayout';
import { matrixForToken } from '../../emulator/bbc/keyboard';

const layout = bbcKeyboardLayout;
const tabs = layout.tabs ?? [];
const allRows = [...layout.rows, ...tabs.flatMap((t) => t.rows)];
const allKeys = allRows.flat();
/** Filler cells (spacers) emit nothing and carry no modifier. */
const realKeys = allKeys.filter((k) => k.emits.length > 0 || k.modifier);

/** A "regular" key is a full-width key (one tenth of the narrow grid). */
const NARROW_GRID = layout.narrowGridColumns ?? layout.gridColumns;
const REGULAR_SPAN = NARROW_GRID / 10;

describe('bbcmicro keyboard layout', () => {
  it('serves both a wide single page and a narrow tabbed variant', () => {
    expect(layout.gridColumns).toBe(66);
    expect(layout.narrowGridColumns).toBe(60);
    expect(layout.rows.length).toBeGreaterThan(0);
    expect(tabs.map((t) => t.id)).toEqual(['abc', 'sym']);
  });

  it('every narrow row spans exactly the narrow grid width', () => {
    for (const tab of tabs) {
      tab.rows.forEach((row, i) => {
        const total = row.reduce((n, k) => n + k.spanX, 0);
        expect(total, `${tab.id} row ${i}`).toBe(NARROW_GRID);
      });
    }
  });

  it('every wide row spans exactly the wide grid width', () => {
    layout.rows.forEach((row, i) => {
      const total = row.reduce((n, k) => n + k.spanX, 0);
      expect(total, `wide row ${i}`).toBe(layout.gridColumns);
    });
  });

  it('no narrow row carries more than ten regular-sized keys', () => {
    for (const tab of tabs) {
      tab.rows.forEach((row, i) => {
        const regular = row.filter(
          (k) => k.spanX >= REGULAR_SPAN && k.emits.length > 0,
        ).length;
        expect(regular, `${tab.id} row ${i}`).toBeLessThanOrEqual(10);
      });
    }
  });

  it('shares the function strip and bottom row across both narrow pages', () => {
    const ids = (row: (typeof tabs)[number]['rows'][number]) =>
      row.map((k) => k.id);
    const [abc, sym] = tabs;
    const abcRows = abc!.rows;
    const symRows = sym!.rows;
    // Function strip (top row) is identical on both pages, with Esc/F0/Break
    // but no longer Tab or Caps Lock.
    expect(ids(symRows[0]!)).toEqual(ids(abcRows[0]!));
    expect(ids(abcRows[0]!)).toContain('Escape');
    expect(ids(abcRows[0]!)).toContain('F0');
    expect(ids(abcRows[0]!)).toContain('Break');
    expect(ids(abcRows[0]!)).not.toContain('Tab');
    expect(ids(abcRows[0]!)).not.toContain('CapsLock');
    // Bottom row (centred space bar, arrows to its right) shared on both pages.
    const abcBottom = abcRows[abcRows.length - 1]!;
    const symBottom = symRows[symRows.length - 1]!;
    expect(ids(symBottom)).toEqual(ids(abcBottom));
    expect(ids(abcBottom)).toEqual([
      'Ctrl',
      'ShiftLock',
      'Copy',
      'ShiftBottom',
      'Space',
      'ArrowLeft',
      'ArrowDown',
      'ArrowUp',
      'ArrowRight',
    ]);
  });

  it('keeps the punctuation keys off the ABC page', () => {
    const symbolTokens = [
      'Minus',
      'Caret',
      'Backslash',
      'At',
      'BracketLeft',
      'Underscore',
      'Semicolon',
      'Colon',
      'BracketRight',
      'Comma',
      'Period',
      'Slash',
    ];
    const abcIds = new Set(tabs[0]!.rows.flat().map((k) => k.id));
    const symIds = new Set(tabs[1]!.rows.flat().map((k) => k.id));
    for (const token of symbolTokens) {
      expect(abcIds.has(token), `ABC should not have ${token}`).toBe(false);
      expect(symIds.has(token), `SYM should have ${token}`).toBe(true);
    }
  });

  it('lays the symbol page out as four rows of three with Return above Delete', () => {
    const symBody = tabs[1]!.rows.slice(1, -1); // drop shared fn strip + bottom
    expect(symBody).toHaveLength(4);
    for (const row of symBody) {
      const symbolKeys = row.filter(
        (k) => k.emits.length > 0 && !['Enter', 'Delete'].includes(k.id),
      );
      expect(symbolKeys).toHaveLength(3);
    }
    // Return is the right-most real key on row 3, Delete on row 4.
    const rightMost = (row: (typeof symBody)[number]) =>
      [...row].reverse().find((k) => k.emits.length > 0)?.id;
    expect(rightMost(symBody[2]!)).toBe('Enter');
    expect(rightMost(symBody[3]!)).toBe('Delete');
  });

  it('exposes the wide-only keys on the single page', () => {
    const wideIds = new Set(layout.rows.flat().map((k) => k.id));
    for (const id of ['Tab', 'CapsLock', 'ShiftR']) {
      expect(wideIds.has(id), `wide layout should have ${id}`).toBe(true);
    }
  });

  it('uses inert spacers (no emits, no modifier) for alignment', () => {
    for (const k of allKeys) {
      if (k.style === 'spacer') {
        expect(k.emits, k.id).toHaveLength(0);
        expect(k.modifier, k.id).toBeUndefined();
      }
    }
  });

  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const key of realKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('every emitted token maps to the BBC matrix (except Break)', () => {
    for (const key of realKeys) {
      for (const token of key.emits) {
        if (token === 'Break') continue; // reset line, not a matrix key
        expect(matrixForToken(token), `${key.id} → ${token}`).toBeDefined();
      }
    }
  });
});
