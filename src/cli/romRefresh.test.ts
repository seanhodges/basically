// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Keeping an obtained ROM set current.
 *
 * Two promises are being checked here, and the second matters more than the
 * first. One: a machine added after the user agreed brings its ROM with it, and
 * an image the publisher withdraws stops being kept - otherwise a takedown
 * stops at the bucket and every installation keeps its copy for good. Two:
 * none of that can fail a command. A run that would have worked offline still
 * works offline, and a publisher that is down, slow or wrong is silent rather
 * than fatal.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REFRESH_INTERVAL_MS,
  RETRY_AFTER_FAILURE_MS,
  cachedRomRoot,
  clearRomCache,
  fetchRomSet,
  noteChecked,
  readCacheState,
  refreshDue,
} from './romCache';

const ZX81 = Buffer.from('zx81 rom bytes');
const PET = Buffer.from('pet kernal bytes');

const digest = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

const entry = (tail: string, bytes: Buffer) => ({
  path: tail,
  bytes: bytes.length,
  sha256: digest(bytes),
});

const ONE_MACHINE = {
  version: 'v1',
  attribution: 'ATTRIBUTION.md',
  roms: [entry('zx81/zx81.rom', ZX81)],
};
const TWO_MACHINES = {
  version: 'v2',
  attribution: 'ATTRIBUTION.md',
  roms: [entry('zx81/zx81.rom', ZX81), entry('pet/kernal.bin', PET)],
};
const WITHDRAWN = {
  version: 'v3',
  attribution: 'ATTRIBUTION.md',
  roms: [entry('pet/kernal.bin', PET)],
};

const BASE = 'https://roms.test/roms/';
const IMAGES: Record<string, Buffer> = {
  'zx81/zx81.rom': ZX81,
  'pet/kernal.bin': PET,
};

let home: string;

beforeEach(() => {
  home = path.join(
    os.tmpdir(),
    `basically-romrefresh-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
});

afterEach(() => {
  clearRomCache(home);
  vi.unstubAllGlobals();
});

/**
 * A publisher serving `manifest`, answering 304 when the caller's tag matches
 * `etag`. Every call is recorded so a test can say what the refresh cost.
 */
function publisher(manifest: unknown, etag = '"tag"') {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const at = String(url);
    if (at.endsWith('index.json')) {
      const sent = (init?.headers as Record<string, string> | undefined)?.[
        'if-none-match'
      ];
      if (sent === etag) return new Response(null, { status: 304 });
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { etag },
      });
    }
    if (at.endsWith('ATTRIBUTION.md')) {
      return new Response('the notice', { status: 200 });
    }
    const tail = at.slice(BASE.length);
    const bytes = IMAGES[tail];
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(bytes, { status: 200 });
  });
}

/** Obtain a set for real, so the tests below start from a populated cache. */
async function obtain(manifest: unknown = ONE_MACHINE, etag = '"tag"') {
  const serve = publisher(manifest, etag);
  vi.stubGlobal('fetch', serve);
  const outcome = await fetchRomSet({ home, base: BASE });
  expect(outcome.ok, outcome.reason).toBe(true);
  return serve;
}

describe('when the publisher is asked', () => {
  it('is not asked again inside the interval', async () => {
    await obtain();
    expect(refreshDue({ home, env: {} })).toBe(false);
  });

  it('is asked again once the interval has run out', async () => {
    await obtain();
    const state = readCacheState(home)!;
    expect(
      refreshDue({ home, env: {}, now: state.checkedAt + REFRESH_INTERVAL_MS }),
    ).toBe(true);
  });

  it('is not asked at all when the periodic check is turned off', async () => {
    await obtain();
    const state = readCacheState(home)!;
    for (const setting of ['off', 'never', 'no', 'false', '0']) {
      expect(
        refreshDue({
          home,
          env: { BASICALLY_ROM_REFRESH: setting },
          now: state.checkedAt + REFRESH_INTERVAL_MS * 10,
        }),
        setting,
      ).toBe(false);
    }
  });

  it('is asked when nothing has been obtained yet', () => {
    expect(refreshDue({ home, env: {} })).toBe(true);
  });

  it('leaves a publisher that just failed alone, however overdue', async () => {
    // Offline, retrying on the next command means a timeout on every
    // invocation - which is the command being failed by the check, in all but
    // name.
    await obtain();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND roms.test');
      }),
    );
    const overdue = readCacheState(home)!.checkedAt + REFRESH_INTERVAL_MS * 5;
    await fetchRomSet({ home, base: BASE, now: overdue });

    expect(refreshDue({ home, env: {}, now: overdue })).toBe(false);
    expect(
      refreshDue({ home, env: {}, now: overdue + RETRY_AFTER_FAILURE_MS }),
    ).toBe(true);
  });
});

describe('what a check does', () => {
  it('costs one request and touches nothing when nothing has changed', async () => {
    await obtain();
    const before = readFileSync(path.join(home, 'roms', 'zx81', 'zx81.rom'));

    const serve = publisher(ONE_MACHINE);
    vi.stubGlobal('fetch', serve);
    const outcome = await fetchRomSet({ home, base: BASE });

    expect(outcome.ok).toBe(true);
    expect(outcome.unchanged).toBe(true);
    expect(outcome.obtained).toEqual([]);
    expect(serve).toHaveBeenCalledTimes(1);
    expect(readFileSync(path.join(home, 'roms', 'zx81', 'zx81.rom'))).toEqual(
      before,
    );
  });

  it('picks up a machine added upstream at the next check', async () => {
    // The trigger is the interval, not the registry: the process this runs in
    // deliberately does not know which machines exist, so "a new machine needs
    // its ROM now" is not a question it can ask. The next check gets it, and
    // `roms fetch` gets it at once for a user who noticed first.
    await obtain();
    vi.stubGlobal('fetch', publisher(TWO_MACHINES, '"tag2"'));
    const outcome = await fetchRomSet({ home, base: BASE });
    expect(outcome.obtained).toEqual(['pet/kernal.bin']);
  });

  it('pulls only what the new version added', async () => {
    await obtain();
    const serve = publisher(TWO_MACHINES, '"tag2"');
    vi.stubGlobal('fetch', serve);
    const outcome = await fetchRomSet({ home, base: BASE });

    expect(outcome.obtained).toEqual(['pet/kernal.bin']);
    expect(outcome.version).toBe('v2');
    expect(cachedRomRoot(home)).toBe(home);
  });

  it('drops an image the publisher no longer lists', async () => {
    // The publisher's deployment prunes, so an unlisted image has been
    // withdrawn. A cache that kept its copy would strand the takedown.
    await obtain(TWO_MACHINES);
    expect(existsSync(path.join(home, 'roms', 'zx81', 'zx81.rom'))).toBe(true);

    vi.stubGlobal('fetch', publisher(WITHDRAWN, '"tag3"'));
    const outcome = await fetchRomSet({ home, base: BASE });

    expect(outcome.removed).toEqual(['zx81/zx81.rom']);
    expect(existsSync(path.join(home, 'roms', 'zx81'))).toBe(false);
    expect(existsSync(path.join(home, 'roms', 'pet', 'kernal.bin'))).toBe(true);
  });

  it('asks whether or not one was due when told to', async () => {
    await obtain();
    const serve = publisher(TWO_MACHINES, '"tag2"');
    vi.stubGlobal('fetch', serve);
    await fetchRomSet({ home, base: BASE, force: true });
    expect(serve).toHaveBeenCalled();
    expect(cachedRomRoot(home)).toBe(home);
  });
});

describe('a check that goes wrong changes nothing', () => {
  /** Every way the publisher can let us down, and what it looks like. */
  const failures: Record<string, () => unknown> = {
    offline: () => {
      throw new Error('getaddrinfo ENOTFOUND roms.test');
    },
    'a 500': () => new Response(null, { status: 500 }),
    'a timeout': () => {
      throw Object.assign(new Error('signal timed out'), {
        name: 'TimeoutError',
      });
    },
    'nonsense in place of a manifest': () =>
      new Response('<html>nope</html>', { status: 200 }),
  };

  for (const [what, answer] of Object.entries(failures)) {
    it(`carries on with what is held: ${what}`, async () => {
      await obtain();
      const before = readFileSync(path.join(home, 'roms', 'zx81', 'zx81.rom'));
      const state = readCacheState(home);

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => answer()),
      );
      const outcome = await fetchRomSet({ home, base: BASE });

      expect(outcome.ok, what).toBe(false);
      expect(outcome.reason, what).toBeTruthy();
      expect(outcome.removed, what).toEqual([]);
      expect(cachedRomRoot(home), what).toBe(home);
      expect(readFileSync(path.join(home, 'roms', 'zx81', 'zx81.rom'))).toEqual(
        before,
      );
      // What was confirmed is still what was confirmed: only the attempt moved.
      const after = readCacheState(home)!;
      expect(after.checkedAt, what).toBe(state!.checkedAt);
      expect(after.version, what).toBe(state!.version);
      expect(after.etag, what).toBe(state!.etag);
      expect(after.attemptedAt, what).toBeGreaterThanOrEqual(state!.checkedAt);
    });
  }

  it('keeps a bad digest out without disturbing what is already held', async () => {
    await obtain();
    const corrupt = {
      version: 'v9',
      attribution: 'ATTRIBUTION.md',
      roms: [
        entry('zx81/zx81.rom', ZX81),
        { path: 'pet/kernal.bin', bytes: PET.length, sha256: 'a'.repeat(64) },
      ],
    };
    vi.stubGlobal('fetch', publisher(corrupt, '"tag9"'));
    const outcome = await fetchRomSet({ home, base: BASE });

    expect(outcome.ok).toBe(false);
    expect(existsSync(path.join(home, 'roms', 'pet', 'kernal.bin'))).toBe(
      false,
    );
    expect(existsSync(path.join(home, 'roms', 'zx81', 'zx81.rom'))).toBe(true);
  });

  it('recovers when the state names a tag but the manifest is gone', async () => {
    // A cleared roms/ with a stale state file would otherwise have us send a
    // tag, be told 304, and have no manifest to apply it to.
    await obtain();
    const state = readCacheState(home)!;
    clearRomCache(home);
    noteChecked(state, home);

    vi.stubGlobal('fetch', publisher(ONE_MACHINE));
    const outcome = await fetchRomSet({ home, base: BASE });

    expect(outcome.ok, outcome.reason).toBe(true);
    expect(cachedRomRoot(home)).toBe(home);
  });
});

describe('a cache that is only half there', () => {
  it('refills a deleted image on the next check', async () => {
    await obtain();
    const image = path.join(home, 'roms', 'zx81', 'zx81.rom');
    mkdirSync(path.dirname(image), { recursive: true });
    writeFileSync(image, Buffer.alloc(0));

    vi.stubGlobal('fetch', publisher(ONE_MACHINE, '"other"'));
    const outcome = await fetchRomSet({ home, base: BASE });

    expect(outcome.obtained).toEqual(['zx81/zx81.rom']);
    expect(readFileSync(image)).toEqual(ZX81);
  });
});
