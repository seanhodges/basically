// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where a program writes into a machine's memory, resolved once for everything
 * that draws it.
 *
 * Two surfaces need the same answer: the IDE's memory-map panel, which marks the
 * addresses on the machine the program is written for, and the porting guide,
 * which marks the same addresses on *both* compared machines so a reader can see
 * that a write aimed at one machine's system variables reaches another's program
 * text. They have to agree - a marker in one place and not the other would be
 * read as a difference between the machines rather than as a difference between
 * two pieces of code.
 *
 * The guide gets its answer across the iframe boundary rather than by importing
 * this module: it runs in the documentation bundle, which may not reach the
 * dialect registry or an emulator core (see `machinePickerBoundary.test.ts`).
 */
import type { Dialect } from '../dialects/types';
import {
  pokeSites,
  type PokeContext,
  type PokeSite,
} from '../editor/pokeAddresses';

/**
 * How this dialect writes memory, for the write-site markers: an explicit
 * descriptor when the dialect provides one (BBC/Atom `?`/`!` indirection), else
 * the implied `POKE` form when it has a POKE keyword, else none - the machine
 * has a map but we don't know how to read its writes, so no markers.
 */
export function writeContextFor(dialect: Dialect): PokeContext | null {
  const map = dialect.memoryMap;
  if (!map) return null;
  // Approximate base for a code load with no target in the statement: the
  // machine's free-RAM / program area start (falling back to the first RAM
  // region above ROM).
  const loadBase =
    map.regions.find((r) => r.kind === 'program')?.start ??
    map.regions.find((r) => r.kind !== 'rom')?.start;
  const mw = dialect.memoryWrites;
  if (mw)
    return {
      udgBase: map.udgBase,
      writes: mw.forms,
      hexPrefix: mw.hexPrefix,
      statementSep: mw.statementSep,
      loadBase,
    };
  if (dialect.keywords.some((k) => k.word === 'POKE'))
    return { udgBase: map.udgBase, writes: ['poke'] };
  return null;
}

/** True where the dialect writes memory by indirection (`?addr = v`) rather
 *  than `POKE`, which changes how an address reads back. */
export function writesByIndirection(dialect: Dialect): boolean {
  return !!writeContextFor(dialect)?.writes?.includes('indirection');
}

/** The sites a program's writes resolve to, split by whether the machine has
 *  the address at all. */
export interface ResolvedWriteSites {
  /** Sites that land inside the machine's memory, drawn as markers. */
  inRange: PokeSite[];
  /** Sites that resolve outside it, surfaced as a warning rather than drawn. */
  outOfRange: PokeSite[];
}

/**
 * The memory writes `source` makes when read as `dialect`, de-duplicated by
 * address and split into those the machine has and those it does not.
 *
 * Read as the dialect passed in, never as whichever machine happens to be
 * selected: the porting guide asks for a program to be read as the machine it is
 * being ported *from*, which is the case this distinction exists for.
 */
export function resolveWriteSites(
  source: string,
  dialect: Dialect,
): ResolvedWriteSites {
  const map = dialect.memoryMap;
  const ctx = writeContextFor(dialect);
  // Keyed by role + address so a write and a code load at the same byte both
  // show (they render as separate amber/blue markers).
  const seen = new Map<string, PokeSite>();
  if (map && ctx)
    for (const s of pokeSites(source, ctx)) {
      // Prefer an exact site over an approximate one at the same address.
      const key = `${s.role ?? 'write'}:${s.address}`;
      const prev = seen.get(key);
      if (!prev || (prev.approximate && !s.approximate)) seen.set(key, s);
    }

  const inRange: PokeSite[] = [];
  const outOfRange: PokeSite[] = [];
  for (const s of seen.values()) {
    const inSpace = !!map && s.address >= 0 && s.address < map.addressSpace;
    if (s.approximate) {
      // An approximate address is only a best-effort base, so show it only
      // where it plausibly points at RAM: in range, non-zero, and not in a ROM
      // region (a write there would be a no-op). Otherwise drop it silently -
      // no out-of-range warning for a guessed base.
      const kind = map?.regions.find(
        (r) => s.address >= r.start && s.address <= r.end,
      )?.kind;
      if (inSpace && s.address !== 0 && kind !== 'rom') inRange.push(s);
    } else if (inSpace) {
      inRange.push(s);
    } else {
      outOfRange.push(s);
    }
  }
  inRange.sort((a, b) => a.address - b.address);
  outOfRange.sort((a, b) => a.address - b.address);
  return { inRange, outOfRange };
}
