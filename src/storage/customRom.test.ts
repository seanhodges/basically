import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCustomRomMeta,
  listCustomRoms,
  loadCustomRom,
  saveCustomRom,
  clearCustomRom,
} from './customRom';
import { bytesToBase64 } from './vfs/base64';

/** Minimal in-memory Storage for the node test environment. */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const KEY = 'mbide.customRom.zx81';

function image(size: number, fill = 0x7f): Uint8Array {
  return new Uint8Array(size).fill(fill);
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
});

describe('saveCustomRom / loadCustomRom', () => {
  it('round-trips an image and its metadata', () => {
    const rom = image(8192, 0x2a);
    expect(saveCustomRom('zx81', 'myrom.rom', rom)).toEqual({ ok: true });

    expect(loadCustomRom('zx81')).toEqual(rom);
    expect(getCustomRomMeta('zx81')).toMatchObject({
      name: 'myrom.rom',
      size: 8192,
    });
  });

  it('reports no image for a machine that has none', () => {
    expect(loadCustomRom('zx81')).toBeNull();
    expect(getCustomRomMeta('zx81')).toBeNull();
  });

  it('keeps each machine independent', () => {
    saveCustomRom('zx81', 'a.rom', image(8192, 1));
    saveCustomRom('zx80', 'b.rom', image(4096, 2));

    expect(loadCustomRom('zx81')?.[0]).toBe(1);
    expect(loadCustomRom('zx80')?.[0]).toBe(2);

    clearCustomRom('zx81');
    expect(loadCustomRom('zx81')).toBeNull();
    expect(loadCustomRom('zx80')).not.toBeNull();
  });
});

describe('loadCustomRom keeps whatever the user installed', () => {
  // Size is not this module's business: an image that doesn't fill the
  // machine's ROM area is fitted to it when the machine is built (see
  // app/romImage.fitRomImage), so a stored image is never dropped for its
  // length - including after a machine's ROM size changes in a future release.
  it('returns an image of any size, unaltered', () => {
    const short = image(100, 0x11);
    saveCustomRom('zx81', 'short.rom', short);
    expect(loadCustomRom('zx81')).toEqual(short);
    expect(getCustomRomMeta('zx81')).toMatchObject({ size: 100 });

    const long = image(20000, 0x22);
    saveCustomRom('zx81', 'long.rom', long);
    expect(loadCustomRom('zx81')).toEqual(long);
  });
});

describe('loadCustomRom rejects what it cannot use', () => {
  it('reads corrupt JSON as "no image" rather than throwing', () => {
    localStorage.setItem(KEY, '{not json');
    expect(() => loadCustomRom('zx81')).not.toThrow();
    expect(loadCustomRom('zx81')).toBeNull();
    expect(getCustomRomMeta('zx81')).toBeNull();
  });

  it('reads a record missing its fields as "no image"', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'x.rom' }));
    expect(loadCustomRom('zx81')).toBeNull();
  });

  it('reads corrupt base64 as "no image" rather than throwing', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        name: 'x.rom',
        size: 8192,
        installedAt: 0,
        dataB64: 'not base64 !!!',
      }),
    );
    expect(() => loadCustomRom('zx81')).not.toThrow();
    expect(loadCustomRom('zx81')).toBeNull();
  });

  // Not a check against the machine's ROM size - a record that contradicts
  // itself is what a half-written or truncated entry looks like, and the
  // readout quotes the declared size, so keeping it would misdescribe what the
  // machine is actually running.
  it('drops an image whose declared size disagrees with its bytes', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        name: 'lying.rom',
        size: 8192,
        installedAt: 0,
        dataB64: bytesToBase64(image(16)),
      }),
    );
    expect(loadCustomRom('zx81')).toBeNull();
  });
});

describe('listCustomRoms', () => {
  it('returns metadata for every installed image, keyed by dialect', () => {
    saveCustomRom('zx81', 'a.rom', image(8192));
    saveCustomRom('cpc464', 'b.rom', image(32768));

    const all = listCustomRoms();
    expect(Object.keys(all).sort()).toEqual(['cpc464', 'zx81']);
    expect(all.zx81).toMatchObject({ name: 'a.rom', size: 8192 });
    expect(all.cpc464).toMatchObject({ name: 'b.rom', size: 32768 });
  });

  it('ignores keys belonging to anything else in storage', () => {
    localStorage.setItem('mbide.crtEffect', 'true');
    localStorage.setItem('mbide.autosave.doc', '10 PRINT');
    saveCustomRom('zx81', 'a.rom', image(8192));

    expect(Object.keys(listCustomRoms())).toEqual(['zx81']);
  });

  it('is empty when nothing is installed', () => {
    expect(listCustomRoms()).toEqual({});
  });
});

// The whole reason this module exists rather than living in settings.ts: an
// upload that silently didn't persist is indistinguishable from a broken
// feature, so a failed write must come back as a failure.
describe('saveCustomRom reports failures instead of swallowing them', () => {
  it('reports a quota error', () => {
    const real = localStorage;
    (globalThis as { localStorage?: Storage }).localStorage = {
      ...real,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    } as Storage;

    const result = saveCustomRom('zx81', 'a.rom', image(8192));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('quota');
    expect(result.ok === false && result.message).toMatch(/storage is full/);
  });

  it('reports any other write failure as unwritable', () => {
    (globalThis as { localStorage?: Storage }).localStorage = {
      ...localStorage,
      setItem: () => {
        throw new DOMException('nope', 'SecurityError');
      },
    } as Storage;

    const result = saveCustomRom('zx81', 'a.rom', image(8192));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('unwritable');
  });

  // A storage that accepts a write and drops it throws nothing at all, so only
  // reading the key back can catch it.
  it('catches a write that was silently dropped', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: () => {
        /* accepts everything, keeps nothing */
      },
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;

    const result = saveCustomRom('zx81', 'a.rom', image(8192));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/did not keep it/);
  });

  it('catches a write that was silently truncated', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v.slice(0, 200)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;

    expect(saveCustomRom('zx81', 'a.rom', image(8192)).ok).toBe(false);
  });
});
