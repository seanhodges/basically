/**
 * The contract between the IDE's POKE analysis and the map that draws it.
 *
 * `MemoryMapView` renders in two bundles - the app's and the documentation
 * site's - and the documentation site may not import `src/editor/pokeAddresses`
 * (see `machinePickerBoundary.test.ts`: it is the IDE's program analysis, and
 * the boundary is what keeps a Z80 core out of a docs page). So the view
 * declares the shape it draws, {@link MapWriteSite}, instead of importing
 * {@link PokeSite}, and the two agree by structure.
 *
 * "Agree by structure" is only true while something checks it, which is this
 * file. The same arrangement, for the same reason, holds between
 * `src/reference/compare.ts` and the program vocabulary that crosses the same
 * boundary.
 *
 * The rendering itself is covered by `e2e/memory-map/` rather than here: this
 * project runs vitest in node with no DOM, so what a band looks like at a given
 * zoom is a browser assertion.
 */
import { describe, expect, it } from 'vitest';
import { pokeSites, type PokeSite } from '../editor/pokeAddresses';
import { DETAIL_ZOOM, type MapWriteSite } from './MemoryMapView';

describe('the write sites the map draws', () => {
  it('accepts what the editor’s POKE analysis produces', () => {
    // A compile-time assignment is the real assertion: if either side renames or
    // re-types a field the view reads, this file stops building. The runtime
    // checks below then pin that the fields actually arrive populated, which a
    // structural type alone cannot say.
    const analysed: PokeSite[] = pokeSites(
      ['10 POKE 16384,255', '20 FOR I=1 TO 8', '30 POKE 22528+I,2', '40 NEXT I'].join(
        '\n',
      ),
      { writes: ['poke'] },
    );
    const drawn: MapWriteSite[] = analysed;

    expect(drawn.length).toBeGreaterThan(0);
    for (const site of drawn) {
      expect(typeof site.address).toBe('number');
      expect(typeof site.expr).toBe('string');
      expect(typeof site.computed).toBe('boolean');
      expect(typeof site.approximate).toBe('boolean');
    }
  });

  it('carries the literal and the computed address apart', () => {
    const drawn: MapWriteSite[] = pokeSites(
      ['10 POKE 16384,255', '20 LET X=32768', '30 POKE X,1'].join('\n'),
      { writes: ['poke'] },
    );
    const byAddress = new Map(drawn.map((s) => [s.address, s]));

    // A bare literal is not "computed"; an address reached through a variable is.
    expect(byAddress.get(16384)?.computed).toBe(false);
    expect(byAddress.get(32768)?.computed).toBe(true);
  });

  it('marks a loop’s range with the end address the map shades to', () => {
    const drawn: MapWriteSite[] = pokeSites(
      ['10 FOR I=0 TO 15', '20 POKE 22528+I,2', '30 NEXT I'].join('\n'),
      { writes: ['poke'] },
    );
    const ranged = drawn.find((s) => s.endAddress !== undefined);

    // The view shades from `address` to `endAddress`; without the end address it
    // would draw a single line where the program writes sixteen bytes.
    expect(ranged?.address).toBe(22528);
    expect(ranged?.endAddress).toBe(22543);
  });
});

describe('the detail threshold', () => {
  it('sits above the zoom the map opens at', () => {
    // The map opens at zoom 1 showing collapsed groups, and resolves into the
    // machine's own sub-regions past this point. Both hosts read the same
    // constant, so the IDE panel and the porting guide agree about what "zoomed
    // in" means - and `e2e/memory-map/zoom-detail.spec.ts` drives real machines
    // across it.
    expect(DETAIL_ZOOM).toBeGreaterThan(1);
  });
});
