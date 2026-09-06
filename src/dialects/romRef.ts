// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Reading a machine's ROM reference: the path behind a `romUrl`, and the base a
 * published set is read from.
 *
 * A `romUrl` is a deployed URL (`/roms/zx81/zx81.rom`), but every consumer
 * really wants the part after `roms/` - the node side to build a path under a
 * ROM root, the command line to name an entry in the published manifest. Four
 * callers worked that out for themselves and two of them disagreed about
 * whether the `roms/` stays on, so it is one function here.
 *
 * Nothing in this file imports node or the DOM: the browser, the command line
 * and the tests all read a ROM reference the same way.
 */

/**
 * The `<folder>/<file>` a `romUrl` points at, without the `roms/` above it.
 *
 * `'/roms/zx81/zx81.rom'` and `'/basically/roms/zx81/zx81.rom'` both give
 * `'zx81/zx81.rom'`, so a deployment served from a sub-path reads the same as
 * one served from the root.
 */
export function romTail(romUrl: string): string {
  const at = romUrl.indexOf('roms/');
  return at === -1 ? romUrl : romUrl.slice(at + 'roms/'.length);
}

/**
 * Where the ROM set is published, with the trailing slash a caller can append a
 * tail to.
 *
 * Committed rather than configured because the command line has to work from a
 * fresh clone with nothing set up, and the route is an unauthenticated public
 * read - this is an address, not a secret. A deployment that moves overrides it
 * (`BASICALLY_ROMS_URL` on the command line); an override that cannot be
 * reached degrades to carrying no ROMs, which is a state everything here
 * already handles.
 */
export const DEFAULT_ROMS_BASE_URL =
  'https://86y7vk6qxc.execute-api.eu-west-2.amazonaws.com/roms/';

/**
 * The base to read the published set from: `override` where it says anything,
 * the default otherwise, ending in exactly one slash.
 *
 * The override arrives as an argument rather than being read from an
 * environment here, because the two surfaces keep it in different places - the
 * command line in the process environment, the browser folded into the bundle -
 * and this file belongs to neither.
 */
export function romsBaseUrl(override?: string): string {
  const base = override?.trim() ? override.trim() : DEFAULT_ROMS_BASE_URL;
  return `${base.replace(/\/+$/, '')}/`;
}
