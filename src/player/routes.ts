// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Short-URL routing for the standalone player: /<verb>/<shareId> picks the
// machine (verb) and the shared program (six-character share ID). Every verb
// is a real keyword from that machine's own BASIC.
//
// This module must stay dependency-free (no registry import): the share API
// Lambda bundles it to validate dialect ids, so it cannot pull in emulators.
// A test in routes.test.ts asserts the table stays in bijection with the
// dialect registry.

export interface ShareVerb {
  verb: string;
  dialectId: string;
}

export const SHARE_VERBS: readonly ShareVerb[] = [
  { verb: 'load', dialectId: 'zx81' }, // LOAD - the iconic ZX81 tape command
  { verb: 'goto', dialectId: 'zx80' }, // GO TO - ZX80 4K BASIC
  { verb: 'gosub', dialectId: 'zxspectrum' }, // GO SUB - Spectrum BASIC
  { verb: 'play', dialectId: 'zxspectrum128' }, // PLAY - 128K-exclusive keyword
  { verb: 'chain', dialectId: 'bbcmicro' }, // CHAIN "" - BBC BASIC load-and-run
  { verb: 'old', dialectId: 'bbcmaster' }, // OLD - BBC BASIC program recovery
  { verb: 'run', dialectId: 'commodore64' }, // RUN - after LOAD on the C64
  { verb: 'dload', dialectId: 'pet' }, // DLOAD - PET BASIC 4.0 disk load command
  { verb: 'sys', dialectId: 'vic20' }, // SYS - VIC-20 BASIC V2 jump-to-machine-code
  { verb: 'link', dialectId: 'atom' }, // LINK - Atom BASIC "execute machine code"
  { verb: 'cload', dialectId: 'trs80' }, // CLOAD - Level II BASIC tape load
  { verb: 'mode', dialectId: 'cpc464' }, // MODE - the iconic Locomotive BASIC screen-mode command
  { verb: 'fill', dialectId: 'cpc6128' }, // FILL - a BASIC 1.1-only keyword the 464 lacks
];

// Six characters from an unambiguous lowercase alphabet (no 0/O/1/l/i).
export const SHARE_ID_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

export interface PlayerRoute {
  verb: string;
  dialectId: string;
  shareId: string;
}

/**
 * Match a location.pathname against the player routes. Returns null for
 * anything that is not exactly /<known verb>/<valid share id> - the caller
 * falls back to the IDE shell.
 */
export function parsePlayerPath(pathname: string): PlayerRoute | null {
  const m = /^\/([a-z]+)\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  const entry = SHARE_VERBS.find((v) => v.verb === m[1]);
  if (!entry || !SHARE_ID_RE.test(m[2])) return null;
  return { verb: entry.verb, dialectId: entry.dialectId, shareId: m[2] };
}

/** The canonical player path for a dialect's share, e.g. ('zx81', 'abc234') → '/load/abc234'. */
export function playerPathFor(dialectId: string, id: string): string {
  const entry = SHARE_VERBS.find((v) => v.dialectId === dialectId);
  if (!entry) throw new Error(`No share verb for dialect: ${dialectId}`);
  return `/${entry.verb}/${id}`;
}
