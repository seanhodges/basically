import { describe, it, expect } from 'vitest';
import { bbcKeyboardLayout } from './keyboardLayout';
import { matrixForToken } from '../../emulator/bbc/keyboard';

const layout = bbcKeyboardLayout;
const tabs = layout.tabs ?? [];
const allRows = tabs.flatMap((t) => t.rows);
const allKeys = allRows.flat();

/** A "regular" key is a full-width key (one tenth of the grid). */
const REGULAR_SPAN = layout.gridColumns / 10;

describe('bbcmicro keyboard layout', () => {
  it('is split into ABC and symbol pages', () => {
    expect(tabs.map((t) => t.id)).toEqual(['abc', 'sym']);
  });

  it('every row spans exactly the grid width', () => {
    for (const tab of tabs) {
      tab.rows.forEach((row, i) => {
        const total = row.reduce((n, k) => n + k.spanX, 0);
        expect(total, `${tab.id} row ${i}`).toBe(layout.gridColumns);
      });
    }
  });

  it('no row carries more than ten regular-sized keys', () => {
    for (const tab of tabs) {
      tab.rows.forEach((row, i) => {
        const regular = row.filter((k) => k.spanX >= REGULAR_SPAN).length;
        expect(regular, `${tab.id} row ${i}`).toBeLessThanOrEqual(10);
      });
    }
  });

  it('shares the function strip and bottom row across both pages', () => {
    const firstIds = (rows: (typeof tabs)[number]['rows']) =>
      rows[0]!.map((k) => k.id);
    const lastIds = (rows: (typeof tabs)[number]['rows']) =>
      rows[rows.length - 1]!.map((k) => k.id);
    const [abc, sym] = tabs;
    // Function strip (top row) is identical on both pages.
    expect(firstIds(sym!.rows)).toEqual(firstIds(abc!.rows));
    expect(firstIds(abc!.rows)).toContain('Escape');
    expect(firstIds(abc!.rows)).toContain('F0');
    expect(firstIds(abc!.rows)).toContain('Break');
    // Bottom row (with the space bar) is identical on both pages.
    expect(lastIds(sym!.rows)).toEqual(lastIds(abc!.rows));
    expect(lastIds(abc!.rows)).toEqual([
      'Ctrl',
      'ShiftLock',
      'Copy',
      'ArrowLeft',
      'ArrowDown',
      'ArrowUp',
      'ArrowRight',
      'Space',
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

  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const key of allKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('every emitted token maps to the BBC matrix (except Break)', () => {
    for (const key of allKeys) {
      for (const token of key.emits) {
        if (token === 'Break') continue; // reset line, not a matrix key
        expect(matrixForToken(token), `${key.id} → ${token}`).toBeDefined();
      }
    }
  });
});
