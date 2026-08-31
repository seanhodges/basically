// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useMemo, useState } from 'react';
import type { Dialect } from '../dialects/types';
import { dialects } from '../dialects/registry';
import type { CustomRomMeta } from '../storage/customRom';
import { useIdeStore } from './store';
import { fetchRom } from './romImage';

/**
 * Which machines the picker may actually offer.
 *
 * Most of them are always offerable: their ROM ships with the build, or their
 * emulator fetches its own ROM set and ignores the one the seam hands it. The
 * exception is a machine that runs a *replaceable* image (`romBytes` declared),
 * because that image is allowed to be absent - `public/roms/ATTRIBUTION.md`
 * documents which ROMs a self-hoster may delete, and deleting one leaves a
 * machine that cannot start. Offering it anyway is offering a dead end: the
 * user picks it, waits, and gets an error instead of a computer.
 *
 * So availability is decided at runtime from two facts, in this order:
 *
 *  1. **The user's own image.** An uploaded ROM makes the machine runnable
 *    whatever the build ships, and it lives in the store, so
 *    this half is synchronous and reactive - install one in Settings ▸ Emulator
 *    and the machine appears without a reload.
 *  2. **The bundled image.** Only a fetch can answer this, so it is probed once
 *    per page through the shared {@link fetchRom} cache - which means the probe
 *    *is* the emulator pane's later download rather than a second one.
 *
 * Until the probe lands every machine is treated as available, because a stock
 * build ships every image and must not flicker a machine out of the picker and
 * back. A self-hoster who has deleted one sees it disappear once the probe
 * resolves.
 */

/** Machines that run the image the seam hands them, and so can lack one. */
function takesSuppliedRom(dialect: Dialect): boolean {
  return dialect.romBytes !== undefined;
}

/**
 * Whether the user has installed an image for this machine.
 *
 * Any image counts, whatever its size: one that does not fill the machine's ROM
 * area is fitted to it and run (`romImage.fitRomImage`), so an installed image
 * always gives the machine something to boot. Whether it boots to anything
 * useful is a different question, and one a correctly-sized image cannot answer
 * either - the emulator pane reports a machine that didn't start on a supplied
 * image, and Settings offers the bundled one back.
 */
function hasUserRom(
  dialect: Dialect,
  customRoms: Record<string, CustomRomMeta>,
): boolean {
  return customRoms[dialect.id] !== undefined;
}

/**
 * The ids whose bundled image is really there, fetched and size-checked.
 *
 * Resolves rather than rejects: a machine whose image is missing is a fact to
 * report, not an error to handle. Returns null where nothing can be probed
 * (no `fetch`, i.e. a non-browser test environment), which callers read as
 * "unknown" and therefore hide nothing they would not have hidden anyway.
 */
export async function probeBundledRoms(
  list: readonly Dialect[] = dialects,
): Promise<ReadonlySet<string> | null> {
  if (typeof fetch !== 'function') return null;
  const candidates = list.filter((d) => takesSuppliedRom(d) && d.romUrl);
  const results = await Promise.all(
    candidates.map((d) =>
      fetchRom(d.romUrl!, d.romBytes)
        .then(() => d.id)
        .catch(() => null),
    ),
  );
  return new Set(results.filter((id): id is string => id !== null));
}

/** What a machine's picker row would lead to, if the user chose it. */
export function machineIsRunnable(
  dialect: Dialect,
  opts: {
    customRoms: Record<string, CustomRomMeta>;
    /** Ids with a working bundled image, or null before the probe lands. */
    bundled: ReadonlySet<string> | null;
  },
): boolean {
  if (!takesSuppliedRom(dialect)) return true;
  if (hasUserRom(dialect, opts.customRoms)) return true;
  // Before the probe there is no evidence a machine cannot start, and a stock
  // build ships every image, so nothing is hidden on suspicion.
  if (opts.bundled === null) return true;
  return opts.bundled.has(dialect.id);
}

/**
 * The machines to offer, in registry order.
 *
 * `keepId` is always kept, however unrunnable: it is the machine the document
 * is already on, so hiding it would leave the picker with nothing selected and
 * the user unable to see what they are working in. A program reaches an
 * unrunnable machine through a share link or a saved project, and the emulator
 * pane is where that is explained.
 */
export function runnableMachines(
  list: readonly Dialect[],
  opts: {
    customRoms: Record<string, CustomRomMeta>;
    bundled: ReadonlySet<string> | null;
  },
  keepId?: string,
): Dialect[] {
  return list.filter((d) => d.id === keepId || machineIsRunnable(d, opts));
}

/**
 * The picker's machine list: the registry, minus anything that could not start.
 *
 * The probe runs once per mount of the owning dialog. Both pickers are mounted
 * at app level (they render null while closed), so it has normally settled long
 * before anyone opens one - and its downloads are the ones the emulator would
 * have made anyway.
 */
export function useRunnableMachines(keepId?: string): Dialect[] {
  const customRoms = useIdeStore((s) => s.customRoms);
  const [bundled, setBundled] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void probeBundledRoms().then((ids) => {
      if (!cancelled) setBundled(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => runnableMachines(dialects, { customRoms, bundled }, keepId),
    [customRoms, bundled, keepId],
  );
}
