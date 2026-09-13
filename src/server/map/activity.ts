// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A mapped machine's touched addresses, on their way to whoever is watching.
 *
 * Modelled on `src/server/play/frames.ts`, and for the same two economies:
 *
 * - **A sample identical to the one before it is not sent at all.** Found by
 *   comparing the reduced cells rather than by compressing them and comparing
 *   the result, because the comparison is a fraction of what the deflate costs
 *   and a machine sitting at a prompt touches the same handful of cells frame
 *   after frame.
 * - **Raw deflate at the cheapest level.** The cells of a machine that touched
 *   a few regions are mostly zero and compress to almost nothing at any level;
 *   the levels above this buy a few percent of the bytes for several times the
 *   milliseconds, out of a budget measured against the machine's frame period.
 *
 * The cell width travels with every sample rather than once at the start, so a
 * page draws what it was sent rather than what it assumed.
 */

import { deflateRawSync } from 'node:zlib';
import type { MapActivity } from '../../dialects/headless/activityTap';

/** The deflate level; see the module note. */
const DEFLATE_LEVEL = 1;

/**
 * Encode samples for one map, skipping the ones that changed nothing.
 *
 * Stateful because "changed nothing" is a question about the sample before,
 * and per map because a map that has just been opened must be sent a sample
 * even if the machine has been touching the same cells for an hour.
 */
export interface MapActivities {
  /** The sample to send, or null when this one is the last one over again. */
  encode(cells: Uint8Array, addressesPerCell: number): MapActivity | null;
  /** Forget what was last sent, so the next sample is sent whatever it shows. */
  reset(): void;
}

export function createMapActivities(): MapActivities {
  let previous: Buffer | null = null;
  let width = 0;

  return {
    encode(cells, addressesPerCell) {
      // A view over the same memory rather than a copy: the deflate reads it
      // and the comparison reads it, and neither keeps it.
      const raw = Buffer.from(cells.buffer, cells.byteOffset, cells.length);
      if (addressesPerCell === width && previous && previous.equals(raw)) {
        return null;
      }
      width = addressesPerCell;
      previous = Buffer.from(raw);
      return {
        addressesPerCell,
        cells: deflateRawSync(raw, { level: DEFLATE_LEVEL }),
      };
    },
    reset() {
      previous = null;
      width = 0;
    },
  };
}
