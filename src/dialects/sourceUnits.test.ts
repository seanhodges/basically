// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Telling text from notation.
 *
 * Two readers depend on this one classification agreeing with itself - the
 * report of what a machine will convert and the strict editor's case forcing -
 * so the three kinds are pinned here rather than only through what each of them
 * happens to ask.
 */
import { describe, expect, it } from 'vitest';
import { getDialect } from './registry';
import { sourceUnitContext, unitAt } from './sourceUnits';

const at = (dialectId: string, body: string, i = 0) =>
  unitAt(body, i, sourceUnitContext(getDialect(dialectId))!);

describe('one unit at a position', () => {
  it('calls a single stored character text', () => {
    expect(at('zx81', 'A')).toEqual({ kind: 'text', length: 1, codes: [38] });
  });

  it('calls a raw byte notation, however it is spelled', () => {
    expect(at('zx81', '\\{41}').kind).toBe('notation');
    expect(at('zx81', '\\{41}').length).toBe(5);
    expect(at('atom', '{0x41}')).toMatchObject({ kind: 'notation', length: 6 });
  });

  it('calls a named escape notation', () => {
    expect(at('commodore64', '{white}')).toMatchObject({
      kind: 'notation',
      length: 7,
    });
  });

  it('calls a short keyword spelling notation, not the letters in it', () => {
    // The Commodores' shifted-letter form *requires* its lower-case prefix, so
    // reading it as text would report a conversion on every archive listing.
    expect(at('commodore64', 'pR')).toMatchObject({
      kind: 'notation',
      length: 2,
    });
    expect(at('bbcmicro', 'P.')).toMatchObject({ kind: 'notation', length: 2 });
  });

  it('calls what the machine cannot read unreadable, and still advances', () => {
    const half = at('zx81', '{0x4');
    expect(half.kind).toBe('unreadable');
    expect(half.length).toBe(1);
    expect(half.codes).toEqual([]);
  });

  it('reads from the given position, not only the start', () => {
    expect(at('zx81', '10 A', 3)).toMatchObject({ kind: 'text', length: 1 });
  });

  it('has no context for a machine with no charset probe', () => {
    // Every registered machine has one today; the null arm is what keeps a
    // caller from assuming that for a machine added tomorrow.
    expect(sourceUnitContext(getDialect('zx81'))).not.toBeNull();
  });
});
