// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * How each machine reaches its other letter case, proved on the booted ROM.
 *
 * The keyboard layouts rest on claims nothing else checks: which case a machine
 * gives an unshifted letter key when it has just started, and what its shift
 * key and its case-lock key do to that. Guessing them is how a keyboard comes
 * to print one case and type the other, so every claim here is a keypress on a
 * real ROM with the echo read back off the screen - and the layouts are
 * authored from what this reports, not the other way round.
 *
 * Two of the answers are not what a reader would guess. The BBC powers up
 * caps-locked and its SHIFT gives upper case in *both* lock states, so its
 * lower case is reachable only through CAPS LOCK - there is no shift case pair
 * on that machine. The CPC powers up in lower case, so its unshifted letter
 * keys are the lower-case ones. The Commodores' case flip is a
 * character-set switch (SHIFT + the Commodore key), which redraws the whole
 * screen rather than changing what any key types.
 *
 * Only the machines with something to prove: a machine whose character
 * generator has no lower case has no other case to reach, and is excused by
 * name against its declared facts below.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects, getDialect } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  runUntil,
  screenText,
} from './bootHarness';
import { letterCaseFor } from './letterCase';
import type { MachineEmulator } from './types';

let restoreRomLoading: () => void;
beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});
afterAll(() => {
  restoreRomLoading();
});

/** Hold long enough for any of these ROMs to scan the matrix. */
const HOLD_FRAMES = 5;

async function tap(machine: MachineEmulator, tokens: string[]): Promise<void> {
  for (const token of tokens) machine.setKey(token, true);
  await runFrames(machine, HOLD_FRAMES);
  for (const token of tokens) machine.setKey(token, false);
  await runFrames(machine, HOLD_FRAMES);
}

/** The last character on the screen after `tokens` are pressed. */
async function echo(
  machine: MachineEmulator,
  tokens: string[],
): Promise<string> {
  const before = screenText(machine).trimEnd();
  await tap(machine, tokens);
  await runFrames(machine, 10);
  const after = screenText(machine).trimEnd();
  // What the screen gained, from where the two first differ. The *first*
  // letter of that, not the last: several of these machines park a cursor
  // marker after the caret (the Spectrum's L/C mode letter), which would
  // otherwise be read as the character typed.
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  return [...after.slice(i)].find((c) => /[A-Za-z]/.test(c)) ?? '';
}

describe('the case a machine types', () => {
  it('boots the BBC caps-locked, and reaches lower case only by the lock', async () => {
    const machine = await bootMachine(getDialect('bbcmicro'), { ramKb: 32 });
    await runFrames(machine, 300);
    expect(await echo(machine, ['KeyA'])).toBe('A');
    // SHIFT is not a case pair here: it gives upper case in either lock state,
    // which is why the BBC layout carries no lower-case shift legends.
    expect(await echo(machine, ['Shift', 'KeyB'])).toBe('B');
    await tap(machine, ['CapsLock']);
    expect(await echo(machine, ['KeyC'])).toBe('c');
    expect(await echo(machine, ['Shift', 'KeyD'])).toBe('D');
  }, 120000);

  it('boots the CPC in lower case, with SHIFT and the lock both reaching upper', async () => {
    const machine = await bootMachine(getDialect('cpc464'), { ramKb: 64 });
    await runFrames(machine, 400);
    expect(await echo(machine, ['A'])).toBe('a');
    expect(await echo(machine, ['Shift', 'B'])).toBe('B');
    await tap(machine, ['CapsLock']);
    expect(await echo(machine, ['C'])).toBe('C');
    expect(await echo(machine, ['Shift', 'D'])).toBe('D');
  }, 120000);

  it('types lower case on the Spectrum, with CAPS SHIFT and CAPS LOCK reaching upper', async () => {
    const machine = await bootMachine(getDialect('zxspectrum'), { ramKb: 48 });
    await runFrames(machine, 400);
    // K mode types keywords, so open a string literal first: PRINT then the
    // quote, which is where a letter key becomes a letter.
    await tap(machine, ['KeyP']);
    await tap(machine, ['SymbolShift', 'KeyP']);
    expect(await echo(machine, ['KeyA'])).toBe('a');
    expect(await echo(machine, ['CapsShift', 'KeyB'])).toBe('B');
    // CAPS LOCK is CAPS SHIFT + 2 - a combination, not a keycap of its own.
    await tap(machine, ['CapsShift', 'Digit2']);
    expect(await echo(machine, ['KeyC'])).toBe('C');
  }, 120000);

  it('types upper case on the PMD 85, with SHIFT reaching lower', async () => {
    // The one machine here whose shift key goes the other way.
    const machine = await bootMachine(getDialect('pmd85'), { ramKb: 64 });
    await runFrames(machine, 400);
    expect(await echo(machine, ['KeyA'])).toBe('A');
    expect(await echo(machine, ['Shift', 'KeyB'])).toBe('b');
  }, 120000);

  it('switches the whole Commodore screen rather than a key', async () => {
    // Not a case pair and not a case lock over the keys: SHIFT + the Commodore
    // key selects the other character set, and every letter already on the
    // screen is redrawn in the other case.
    const machine = await bootMachine(getDialect('commodore64'), { ramKb: 64 });
    await runFrames(machine, 400);
    expect(screenText(machine)).toContain('READY');
    await tap(machine, ['LeftShift', 'Commodore']);
    await runFrames(machine, 10);
    expect(screenText(machine)).toContain('ready');
    expect(screenText(machine)).not.toContain('READY');
  }, 120000);

  it('boots the Atari caps-locked, with CAPS reaching lower and SHIFT+CAPS relocking', async () => {
    // The lock is one-way from either keycap: CAPS alone selects lower case,
    // and it is SHIFT+CAPS - not CAPS alone - that locks the capitals back on.
    const machine = await bootMachine(getDialect('atari800'));
    expect(
      await runUntil(machine, () => /Ready/i.test(screenText(machine))),
      'the machine never reached its prompt',
    ).toBe(true);
    expect(await echo(machine, ['A'])).toBe('A');
    await tap(machine, ['CapsLock']);
    expect(await echo(machine, ['B'])).toBe('b');
    expect(await echo(machine, ['Shift', 'C'])).toBe('C');
    await tap(machine, ['Shift', 'CapsLock']);
    expect(await echo(machine, ['D'])).toBe('D');
  }, 120000);
});

describe('every machine with a second case is covered', () => {
  /** Machines with lower case whose case keys are proved elsewhere, and by what. */
  const EXCUSED: Record<string, string> = {
    bbcmaster: 'reuses the bbcmicro layout and BASIC',
    cpc664: 'reuses the cpc464 layout',
    cpc6128: 'reuses the cpc464 layout',
    zxspectrum128: 'reuses the zxspectrum layout',
    vic20: 'reuses the commodore64 layout and the same set switch',
    pet: 'has no Commodore key: its set switch is a POKE, not a keypress',
    atari400: 'reuses the atari800 layout and BASIC',
  };

  it('boots here, or is excused by name', () => {
    const probed = [
      'bbcmicro',
      'cpc464',
      'zxspectrum',
      'pmd85',
      'commodore64',
      'atari800',
    ];
    const covered = new Set([...probed, ...Object.keys(EXCUSED)]);
    const withLowerCase = dialects
      .map((d) => d.id)
      .filter((id) => letterCaseFor(id)!.lowerCase !== 'none');
    expect(
      withLowerCase.filter((id) => !covered.has(id)),
      'a machine declared to have lower case must be probed here or excused',
    ).toEqual([]);
  });
});
