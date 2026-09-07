// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * That an obtained ROM set is found by everything that looks for one.
 *
 * `findRomRoot()` is the single edit the obtained set arrives through, and its
 * value is entirely in how many callers it reaches: the headless runner, the
 * session that holds a machine between commands, and the ROM probe the command
 * line answers `machines` and `info` from. Three copies of this lookup would be
 * three chances for one of them to disagree about whether a machine can run, so
 * this file boots none of them and instead pins that they all read the same
 * function.
 *
 * It also pins the order, which is a decision rather than an accident: a
 * complete obtained set is preferred to the installation's own images because
 * it is the one that was verified against a published manifest and is kept
 * current, while an *incomplete* one comes last, so a set briefly short of a
 * machine added upstream cannot shadow a checkout that has it.
 */

import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findRomRoot } from '../dialects/headless/romRoot';
import { hasRom } from '../dialects/bootHarness';
import { getDialect } from '../dialects/registry';
import { locateRoms } from './roms';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(path.resolve(here, file), 'utf8');

beforeEach(() => {
  // Point the download cache at somewhere empty. Without this the suite would
  // read whatever the developer running it happens to have downloaded, which
  // is the same bytes but not the same answer to "where did that come from".
  vi.stubEnv(
    'BASICALLY_HOME',
    path.join(os.tmpdir(), `basically-no-downloads-${process.pid}`),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('finding an obtained ROM set', () => {
  it('finds this checkout when there is nothing obtained', () => {
    // The test run is a checkout with public/roms committed, so this is the
    // installed-images branch, and it must keep answering as it always has.
    const root = findRomRoot();
    expect(root).not.toBeNull();
    expect(path.basename(root!)).toBe('public');
  });

  it("does not leave one call's root behind for the next", () => {
    // The ROM root is a global in the boot harness and a host serves many
    // calls, so a call that named a directory must not have every later call
    // read it. Only visible where the search would otherwise fail: while it
    // succeeds, the next call overwrites the leak on its way past.
    const zx81 = getDialect('zx81')!;
    locateRoms('/nowhere');
    expect(hasRom(zx81), 'a named root was not honoured').toBe(false);
    locateRoms(undefined);
    expect(hasRom(zx81), 'the named root outlived the call that named it').toBe(
      true,
    );
  });

  it('is the one lookup the runner, the session and the probe all use', () => {
    // Not a behavioural test - a structural one. The point of putting the
    // obtained set inside findRomRoot() was that these three did not each grow
    // their own way of finding ROMs; a fourth spelling here would silently
    // leave one caller unable to see what the others can.
    const callers = {
      'the headless runner': read('../dialects/headless/runListing.ts'),
      'the held-machine session': read('../mcp/session.ts'),
      "the command line's ROM probe": read('./roms.ts'),
    };
    for (const [who, source] of Object.entries(callers)) {
      expect(
        source,
        `${who} no longer resolves its ROM root the shared way`,
      ).toMatch(/findRomRoot\(\)/);
    }
  });

  it('consults the obtained set before walking up, and again after', () => {
    const source = read('../dialects/headless/romRoot.ts');
    const complete = source.indexOf('cachedRomRoot()');
    const walk = source.indexOf("path.join(dir, 'public')");
    const partial = source.indexOf('heldRomRoot()');

    expect(
      complete,
      'a complete obtained set is no longer consulted',
    ).toBeGreaterThan(-1);
    expect(
      partial,
      'an incomplete obtained set is no longer a fallback',
    ).toBeGreaterThan(-1);
    expect(
      complete,
      'a complete obtained set must be preferred to the installed images',
    ).toBeLessThan(walk);
    expect(
      partial,
      'an incomplete obtained set must not shadow the installed images',
    ).toBeGreaterThan(walk);
  });

  it('never downloads or asks anything while looking', () => {
    // Discovery and acquisition are separate on purpose: `machines` must be
    // able to report what is here without touching the network, and the host
    // process this runs in has no terminal to put a question on.
    const source = read('../dialects/headless/romRoot.ts');
    expect(source).not.toMatch(/\bfetchRomSet\b/);
    expect(source).not.toMatch(/\bconsentToFetch\b|\baskForConsent\b/);
  });
});
