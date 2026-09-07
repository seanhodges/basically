// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where the ROM images are coming from, gathered and rendered.
 *
 * The gathering is here rather than in `src/ops/` for the same reason the whole
 * of this corner is: it reads the filesystem and knows about a download cache,
 * neither of which that layer may.
 *
 * **Nothing here imports the dialect registry**, and that is a constraint
 * rather than an oversight. This module is reached from the command line's own
 * process, which is deliberately a program that parses arguments and renders an
 * answer - the registry and every emulator behind it are loaded by the host
 * instead, which is why `cli.mjs` is tens of kilobytes and not megabytes. So
 * this counts images, which the manifest and the filesystem both know about,
 * rather than machines, which only the registry does.
 *
 * The report's job is to make one thing visible that would otherwise be
 * baffling: a downloaded set is preferred to a source checkout's own images, so
 * a developer editing `public/roms/` can be reading something else entirely. It
 * therefore says not just which root is in use but *why* that one.
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { romsBaseUrl } from '../dialects/romRef';
import { findRomRoot } from '../dialects/headless/romRoot';
import {
  cachedRomRoot,
  readCacheState,
  readCachedManifest,
  romCacheHome,
} from './romCache';
import { recordedConsent } from './romConsent';

/** Why the root in use is the one in use. */
export type RomSource =
  /** The caller named it with `--rom-root`. */
  | 'named'
  /** Downloaded, complete, and kept current. */
  | 'downloaded'
  /** This installation's own `public/roms`. */
  | 'installed'
  /** Downloaded but short of the published set, used because nothing else is here. */
  | 'downloaded-partial'
  /** Nothing anywhere. */
  | 'none';

export interface RomsStatus {
  source: RomSource;
  /** The directory being read, absent when there is none. */
  root?: string;
  /** Where downloaded images are kept, whether or not any are. */
  home: string;
  /** Where the published set is read from, absent where this build names one. */
  publishedAt?: string;
  /** Whether downloading has been agreed to. */
  agreed: boolean;
  /** How many images the root in use holds. */
  images: number;
  /** The manifest version held, where one is. */
  version?: string;
  /** How many images that manifest lists. */
  published?: number;
  /** Images the held manifest lists that are not on disk. */
  missing: string[];
  /** When the published set was last confirmed, as an ISO instant. */
  checkedAt?: string;
}

/** What is where, read from disk and asking the publisher nothing. */
export function romsStatus(
  opts: { home?: string; env?: NodeJS.ProcessEnv; namedRoot?: string } = {},
): RomsStatus {
  const env = opts.env ?? process.env;
  const home = opts.home ?? romCacheHome(env);
  const root = opts.namedRoot ?? findRomRoot() ?? undefined;
  const state = readCacheState(home);
  const manifest = readCachedManifest(home);
  const dir = root === undefined ? undefined : path.join(root, 'roms');

  return {
    source: sourceOf(opts.namedRoot, root, home),
    root,
    home,
    publishedAt: romsBaseUrl(env.BASICALLY_ROMS_URL),
    agreed: recordedConsent(home) !== null,
    images: dir === undefined ? 0 : countImages(dir),
    version: manifest?.version,
    published: manifest?.roms.length,
    // Asked of the download directory, not of the root in use: the manifest
    // describes what was downloaded, so measuring it against a checkout's own
    // images would report an incomplete download as complete.
    missing:
      manifest === null
        ? []
        : manifest.roms
            .map((entry) => entry.path)
            .filter((tail) => !existsSync(path.join(home, 'roms', tail))),
    checkedAt:
      state === null ? undefined : new Date(state.checkedAt).toISOString(),
  };
}

function sourceOf(
  named: string | undefined,
  root: string | undefined,
  home: string,
): RomSource {
  if (named !== undefined) return 'named';
  if (root === undefined) return 'none';
  if (root !== home) return 'installed';
  return cachedRomRoot(home) === home ? 'downloaded' : 'downloaded-partial';
}

/** Every file under a ROM directory bar the manifest and the notice. */
function countImages(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    if (entry.isDirectory())
      return total + countImages(path.join(dir, entry.name));
    return entry.name === 'index.json' || entry.name === 'ATTRIBUTION.md'
      ? total
      : total + 1;
  }, 0);
}

/** One line saying where the images come from, and why that place. */
function whereFrom(status: RomsStatus): string {
  switch (status.source) {
    case 'named':
      return `reading ${status.root} (you named it with --rom-root)`;
    case 'downloaded':
      return `reading ${status.root} (downloaded, and preferred to any images installed here)`;
    case 'downloaded-partial':
      return `reading ${status.root} (downloaded, and short of the published set - nothing else here carries ROMs)`;
    case 'installed':
      return status.version === undefined
        ? `reading ${status.root} (this installation's own images; nothing has been downloaded)`
        : `reading ${status.root} (this installation's own images, because the downloaded set is short of the published one)`;
    case 'none':
      return 'no ROM images anywhere: every machine will draw its missing-image notice';
  }
}

/** The status as lines, in the plain style the other reports use. */
export function formatRomsStatus(status: RomsStatus): string {
  const lines = [whereFrom(status), `${status.images} images here`];
  if (status.version !== undefined) {
    lines.push(
      `holding published set ${status.version} (${status.published} images)`,
    );
  }
  if (status.missing.length > 0) {
    lines.push(
      `not downloaded: ${status.missing.join(' ')}` +
        ' ("basically roms fetch" gets them)',
    );
  }
  lines.push(
    status.publishedAt === undefined
      ? 'this build names no publisher, so nothing can be downloaded (BASICALLY_ROMS_URL names one)'
      : `published at ${status.publishedAt}`,
  );
  // The agreement is only worth a line where it governs something: with no
  // publisher there is no download to agree to, and promising that the next run
  // will ask would be promising a question it has no reason to put.
  if (status.agreed) {
    lines.push('downloading was agreed to');
  } else if (status.publishedAt !== undefined) {
    lines.push(
      'downloading has not been agreed to; the first run that needs an image will ask',
    );
  }
  if (status.checkedAt !== undefined) {
    lines.push(`last checked ${status.checkedAt}`);
  }
  if (status.source !== 'named' && status.home !== status.root) {
    lines.push(`downloads would be kept in ${path.join(status.home, 'roms')}`);
  }
  return lines.join('\n');
}
