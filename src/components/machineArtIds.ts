// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Which machines have a portrait, kept apart from the drawings themselves in
 * `machineArt.tsx` so this stays a plain module (unit-testable, and the art
 * file exports only components).
 *
 * The list is the source of truth: `machineArt.tsx` types its map as a
 * `Record<MachineArtId, …>`, so adding an id here without drawing it - or
 * drawing one that is not listed - fails the type check.
 */

export const MACHINE_ART_IDS = [
  'zx81',
  'zx80',
  'zxspectrum',
  'zxspectrum128',
  'bbcmicro',
  'bbcmaster',
  'atom',
  'commodore64',
  'vic20',
  'pet',
  'trs80',
  'cpc464',
  'cpc6128',
] as const;

export type MachineArtId = (typeof MACHINE_ART_IDS)[number];

/** The stand-in for a machine we have no portrait for. */
export const GENERIC_ART_ID = 'generic';

/**
 * The art key a dialect id resolves to - `'generic'` when we have no portrait
 * for it. A dialect can exist on disk before it is registered, and a newly
 * registered one may land before its artwork, so this degrades rather than
 * throwing.
 */
export function machineArtId(id: string): MachineArtId | typeof GENERIC_ART_ID {
  return (MACHINE_ART_IDS as readonly string[]).includes(id)
    ? (id as MachineArtId)
    : GENERIC_ART_ID;
}
