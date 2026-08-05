// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  machineIsRunnable,
  probeBundledRoms,
  runnableMachines,
} from './machineAvailability';
import { dialects, getDialect } from '../dialects/registry';
import type { Dialect } from '../dialects/types';
import type { CustomRomMeta } from '../storage/customRom';

const rom = (size: number): CustomRomMeta => ({
  name: 'mine.rom',
  size,
  installedAt: 0,
});

/** No user ROMs, and the probe has not landed. */
const unprobed = { customRoms: {}, bundled: null };

const zx81 = getDialect('zx81'); // ships its ROM, and runs it
const c64 = getDialect('commodore64'); // fetches its own ROM set
const altair = getDialect('altair8800'); // ships nothing at all

describe('machineIsRunnable', () => {
  it('always offers a machine that loads its own ROM set', () => {
    // The Acorn and Commodore emulators ignore `opts.rom` entirely, so there is
    // no image whose absence could stop them - they declare no `romBytes`.
    expect(c64.romBytes).toBeUndefined();
    expect(machineIsRunnable(c64, unprobed)).toBe(true);
    expect(machineIsRunnable(c64, { customRoms: {}, bundled: new Set() })).toBe(
      true,
    );
  });

  it('offers a bundled-ROM machine before the probe lands', () => {
    // It says an image ships; believing it is what stops the picker flickering
    // machines away on every load.
    expect(machineIsRunnable(zx81, unprobed)).toBe(true);
  });

  it('withholds a machine whose bundled image turns out to be missing', () => {
    // A self-hoster may delete any ROM without a redistribution grant - see
    // public/roms/ATTRIBUTION.md - and the machine then cannot start.
    expect(
      machineIsRunnable(zx81, { customRoms: {}, bundled: new Set() }),
    ).toBe(false);
    expect(
      machineIsRunnable(zx81, { customRoms: {}, bundled: new Set(['zx81']) }),
    ).toBe(true);
  });

  it('withholds a machine that ships no image, without waiting to be told', () => {
    // `romBundled: false` is itself the evidence: nothing is at that URL in a
    // stock build, so there is nothing to wait for.
    expect(altair.romBundled).toBe(false);
    expect(machineIsRunnable(altair, unprobed)).toBe(false);
  });

  it('offers it once the user installs an image', () => {
    const customRoms = { altair8800: rom(altair.romBytes!) };
    expect(machineIsRunnable(altair, { customRoms, bundled: null })).toBe(true);
    // …and still offers it when the probe confirms nothing is bundled.
    expect(machineIsRunnable(altair, { customRoms, bundled: new Set() })).toBe(
      true,
    );
  });

  it('offers it for an installed image of any size', () => {
    // Size is no longer a condition of installing an image: one that doesn't
    // fill the machine's ROM area is padded to it, so the machine has something
    // to boot either way and hiding it would hide a machine that can start.
    const customRoms = { altair8800: rom(1024) };
    expect(machineIsRunnable(altair, { customRoms, bundled: null })).toBe(true);
  });

  it('offers a self-hosted drop-in the probe finds', () => {
    // The documented way to run the Altair without uploading anything: put the
    // image at public/roms/altair8800.rom and rebuild.
    expect(
      machineIsRunnable(altair, {
        customRoms: {},
        bundled: new Set(['altair8800']),
      }),
    ).toBe(true);
  });
});

describe('runnableMachines', () => {
  it('hides nothing that ships its own ROM', () => {
    const offered = runnableMachines(dialects, unprobed).map((d) => d.id);
    expect(offered).not.toContain('altair8800');
    expect(offered).toContain('zx81');
    expect(offered).toContain('commodore64');
    // …and keeps the registry's order, which the picker's grouping relies on.
    expect(offered).toEqual(
      dialects.map((d) => d.id).filter((id) => id !== 'altair8800'),
    );
  });

  it('keeps the machine the document is already on', () => {
    // Reached by a share link or a saved project. Hiding it would leave the
    // picker with nothing selected and the trigger naming a machine not in the
    // list; the emulator pane is where the missing ROM gets explained.
    const offered = runnableMachines(dialects, unprobed, 'altair8800');
    expect(offered.map((d) => d.id)).toContain('altair8800');
  });

  it('does not duplicate the kept machine when it is runnable anyway', () => {
    const offered = runnableMachines(dialects, unprobed, 'zx81').map(
      (d) => d.id,
    );
    expect(offered.filter((id) => id === 'zx81')).toHaveLength(1);
  });
});

describe('probeBundledRoms', () => {
  it('reports which images are really there, and never rejects', async () => {
    // One present, one absent, one that answers 200 with the wrong bytes - the
    // SPA fallback a static host serves for an unknown path, which is why the
    // probe checks the size rather than the status.
    const bodies: Record<string, Uint8Array | number> = {
      good: new Uint8Array(8192),
      missing: 404,
      html: new TextEncoder().encode('<!doctype html>'),
    };
    const fakes = [
      { id: 'good', romBytes: 8192, romUrl: 'good' },
      { id: 'missing', romBytes: 8192, romUrl: 'missing' },
      { id: 'html', romBytes: 8192, romUrl: 'html' },
      { id: 'own-roms', romUrl: 'never-fetched' },
    ] as unknown as Dialect[];

    const original = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      const body = bodies[url];
      if (typeof body === 'number') {
        return Promise.resolve({ ok: false, status: body } as Response);
      }
      if (body === undefined) throw new Error(`unexpected fetch: ${url}`);
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(body.buffer),
      } as unknown as Response);
    }) as typeof fetch;
    try {
      const found = await probeBundledRoms(fakes);
      expect([...found!].sort()).toEqual(['good']);
    } finally {
      globalThis.fetch = original;
    }
  });
});
