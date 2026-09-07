// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Reading a machine's ROM reference: the path behind a `romUrl`, and the base a
 * published set is read from.
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
 * The base to read the published set from, ending in exactly one slash, or
 * `undefined` where this build names no publisher.
 *
 * Two ways in, and they are shaped differently on purpose:
 *
 * - `override` is a **full ROM base** (`https://…/roms/`), passed by the caller
 *   from wherever that surface keeps it - the command line reads
 *   `BASICALLY_ROMS_URL` out of the process environment. It is used as given.
 * - Otherwise `VITE_SHARE_API_URL`, folded into the bundle at build time, is the
 *   share server's **origin**, and the ROM set is the `roms/` under it. The set
 *   is published by the share server, so there is one address for the server and
 *   the build hands the same one to every bundle rather than each carrying its
 *   own copy.
 *
 * Read here rather than at module scope so the value is the one in force when a
 * caller asks, which is what lets a test stub it.
 *
 * Neither set means there is nowhere to read a published set from: a caller
 * obtains nothing and says so. That is the state an installation with no ROMs is
 * already in, so nothing downstream is new.
 */
export function romsBaseUrl(override?: string): string | undefined {
  const named = override?.trim();
  if (named) return `${named.replace(/\/+$/, '')}/`;

  const origin = import.meta.env.VITE_SHARE_API_URL?.trim();
  if (!origin) return undefined;
  return `${origin.replace(/\/+$/, '')}/roms/`;
}
