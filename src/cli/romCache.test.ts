// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where obtained ROMs are kept, and what the cache will and will not vouch for.
 *
 * The keeping-current half is `romRefresh.test.ts`; this file is about the
 * directory itself: where it lands on each platform, when it is complete enough
 * to be offered as a ROM root, and what happens to an image that is not what the
 * publisher says it is.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cachedRomRoot,
  clearRomCache,
  fetchRomSet,
  missingFromCache,
  readCachedManifest,
  romCacheHome,
} from './romCache';

const IMAGE = Buffer.from('zx81 rom bytes');
const DIGEST = createHash('sha256').update(IMAGE).digest('hex');
const MANIFEST = {
  version: 'aaaabbbbcccc',
  attribution: 'ATTRIBUTION.md',
  archive: 'roms.zip',
  roms: [{ path: 'zx81/zx81.rom', bytes: IMAGE.length, sha256: DIGEST }],
};

let home: string;

beforeEach(() => {
  home = path.join(
    os.tmpdir(),
    `basically-romcache-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
});

afterEach(() => {
  clearRomCache(home);
  vi.unstubAllGlobals();
});

/** Put a manifest and its images in place without going near the network. */
function seed(manifest = MANIFEST, image: Buffer = IMAGE): void {
  const dir = path.join(home, 'roms');
  mkdirSync(path.join(dir, 'zx81'), { recursive: true });
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify(manifest));
  writeFileSync(path.join(dir, 'zx81', 'zx81.rom'), image);
}

/** A publisher that serves the manifest and one image, and counts requests. */
function publisher(image: Buffer = IMAGE) {
  return vi.fn(async (url: string) => {
    if (String(url).endsWith('index.json')) {
      return new Response(JSON.stringify(MANIFEST), {
        status: 200,
        headers: { etag: '"v1"' },
      });
    }
    if (String(url).endsWith('ATTRIBUTION.md')) {
      return new Response('the notice', { status: 200 });
    }
    return new Response(image, { status: 200 });
  });
}

describe('where obtained ROMs are kept', () => {
  it('takes BASICALLY_HOME over anything the platform would choose', () => {
    const named = path.join(os.tmpdir(), 'somewhere-else');
    expect(
      romCacheHome({ BASICALLY_HOME: named, LOCALAPPDATA: 'C:\\App' }, 'win32'),
    ).toBe(path.resolve(named));
  });

  it('lands in the platform cache location otherwise', () => {
    expect(romCacheHome({ LOCALAPPDATA: 'C:\\App' }, 'win32')).toBe(
      path.join('C:\\App', 'basically'),
    );
    expect(romCacheHome({ XDG_CACHE_HOME: '/x/cache' }, 'linux')).toBe(
      path.join('/x/cache', 'basically'),
    );
    expect(romCacheHome({}, 'linux')).toBe(
      path.join(os.homedir(), '.cache', 'basically'),
    );
  });

  it('never reads LOCALAPPDATA off Windows', () => {
    // It is set in a Git Bash shell on Windows and meaningless elsewhere; a
    // POSIX box that happens to carry it must still use its own convention.
    expect(romCacheHome({ LOCALAPPDATA: 'C:\\App' }, 'linux')).toBe(
      path.join(os.homedir(), '.cache', 'basically'),
    );
  });
});

describe('what the cache vouches for', () => {
  it('offers itself as a ROM root once it holds the whole set', () => {
    expect(cachedRomRoot(home)).toBeNull();
    seed();
    expect(cachedRomRoot(home)).toBe(home);
  });

  it('offers nothing while the set is incomplete', () => {
    // Half a set offered as a root would shadow an installation carrying all
    // of it, so an image short of what the manifest lists is no root at all.
    seed();
    clearRomCache(home);
    mkdirSync(path.join(home, 'roms'), { recursive: true });
    writeFileSync(
      path.join(home, 'roms', 'index.json'),
      JSON.stringify(MANIFEST),
    );
    expect(cachedRomRoot(home)).toBeNull();
  });

  it('offers nothing when an image is the wrong length', () => {
    seed(MANIFEST, Buffer.concat([IMAGE, Buffer.from('extra')]));
    expect(cachedRomRoot(home)).toBeNull();
  });

  it('reports which wanted images it does not hold', () => {
    seed();
    expect(missingFromCache(['zx81/zx81.rom', 'pet/kernal.bin'], home)).toEqual(
      ['pet/kernal.bin'],
    );
  });

  it('treats an unreadable manifest as no cache rather than a bad one', () => {
    mkdirSync(path.join(home, 'roms'), { recursive: true });
    writeFileSync(path.join(home, 'roms', 'index.json'), 'not json');
    expect(readCachedManifest(home)).toBeNull();
    expect(cachedRomRoot(home)).toBeNull();
  });
});

describe('obtaining images', () => {
  it('verifies each digest and keeps what matches', async () => {
    vi.stubGlobal('fetch', publisher());
    const outcome = await fetchRomSet({
      home,
      base: 'https://roms.test/roms/',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.obtained).toEqual(['zx81/zx81.rom']);
    expect(cachedRomRoot(home)).toBe(home);
    expect(existsSync(path.join(home, 'roms', 'ATTRIBUTION.md'))).toBe(true);
  });

  it('refuses an image that is not what the publisher describes', async () => {
    // A length check cannot tell a real image from a plausibly-sized error
    // page, which is the whole reason the manifest carries digests.
    vi.stubGlobal('fetch', publisher(Buffer.from('zx81 rom bytez')));
    const outcome = await fetchRomSet({
      home,
      base: 'https://roms.test/roms/',
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain('zx81/zx81.rom');
    expect(existsSync(path.join(home, 'roms', 'zx81', 'zx81.rom'))).toBe(false);
  });

  it('leaves no partial file behind when a download fails midway', async () => {
    // The set is read back by length, so a truncated file that happened to be
    // the right size would boot a machine on nonsense. Fail on the second
    // image, so the first is really on disk when the failure lands.
    const second = Buffer.from('pet kernal bytes');
    const twoImages = {
      ...MANIFEST,
      roms: [
        ...MANIFEST.roms,
        {
          path: 'pet/kernal.bin',
          bytes: second.length,
          sha256: createHash('sha256').update(second).digest('hex'),
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const at = String(url);
        if (at.endsWith('index.json')) {
          return new Response(JSON.stringify(twoImages), { status: 200 });
        }
        if (at.endsWith('zx81.rom'))
          return new Response(IMAGE, { status: 200 });
        throw new Error('connection reset');
      }),
    );
    const outcome = await fetchRomSet({
      home,
      base: 'https://roms.test/roms/',
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.obtained).toEqual(['zx81/zx81.rom']);
    expect(readdirSync(path.join(home, 'roms', 'zx81'))).toEqual(['zx81.rom']);
    const petDir = path.join(home, 'roms', 'pet');
    expect(
      existsSync(petDir) ? readdirSync(petDir) : [],
      'a .part file was left in the cache',
    ).toEqual([]);
  });

  it('refuses a manifest entry that would write outside the cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              version: 'x',
              roms: [{ path: '../escaped.rom', bytes: 1, sha256: 'aa' }],
            }),
            { status: 200 },
          ),
      ),
    );
    const outcome = await fetchRomSet({
      home,
      base: 'https://roms.test/roms/',
    });
    expect(outcome.ok).toBe(false);
    expect(existsSync(path.join(path.dirname(home), 'escaped.rom'))).toBe(
      false,
    );
  });

  it('discards everything it obtained when asked to clear', async () => {
    vi.stubGlobal('fetch', publisher());
    await fetchRomSet({ home, base: 'https://roms.test/roms/' });
    clearRomCache(home);
    expect(cachedRomRoot(home)).toBeNull();
    expect(existsSync(path.join(home, 'roms'))).toBe(false);
  });
});
