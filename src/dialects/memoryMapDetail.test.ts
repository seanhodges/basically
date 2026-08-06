/**
 * The memory map has two levels of detail, and zooming in has to actually reach
 * the second one: contiguous leaves sharing a `group` collapse into one band
 * when the map is zoomed out, and open into the regions they group when it is
 * zoomed in (see `src/components/memoryBands.ts`).
 *
 * Four machines described their whole 64K in five flat regions once, so zooming
 * in showed nothing new. Each `detail` label below exists *only* as a
 * sub-region: flatten one of these maps back to its coarse form and the machine
 * named here fails.
 *
 * This is the per-machine matrix behind `e2e/memory-map/zoom-detail.spec.ts`,
 * which keeps one machine (the ZX81) to prove the slider and the re-layout work
 * in a real browser. The maps themselves are plain data - a browser adds
 * nothing to reading them, and four machines' worth of app boots is the most
 * expensive way to check a table.
 */
import { describe, expect, it } from 'vitest';
import { getDialect } from './registry';
import { memoryBands } from '../components/memoryBands';

/**
 * `coarse` is a band the map shows at every zoom level; `detail` is one of the
 * sub-regions it opens into. Kept in step with the e2e spec's ZX81 case.
 */
const MACHINES = [
  {
    id: 'zx81',
    coarse: 'System variables',
    detail: 'Printer buffer',
  },
  {
    id: 'zx80',
    coarse: 'System variables',
    detail: 'Program and display pointers',
  },
  {
    id: 'cpc464',
    coarse: 'System (high)',
    detail: 'Main firmware jumpblock',
  },
  {
    id: 'cpc6128',
    coarse: 'System (high)',
    detail: 'Main firmware jumpblock',
  },
] as const;

describe.each(MACHINES.map((m) => [m.id, m] as const))(
  'memory map detail: %s',
  (id, machine) => {
    const map = getDialect(id).memoryMap!;
    const coarse = memoryBands(map, false);
    const detailed = memoryBands(map, true);

    it('shows the grouping band, and not its sub-regions, when zoomed out', () => {
      expect(coarse.map((b) => b.label)).toContain(machine.coarse);
      expect(coarse.map((b) => b.label)).not.toContain(machine.detail);
    });

    it('opens the grouping band into the regions it groups when zoomed in', () => {
      expect(detailed.map((b) => b.label)).toContain(machine.detail);
      expect(detailed.length).toBeGreaterThan(coarse.length);
    });

    it('files the sub-region under the band that collapses it', () => {
      // Not just "the label appears somewhere zoomed in": the point of the pair
      // is that this leaf is what the coarse band is made of, so a map that
      // grew the detail as a *new top-level* region would still be flat.
      const leaf = map.regions.find((r) => r.label === machine.detail)!;
      expect(leaf.group, `${id} "${machine.detail}" is a sub-region`).toBe(
        machine.coarse,
      );
      const band = coarse.find((b) => b.label === machine.coarse)!;
      expect(band.leaves.map((r) => r.label)).toContain(machine.detail);
      expect(band.leaves.length).toBeGreaterThan(1);
    });

    it('zooms back out to exactly the bands it opened with', () => {
      // Collapsing widens a band in place (`prev.end = r.end`), so the guard
      // worth having is that it widens the *band* and never the map behind it:
      // ask for the coarse level again, after the detailed level has been built
      // from the same map, and the same bands must come back. That is what the
      // browser spec sees as the band count returning to what it was.
      const spans = (bands: ReturnType<typeof memoryBands>) =>
        bands.map((b) => [b.label, b.start, b.end]);
      expect(spans(memoryBands(map, false))).toEqual(spans(coarse));
    });
  },
);
