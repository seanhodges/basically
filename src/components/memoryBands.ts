import type { MemoryMap, MemoryRegion } from '../dialects/types';

/**
 * A region span as shown by a single band in the memory-map viewer: either one
 * leaf region, or a collapsed group of contiguous leaves (when zoomed out).
 * Rendering-agnostic so the band list stays a pure, testable transform.
 */
export interface Band {
  key: string;
  label: string;
  kind: MemoryRegion['kind'];
  start: number;
  end: number;
  /** The leaf regions this band represents (one, unless collapsed by group). */
  leaves: MemoryRegion[];
}

/**
 * The bands to render at the current level of detail. Zoomed out
 * (`detailed = false`), contiguous leaves sharing a `group` collapse into one
 * band labelled by the group; zoomed in, every leaf is its own band.
 */
export function memoryBands(map: MemoryMap, detailed: boolean): Band[] {
  if (detailed) {
    return map.regions.map((r) => ({
      key: `${r.start}`,
      label: r.label,
      kind: r.kind,
      start: r.start,
      end: r.end,
      leaves: [r],
    }));
  }
  const bands: Band[] = [];
  for (const r of map.regions) {
    const prev = bands[bands.length - 1];
    if (r.group && prev && prev.label === r.group) {
      prev.end = r.end;
      prev.leaves.push(r);
    } else {
      bands.push({
        key: `${r.start}`,
        label: r.group ?? r.label,
        kind: r.kind,
        start: r.start,
        end: r.end,
        leaves: [r],
      });
    }
  }
  return bands;
}
