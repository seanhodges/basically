// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The ROM images the command line obtained for itself, and keeping them
 * current.
 *
 * An installation that carries no `public/roms/` can still run a machine: the
 * images are published read-only alongside the share API, and what is obtained
 * is written here in exactly the `public/` shape, so the cache directory *is*
 * something {@link ../dialects/bootHarness.configureRomRoot} takes. Nothing
 * downstream learns a second way to find a ROM.
 *
 * ```
 * <home>/roms/index.json          the manifest that was verified against
 * <home>/roms/ATTRIBUTION.md      the notice the images travel on
 * <home>/roms/zx81/zx81.rom       an image, at the same tail as public/roms/
 * <home>/roms-state.json          the ETag, the version, and when last checked
 * ```
 *
 * This module runs in the command line's own process and nowhere else. The host
 * that boots machines has no terminal and does no fetching; it is handed a root
 * and reads it. See `openspec/changes/.../design.md` for why that split is load
 * bearing, and `docs/contributing/architecture.md` for the ROM picture around
 * it.
 *
 * The published digests are the point of the manifest. A length check cannot
 * tell a real image from a plausibly-sized error page, and this side has
 * `node:crypto`, so every obtained image is checked against its `sha256` before
 * it is kept.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { romsBaseUrl } from '../dialects/romRef';

/** One image, as the publisher's manifest lists it. */
export interface RomManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
}

/** The published manifest. Unknown fields are kept: the publisher may add some. */
export interface RomManifest {
  version: string;
  attribution?: string;
  archive?: string;
  roms: RomManifestEntry[];
}

/** What the last check learned, so the next one can be conditional and rare. */
export interface RomCacheState {
  etag?: string;
  version?: string;
  /** When the publisher last answered. Only a successful check moves this. */
  checkedAt: number;
  /**
   * When the publisher was last asked and did not answer usefully.
   *
   * Separate from {@link checkedAt} so a failure neither pretends the set was
   * confirmed nor lets every later command retry at once: offline, a run that
   * would have worked would otherwise pay a timeout each time it was invoked.
   */
  attemptedAt?: number;
}

/** What a fetch did, for the caller that asked about ROMs to report. */
export interface FetchOutcome {
  /** Whether the publisher was reached and understood. */
  ok: boolean;
  /** Why not, in one phrase, when it was not. */
  reason?: string;
  /** The manifest version now held, where one is. */
  version?: string;
  /** Whether the publisher answered that nothing had changed. */
  unchanged: boolean;
  /** Tails obtained this time. */
  obtained: string[];
  /** Tails dropped because the publisher no longer lists them. */
  removed: string[];
}

/**
 * How long a held set is trusted before the publisher is asked again.
 *
 * A day, because that is what the publisher caches an image for; asking more
 * often would be asking a question whose answer it is still serving from
 * memory. The manifest itself is cached for five minutes, so a deliberate
 * `roms fetch` after a deploy sees the new version almost at once.
 */
export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * How long a request is waited on when the user asked for one.
 *
 * `roms fetch` is the user standing there having asked; it can afford to wait
 * for a slow link. A check nobody asked for cannot - see
 * {@link BACKGROUND_TIMEOUT_MS}.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * How long a check nobody asked for is waited on.
 *
 * Short on purpose. This runs before a command that was going to work anyway,
 * so the whole of what it may cost that command is this much, once, and only
 * on a day the publisher is unreachable.
 */
export const BACKGROUND_TIMEOUT_MS = 3_000;

/**
 * How long to leave a failing publisher alone.
 *
 * A failed check must not be retried by the next command: offline, that is a
 * timeout on every invocation. An hour is short enough that a transient outage
 * does not hold back a machine added yesterday, and long enough that a
 * disconnected laptop is not paying for the attempt over and over.
 */
export const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

const STATE_FILE = 'roms-state.json';
const MANIFEST_FILE = 'index.json';
const ATTRIBUTION_FILE = 'ATTRIBUTION.md';

/** How a build with no publisher of its own is given one. */
const PUBLISHER_HINT = 'BASICALLY_ROMS_URL names one';

/**
 * Where obtained ROMs are kept.
 *
 * `BASICALLY_HOME` overrides everything, which is what a test and an
 * air-gapped install both need. Otherwise the platform's own cache location:
 * these are re-obtainable files, so they belong where a system is free to
 * clear them, not in a dotfolder that looks like configuration.
 */
export function romCacheHome(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): string {
  const named = env.BASICALLY_HOME?.trim();
  if (named) return path.resolve(named);
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA?.trim();
    if (local) return path.join(local, 'basically');
  }
  const xdg = env.XDG_CACHE_HOME?.trim();
  if (xdg) return path.join(xdg, 'basically');
  return path.join(os.homedir(), '.cache', 'basically');
}

/** Where the images sit under a cache home - a directory shaped like `public/`. */
function romsDir(home: string): string {
  return path.join(home, 'roms');
}

/** The manifest this cache was last built against, or null if there is none. */
export function readCachedManifest(
  home: string = romCacheHome(),
): RomManifest | null {
  const file = path.join(romsDir(home), MANIFEST_FILE);
  if (!existsSync(file)) return null;
  try {
    return asManifest(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    // A manifest we cannot read is a cache we cannot vouch for, and saying so
    // costs one re-fetch rather than a wrong answer about what is held.
    return null;
  }
}

/** What the last check learned, or null if none has been made. */
export function readCacheState(
  home: string = romCacheHome(),
): RomCacheState | null {
  const file = path.join(home, STATE_FILE);
  if (!existsSync(file)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof raw !== 'object' || raw === null) return null;
    const state = raw as Partial<RomCacheState>;
    if (typeof state.checkedAt !== 'number') return null;
    return {
      etag: typeof state.etag === 'string' ? state.etag : undefined,
      version: typeof state.version === 'string' ? state.version : undefined,
      checkedAt: state.checkedAt,
      attemptedAt:
        typeof state.attemptedAt === 'number' ? state.attemptedAt : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The cache as a ROM root, or null when it does not hold a complete set.
 *
 * Complete means every image the held manifest lists is present at the length
 * it claims. A partial cache is not offered as a root at all: half a set would
 * shadow an installation that has the whole one.
 */
export function cachedRomRoot(home: string = romCacheHome()): string | null {
  const manifest = readCachedManifest(home);
  if (!manifest || manifest.roms.length === 0) return null;
  const dir = romsDir(home);
  for (const entry of manifest.roms) {
    const file = path.join(dir, entry.path);
    if (!existsSync(file) || statSync(file).size !== entry.bytes) return null;
  }
  return home;
}

/**
 * The cache as a ROM root even where it is short of the full set.
 *
 * {@link cachedRomRoot} is the strict answer, and it is what decides whether
 * the cache is *preferred*. This is the fallback: an installation with no
 * `public/roms/` of its own is better off reading the thirty-four images it has
 * than reading none because a thirty-fifth was added upstream this morning. A
 * machine whose image is genuinely absent still reports no ROM, one machine at
 * a time, which is the honest answer rather than a blanket one.
 */
export function heldRomRoot(home: string = romCacheHome()): string | null {
  const dir = romsDir(home);
  return existsSync(dir) && heldTails(dir).length > 0 ? home : null;
}

/** Which of these ROM tails the cache does not hold. */
export function missingFromCache(
  tails: readonly string[],
  home: string = romCacheHome(),
): string[] {
  const dir = romsDir(home);
  return tails.filter((tail) => !existsSync(path.join(dir, tail)));
}

/** Forget everything obtained, the agreement included where it lives here. */
export function clearRomCache(home: string = romCacheHome()): void {
  rmSync(romsDir(home), { recursive: true, force: true });
  rmSync(path.join(home, STATE_FILE), { force: true });
}

/** Whether the periodic check has been turned off for this run. */
export function refreshDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const setting = env.BASICALLY_ROM_REFRESH?.trim().toLowerCase();
  return (
    setting !== undefined &&
    ['off', 'never', 'no', 'false', '0'].includes(setting)
  );
}

/**
 * Whether to ask the publisher whether anything has changed.
 *
 * Due when nothing has been checked and when the interval has run out, and not
 * otherwise. There is deliberately no "but this machine has no image" trigger:
 * knowing which images the registered machines want means knowing the dialect
 * registry, and the process this runs in is the one that must not carry it
 * (`src/client/thinness.test.ts`). So a machine added upstream since the last
 * check arrives with the next one, or at once for a user who runs
 * `basically roms fetch`.
 */
export function refreshDue(
  opts: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    now?: number;
  } = {},
): boolean {
  const env = opts.env ?? process.env;
  if (refreshDisabled(env)) return false;
  const home = opts.home ?? romCacheHome(env);
  const manifest = readCachedManifest(home);
  const state = readCacheState(home);
  if (!manifest || !state) return true;

  const now = opts.now ?? Date.now();
  // A failure since the last good answer is a publisher to leave alone for a
  // while, however overdue the check is. Offline, retrying on the next command
  // means a timeout on every invocation - the command being failed by the
  // check, in all but name.
  if (
    state.attemptedAt !== undefined &&
    state.attemptedAt > state.checkedAt &&
    now - state.attemptedAt < RETRY_AFTER_FAILURE_MS
  ) {
    return false;
  }

  return now - state.checkedAt >= REFRESH_INTERVAL_MS;
}

/** Record that the publisher was asked, whatever the answer was. */
export function noteChecked(
  state: RomCacheState,
  home: string = romCacheHome(),
): void {
  mkdirSync(home, { recursive: true });
  writeFileSync(
    path.join(home, STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

/**
 * Obtain what the publisher lists and this cache lacks, and drop what it no
 * longer lists.
 *
 * Never throws and never fails a command: every way this can go wrong -
 * offline, a name that will not resolve, a 500, a timeout, an image whose
 * digest is not what it should be - returns `ok: false` with what is already
 * held left exactly as it was. The caller decides whether that is worth saying
 * anything about; a `run` says nothing, `roms status` and `roms fetch` say it
 * plainly, because those are the commands the user asked about ROMs with.
 */
export async function fetchRomSet(
  opts: {
    home?: string;
    base?: string;
    env?: NodeJS.ProcessEnv;
    /** Ask even when the held manifest would have answered. */
    force?: boolean;
    /** How long to wait; short for a check nobody asked for. */
    timeoutMs?: number;
    now?: number;
  } = {},
): Promise<FetchOutcome> {
  const env = opts.env ?? process.env;
  const home = opts.home ?? romCacheHome(env);
  const base = romsBaseUrl(opts.base ?? env.BASICALLY_ROMS_URL);
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const dir = romsDir(home);
  const obtained: string[] = [];
  const removed: string[] = [];

  // Nowhere to ask. Reported like any other way this can go wrong, but without
  // going through `fail` below: nothing was attempted, so there is no attempt to
  // record and no publisher to leave alone for an hour.
  if (base === undefined) {
    return {
      ok: false,
      reason: `this build names no ROM publisher (${PUBLISHER_HINT})`,
      unchanged: false,
      obtained,
      removed,
    };
  }

  try {
    const held = readCachedManifest(home);
    const state = readCacheState(home);
    const answer = await getManifest(
      base,
      held ? state?.etag : undefined,
      timeoutMs,
    );

    // 304 with nothing held is the publisher answering a question we had no
    // business asking; drop the tag and ask again rather than trusting a
    // manifest we do not have.
    const manifest = answer.manifest ?? held;
    if (!manifest) {
      const fresh = await getManifest(base, undefined, timeoutMs);
      if (!fresh.manifest) {
        return fail(
          'the published manifest could not be read',
          obtained,
          removed,
        );
      }
      return await syncTo(fresh.manifest, fresh.etag);
    }
    return await syncTo(manifest, answer.etag ?? state?.etag, answer.unchanged);

    async function syncTo(
      manifest: RomManifest,
      etag: string | undefined,
      unchangedSoFar = false,
    ): Promise<FetchOutcome> {
      mkdirSync(dir, { recursive: true });
      const listed = new Set(manifest.roms.map((entry) => entry.path));

      for (const entry of manifest.roms) {
        if (holds(dir, entry)) continue;
        const bytes = await getBytes(`${base}${entry.path}`, timeoutMs);
        const got = createHash('sha256').update(bytes).digest('hex');
        if (got !== entry.sha256) {
          // Refuse the image rather than keeping it: an unverifiable ROM would
          // boot a machine into whatever the bytes happen to be.
          return fail(
            `${entry.path} is not the image the publisher describes`,
            obtained,
            removed,
          );
        }
        writeAtomically(path.join(dir, entry.path), bytes);
        obtained.push(entry.path);
      }

      // The notice is not optional cargo: the terms the images travel on are
      // conditional on it travelling with them.
      const attribution = path.join(dir, ATTRIBUTION_FILE);
      if (!existsSync(attribution) || manifest.version !== held?.version) {
        try {
          writeAtomically(
            attribution,
            await getBytes(
              `${base}${manifest.attribution ?? ATTRIBUTION_FILE}`,
              timeoutMs,
            ),
          );
        } catch {
          // Worth having, not worth refusing a set the user already agreed to;
          // the images themselves are what was asked for.
        }
      }

      for (const tail of heldTails(dir)) {
        if (listed.has(tail)) continue;
        // The publisher prunes on deploy, so an image it stopped listing has
        // been withdrawn. Keeping a copy would strand the takedown at its
        // bucket.
        unlinkSync(path.join(dir, tail));
        removed.push(tail);
      }
      pruneEmptyDirs(dir);

      writeAtomically(
        path.join(dir, MANIFEST_FILE),
        Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
      );
      noteChecked(
        { etag, version: manifest.version, checkedAt: opts.now ?? Date.now() },
        home,
      );
      return {
        ok: true,
        version: manifest.version,
        unchanged:
          unchangedSoFar && obtained.length === 0 && removed.length === 0,
        obtained,
        removed,
      };
    }
  } catch (error) {
    return fail(describe(error), obtained, removed);
  }

  /**
   * Give up, having changed nothing that was already held, and record the
   * attempt so the next command does not immediately make it again.
   */
  function fail(
    reason: string,
    obtained: string[],
    removed: string[],
  ): FetchOutcome {
    const previous = readCacheState(home);
    if (previous) {
      try {
        noteChecked({ ...previous, attemptedAt: opts.now ?? Date.now() }, home);
      } catch {
        // Recording a failure must not itself become one.
      }
    }
    return { ok: false, reason, unchanged: false, obtained, removed };
  }
}

/**
 * Where the notice can be read, for a caller with no checkout to point at, or
 * nothing where this build names no publisher.
 */
export function attributionUrl(
  base?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const root = romsBaseUrl(base ?? env.BASICALLY_ROMS_URL);
  return root === undefined ? undefined : `${root}${ATTRIBUTION_FILE}`;
}

/**
 * Whether this build has anywhere to obtain images from.
 *
 * For the callers that only need the answer and not the address - a run must not
 * put the consent question to a user whose yes could not be acted on.
 */
export function publisherConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return romsBaseUrl(env.BASICALLY_ROMS_URL) !== undefined;
}

/** The manifest, or that the publisher says it has not changed. */
async function getManifest(
  base: string,
  etag: string | undefined,
  timeoutMs: number,
): Promise<{ manifest?: RomManifest; etag?: string; unchanged: boolean }> {
  const response = await fetch(`${base}${MANIFEST_FILE}`, {
    headers: etag ? { 'if-none-match': etag } : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 304) {
    return { etag, unchanged: true };
  }
  if (!response.ok) {
    throw new Error(`the publisher answered ${response.status}`);
  }
  return {
    manifest: asManifest(await response.json()),
    etag: response.headers.get('etag') ?? undefined,
    unchanged: false,
  };
}

async function getBytes(url: string, timeoutMs: number): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`the publisher answered ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * The manifest, checked for the shape this depends on.
 *
 * Only the fields read here are checked, and unknown ones are carried through
 * untouched: the publisher adds fields without asking, and refusing a manifest
 * for carrying one would make every future addition a breaking change.
 */
function asManifest(raw: unknown): RomManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('the published manifest is not an object');
  }
  const manifest = raw as Partial<RomManifest>;
  if (typeof manifest.version !== 'string' || !Array.isArray(manifest.roms)) {
    throw new Error(
      'the published manifest is missing its version or its list',
    );
  }
  for (const entry of manifest.roms) {
    if (
      typeof entry?.path !== 'string' ||
      typeof entry.bytes !== 'number' ||
      typeof entry.sha256 !== 'string' ||
      !isSafeTail(entry.path)
    ) {
      throw new Error('the published manifest lists an entry it should not');
    }
  }
  return manifest as RomManifest;
}

/**
 * Whether a manifest entry names something inside the cache.
 *
 * A path is the publisher's word for where to write a file, so it is checked
 * before it is joined onto anything: no absolute path, no drive letter, no `..`
 * segment, nothing that would put an obtained file outside the tool's own
 * directory.
 */
function isSafeTail(tail: string): boolean {
  if (tail === '' || path.isAbsolute(tail) || /^[A-Za-z]:/.test(tail)) {
    return false;
  }
  return tail
    .split(/[\\/]/)
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** Whether the cache already holds this image, at the right length and digest. */
function holds(dir: string, entry: RomManifestEntry): boolean {
  const file = path.join(dir, entry.path);
  if (!existsSync(file) || statSync(file).size !== entry.bytes) return false;
  return (
    createHash('sha256').update(readFileSync(file)).digest('hex') ===
    entry.sha256
  );
}

/** Every image held, as a tail, ignoring the manifest and the notice. */
function heldTails(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return heldTails(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    }
    const tail = `${prefix}${entry.name}`;
    return tail === MANIFEST_FILE || tail === ATTRIBUTION_FILE ? [] : [tail];
  });
}

/** A machine's folder that lost its last image should not linger. */
function pruneEmptyDirs(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(dir, entry.name);
    pruneEmptyDirs(child);
    if (readdirSync(child).length === 0) rmSync(child, { recursive: true });
  }
}

/**
 * Write through a temporary name.
 *
 * An interrupted download must not leave a half image behind: the cache is read
 * by length, and a truncated file that happens to be the right size would boot
 * a machine on nonsense.
 */
function writeAtomically(file: string, bytes: Buffer): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.part`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, file);
}

/** What went wrong, as a phrase that reads inside a sentence. */
function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError')
      return 'the publisher did not answer in time';
    return error.message;
  }
  return 'the publisher could not be reached';
}
