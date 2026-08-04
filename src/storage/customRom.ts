/**
 * User-supplied machine ROM images, one per dialect.
 *
 * **This module deliberately does not follow the best-effort convention the rest
 * of `src/storage/` uses.** Autosave and the settings accessors swallow quota
 * errors on purpose - losing one autosave tick costs the user a few seconds of
 * typing, and failing the write loudly would be worse than the loss. Installing
 * a ROM is the opposite trade: it is a deliberate, one-off act whose entire
 * point is that it persists, and an upload that silently didn't stick is
 * indistinguishable from a feature that doesn't work. So {@link saveCustomRom}
 * reports failure and the caller shows it.
 *
 * Kept out of `settings.ts` for that reason: a contract that contradicts the
 * documented house style of the file it sits in is an invitation to be
 * "corrected" later.
 *
 * Images are small (4K-32K, a machine's whole firmware) and are held as base64
 * under one key per dialect, mirroring the dialect-scoped controller bindings.
 */
import { bytesToBase64, base64ToBytes } from './vfs/base64';

const KEY_PREFIX = 'mbide.customRom.';

/** What the settings readout needs, without carrying the image itself around. */
export interface CustomRomMeta {
  /** The file's name as the user picked it, for the readout. */
  name: string;
  /** Payload size in bytes (pre-encoding). */
  size: number;
  /** Epoch ms the image was installed. */
  installedAt: number;
}

interface StoredRom extends CustomRomMeta {
  dataB64: string;
}

export type SaveRomResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unwritable'; message: string };

function keyFor(dialectId: string): string {
  return `${KEY_PREFIX}${dialectId}`;
}

/**
 * The stored record, or null when there is none or it can't be read. A
 * hand-edited or half-written entry reads as "no custom ROM" rather than
 * throwing: the cost of being wrong is booting the bundled image, and the
 * alternative is an unbootable machine the user can't get out of.
 */
function readStored(dialectId: string): StoredRom | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(keyFor(dialectId));
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Partial<StoredRom>;
    if (
      typeof rec.name !== 'string' ||
      typeof rec.dataB64 !== 'string' ||
      typeof rec.size !== 'number' ||
      !Number.isFinite(rec.size)
    ) {
      return null;
    }
    return {
      name: rec.name,
      size: rec.size,
      installedAt:
        typeof rec.installedAt === 'number' && Number.isFinite(rec.installedAt)
          ? rec.installedAt
          : 0,
      dataB64: rec.dataB64,
    };
  } catch {
    return null;
  }
}

/** Metadata for one machine's installed image, or null when it has none. */
export function getCustomRomMeta(dialectId: string): CustomRomMeta | null {
  const rec = readStored(dialectId);
  return (
    rec && { name: rec.name, size: rec.size, installedAt: rec.installedAt }
  );
}

/**
 * Metadata for every installed image, keyed by dialect id, for seeding the
 * store at boot. Only keys under this module's prefix are considered.
 */
export function listCustomRoms(): Record<string, CustomRomMeta> {
  const out: Record<string, CustomRomMeta> = {};
  const ids: string[] = [];
  try {
    // Enumerated through length/key rather than Object.keys: the latter returns
    // a Storage's own methods on the in-memory stand-in `safeStorage.ts`
    // installs (and on test stubs), not the stored keys.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) ids.push(k.slice(KEY_PREFIX.length));
    }
  } catch {
    return out;
  }
  for (const id of ids) {
    const meta = getCustomRomMeta(id);
    if (meta) out[id] = meta;
  }
  return out;
}

/**
 * The installed image for a machine, or null when it has none.
 *
 * `expectedBytes` is the size the machine requires now. A stored image that no
 * longer matches it is dropped and null returned, so a future change to a
 * machine's ROM size can't feed an incompatible image to a constructor that
 * would throw - the machine falls back to its bundled image instead.
 */
export function loadCustomRom(
  dialectId: string,
  expectedBytes: number,
): Uint8Array | null {
  const rec = readStored(dialectId);
  if (!rec) return null;
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(rec.dataB64);
  } catch {
    clearCustomRom(dialectId);
    return null;
  }
  if (bytes.length !== expectedBytes) {
    clearCustomRom(dialectId);
    return null;
  }
  return bytes;
}

/**
 * Persist a validated image. The caller has already checked the size against
 * the machine's; this only reports whether it was stored.
 *
 * The write is read back and its decoded length compared before reporting
 * success, which catches both a throwing quota error and a storage that accepts
 * a write and silently drops or truncates it. It cannot catch the in-memory
 * stand-in `safeStorage.ts` installs when the browser blocks site data - that
 * reads back perfectly and loses the image on reload - so the UI pairs this
 * with `localStorageIsPersistent()`.
 */
export function saveCustomRom(
  dialectId: string,
  name: string,
  bytes: Uint8Array,
): SaveRomResult {
  const record: StoredRom = {
    name,
    size: bytes.length,
    installedAt: Date.now(),
    dataB64: bytesToBase64(bytes),
  };
  try {
    localStorage.setItem(keyFor(dialectId), JSON.stringify(record));
  } catch (e) {
    // QuotaExceededError is the expected failure; anything else reaching here
    // (SecurityError from a storage the stand-in couldn't replace) is reported
    // as unwritable rather than guessed at.
    const quota = e instanceof DOMException && e.name.includes('Quota');
    return quota
      ? {
          ok: false,
          reason: 'quota',
          message:
            "Couldn't save the ROM: this browser's storage is full. Free some space and try again.",
        }
      : {
          ok: false,
          reason: 'unwritable',
          message:
            "Couldn't save the ROM: this browser isn't allowing site data to be stored.",
        };
  }
  const readBack = loadCustomRom(dialectId, bytes.length);
  if (!readBack) {
    clearCustomRom(dialectId);
    return {
      ok: false,
      reason: 'unwritable',
      message: "Couldn't save the ROM: this browser did not keep it.",
    };
  }
  return { ok: true };
}

/** Remove a machine's installed image, so it runs its bundled one again. */
export function clearCustomRom(dialectId: string): void {
  try {
    localStorage.removeItem(keyFor(dialectId));
  } catch {
    // Nothing more to do: the caller's next read will report what is actually
    // there, and an unremovable key can't be worked around from here.
  }
}
