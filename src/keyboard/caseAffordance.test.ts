// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What withdrawing the case affordance must not take with it.
 *
 * Nothing in the suite asserted *reachability* before this. The symbol test
 * presses a machine's keys directly and never asks whether a user could get to
 * them; the geometry test asserts symbols do not appear outside the SYM mode.
 * Both stay green while a character becomes untypeable, which is exactly what
 * hiding a keycap can do - the SYM page toggle is welded onto the shift flank
 * on every machine that has a second page.
 *
 * So the assertions here are about the keyboard the renderer actually draws.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import { letterCaseFor } from '../dialects/letterCase';
import { SYMBOL_LAYER_1, SYMBOL_LAYER_2 } from './templateRows';
import type { KeyDef, KeyboardLayout } from './layoutSchema';
import {
  isShiftKey,
  rowsWithoutCaseKey,
  withdrawsCaseKey,
} from './caseAffordance';

/** Every machine with no lower case at all - where the setting has an effect. */
const upperCaseOnly = dialects.filter(
  (d) => letterCaseFor(d.id)!.lowerCase === 'none',
);

/** Every machine that draws lower case - where it must have none. */
const hasLowerCase = dialects.filter(
  (d) => letterCaseFor(d.id)!.lowerCase !== 'none',
);

const drawn = (layout: KeyboardLayout, hide: boolean): KeyDef[] =>
  rowsWithoutCaseKey(layout.rows, hide).flat();

describe('the keyboard under Strict characters', () => {
  it('has machines to say this about', () => {
    expect(upperCaseOnly.length).toBeGreaterThan(0);
  });

  it.each(upperCaseOnly)('$id offers no shift key', (dialect) => {
    const layout = dialect.keyboardLayout!;
    expect(layout.rows.flat().some(isShiftKey)).toBe(true);
    expect(drawn(layout, true).some(isShiftKey)).toBe(false);
  });

  it.each(upperCaseOnly)('$id keeps its rows the same shape', (dialect) => {
    const layout = dialect.keyboardLayout!;
    const widths = (rows: KeyDef[][]) => rows.map((r) => r.map((k) => k.spanX));
    expect(widths(rowsWithoutCaseKey(layout.rows, true))).toEqual(
      widths(layout.rows),
    );
  });

  it.each(upperCaseOnly)(
    '$id keeps every key that is not the shift',
    (dialect) => {
      const layout = dialect.keyboardLayout!;
      const kept = new Set(drawn(layout, true).map((k) => k.id));
      for (const key of layout.rows.flat()) {
        if (isShiftKey(key)) continue;
        expect(kept.has(key.id), `${dialect.id} lost ${key.id}`).toBe(true);
      }
    },
  );
});

describe('what stays reachable', () => {
  /** The machines whose SYM mode has a second page to toggle to. */
  const withSecondPage = upperCaseOnly.filter((d) =>
    d.keyboardLayout!.layers.some((l) => l.id === SYMBOL_LAYER_2),
  );

  it('has machines with a second symbol page', () => {
    expect(withSecondPage.length).toBeGreaterThan(0);
  });

  it.each(withSecondPage)(
    '$id draws the key its symbol page toggle sits on',
    (dialect) => {
      const layout = dialect.keyboardLayout!;
      const pageIdx = layout.layers.findIndex((l) => l.id === SYMBOL_LAYER_1);
      // The toggle is whichever bottom-row modifier carries a label on the SYM
      // page (see `withSymbolMode`) - and on every machine here that is the
      // shift, which is why hiding it outright would cost a whole page.
      const toggle = layout.rows[3]!.find(
        (k) => k.modifier && k.labels[pageIdx] != null,
      );
      expect(toggle, `${dialect.id} has no SYM page toggle`).toBeDefined();
      expect(isShiftKey(toggle!)).toBe(true);
      // Inside the SYM mode a mode-only layer is pinned, and the renderer is
      // told to keep the keycap - the case rule never applies there.
      const inSymbolMode = drawn(layout, false).map((k) => k.id);
      expect(inSymbolMode).toContain(toggle!.id);
    },
  );

  /** The machines that style a control key as a shift flank. */
  const styledLikeShift = upperCaseOnly.filter((d) =>
    d
      .keyboardLayout!.rows.flat()
      .some((k) => k.modifier && !isShiftKey(k) && k.style === 'shift'),
  );

  it('has machines that draw a control key as a shift', () => {
    // The Altair and the Apple I, where CTRL-C is the only way to interrupt a
    // running program. A rule keyed on how a key is drawn would take it away.
    expect(styledLikeShift.map((d) => d.id)).toEqual(['altair8800', 'apple1']);
  });

  it.each(styledLikeShift)('$id keeps its control key', (dialect) => {
    const layout = dialect.keyboardLayout!;
    const ctrl = layout.rows
      .flat()
      .find((k) => k.modifier && !isShiftKey(k) && k.style === 'shift')!;
    const kept = drawn(layout, true).find((k) => k.id === ctrl.id);
    expect(kept, `${dialect.id} lost ${ctrl.id}`).toBeDefined();
    expect(kept!.emits).toEqual(ctrl.emits);
  });
});

describe('machines the setting does not touch', () => {
  it.each(hasLowerCase)(
    '$id keeps an unchanged keyboard with the setting on',
    (dialect) => {
      const layout = dialect.keyboardLayout!;
      expect(withdrawsCaseKey(dialect.id, true)).toBe(false);
      // Not merely equal - the same rows, so no memo downstream is
      // invalidated for a machine the setting has nothing to say about.
      expect(rowsWithoutCaseKey(layout.rows, false)).toBe(layout.rows);
      expect(layout.rows.flat().some(isShiftKey)).toBe(
        rowsWithoutCaseKey(layout.rows, false).flat().some(isShiftKey),
      );
    },
  );

  it.each(upperCaseOnly)(
    '$id keeps its shift while the setting is off',
    (dialect) => {
      expect(withdrawsCaseKey(dialect.id, false)).toBe(false);
    },
  );

  it.each(upperCaseOnly)('$id withdraws it while the setting is on', (d) => {
    expect(withdrawsCaseKey(d.id, true)).toBe(true);
  });
});
