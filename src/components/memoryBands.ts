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
  /**
   * The group this band belongs to, when zoomed in and its region carries one.
   * Undefined for an ungrouped region, and for a collapsed band (which *is* the
   * group).
   */
  group?: string;
  /**
   * Position within the group's run, counting from 0, so sibling sub-regions can
   * be drawn as progressively stronger shades of their group's colour: they stay
   * recognisably one family while remaining individually readable. Always 0 for
   * an ungrouped region and for a collapsed band.
   */
  shade: number;
}

/**
 * The bands to render at the current level of detail. Zoomed out
 * (`detailed = false`), contiguous leaves sharing a `group` collapse into one
 * band labelled by the group; zoomed in, every leaf is its own band, tagged with
 * the group it came from and its position within it.
 */
export function memoryBands(map: MemoryMap, detailed: boolean): Band[] {
  if (detailed) {
    let runGroup: string | undefined;
    let shade = 0;
    return map.regions.map((r) => {
      // Restart the ramp whenever the group changes, so a group appearing in two
      // separate runs (the BBC's ROM either side of the I/O window) shades each
      // run from the start rather than carrying on where the last one stopped.
      if (r.group !== undefined && r.group === runGroup) shade += 1;
      else shade = 0;
      runGroup = r.group;
      return {
        key: `${r.start}`,
        label: r.label,
        kind: r.kind,
        start: r.start,
        end: r.end,
        leaves: [r],
        group: r.group,
        shade,
      };
    });
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
        shade: 0,
      });
    }
  }
  return bands;
}
