import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { MemoryMap } from '../dialects/types';
import { memoryBands, type Band } from './memoryBands';
import { addressTicks, columnHeight } from './memoryScale';
import { bandLayout, type BandGeometry } from './memoryActivity/bandLayout';
import styles from './MemoryMapView.module.css';

/**
 * One machine's memory as a colour-coded column of regions: the picture itself,
 * with no chrome and no state of its own.
 *
 * Two hosts render it. The IDE's `MemoryMapPanel` wraps it in the docked panel's
 * header and controls, feeds it the open program's write sites, and layers a
 * live emulator-activity canvas over it. The porting guide renders two of them
 * side by side, driven by one set of controls, so a reader can see where a
 * program's memory lands on the machine it is being ported to.
 *
 * Everything the two hosts must agree on is a prop: zoom, notation, level of
 * detail, which region is selected and where the column is scrolled to. That is
 * what lets the guide hold two panes in step - a pane owning its own zoom could
 * not be compared with its neighbour.
 *
 * It deliberately imports nothing that reaches the dialect registry or an
 * emulator core: the documentation bundle renders it, and
 * `machinePickerBoundary.test.ts` enforces that line. Two consequences show up
 * below - {@link MapWriteSite} is declared here rather than imported from the
 * editor's POKE analysis, and the activity canvas arrives as {@link
 * MemoryMapViewProps.overlay} rather than being drawn here.
 */

/** The smallest a band may shrink to, outside proportional mode. The pixels-
 *  per-byte the height is derived from lives in `./memoryScale`, with the
 *  address scale drawn against it - the porting guide reads it from there to
 *  work out the zoom that fills its panes, and cannot import this module
 *  without pulling React into every documentation page. */
const MIN_BAND_PX = 26;
/** Gap between bands, in px. Mirrors the `gap` on `.map` in the CSS module so an
 *  overlay's address→pixel mapping lines up with the rendered bands.
 *  Keep this in sync if the CSS gap changes. */
const GAP_PX = 3;
/** Hide a marker's address label if it would sit within this many pixels of the
 * last shown one (small regions clamp to MIN_BAND_PX, so labels crowd). */
const LABEL_GAP_PX = 12;
/** Below this height a band has no room for its name, so the name is dropped
 *  rather than drawn across its neighbours. Only reachable in `proportional`
 *  mode, where nothing clamps a band up to a legible size; the region is still
 *  coloured, still selectable, and still named in its tooltip and its detail. */
const MIN_LABEL_PX = 15;

/** The zoom at which bands open into their leaves and the address scale appears. */
export const DETAIL_ZOOM = 1.75;

const hexAddr = (addr: number) =>
  `&${addr.toString(16).toUpperCase().padStart(4, '0')}`;

export type Notation = 'hex' | 'dec';

/**
 * One address a program writes to or loads code at, as this view draws it.
 *
 * Declared here rather than imported from `src/editor/pokeAddresses.ts`: that
 * module is the IDE's program analysis and must not be reachable from the
 * documentation bundle. The two sides agree by structure instead of by import,
 * and `MemoryMapView.test.ts` pins `PokeSite` as assignable to this - the same
 * arrangement `src/reference/compare.ts` makes for the program vocabulary that
 * crosses the same boundary.
 */
export interface MapWriteSite {
  /** The address written to, or the base a code load lands at. */
  address: number;
  /** The raw address text, e.g. `"X"` or `"base+1"`, for the marker's tooltip. */
  expr: string;
  /** True unless the address was written as a bare decimal literal. */
  computed: boolean;
  /** True when the address is a best-effort base worked out at runtime: the
   *  region is right, the exact byte may not be. */
  approximate: boolean;
  /** For a loop that writes a range, the last address it reaches. */
  endAddress?: number;
  /** Present (as `'load'`) only where a program loads binary code, which draws
   *  blue rather than amber. Absent on an ordinary write. */
  role?: 'load';
}

export interface MemoryMapViewProps {
  /** The machine's regions. Every map covers the same address space, which is
   *  what lets two of them be compared against one scale - see
   *  `src/dialects/memoryMap.test.ts`. */
  map: MemoryMap;
  zoom: number;
  notation: Notation;
  /** The selected band's key, or null. Controlled so a host can clear it. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Whether the region detail is shown over the column. */
  showDetails: boolean;
  /** The addresses the open program writes to, already filtered to this map. */
  sites?: MapWriteSite[];
  /** True where the dialect writes memory by indirection (`?addr`) rather than
   *  `POKE`, which changes how the detail reads an address back. */
  byIndirection?: boolean;
  /** Scroll offset to hold the column at. Controlled so the porting guide's two
   *  panes show the same addresses when only one of them is on screen. */
  scrollTop?: number;
  onScrollChange?: (top: number) => void;
  /** Drawn over the band column by the host - the IDE's live activity canvas.
   *  Absent in the documentation site, which has no emulator. */
  overlay?: ReactNode;
  /** The band layout, reported after each render so a host driving an overlay
   *  can map addresses to pixels without recomputing the geometry. */
  onGeometry?: (geometry: BandGeometry[]) => void;
  /** Pinch and Ctrl/⌘-wheel gestures over the column, for a host that owns zoom. */
  onZoomGesture?: (next: (z: number) => number) => void;
  /**
   * Draw every band at exactly its share of the address space: no minimum
   * height, no gap between bands.
   *
   * The default (false) is what a single map wants - a region too small to read
   * is clamped to a legible minimum, and the gaps make the bands read as
   * separate things. Both of those break alignment, though: clamping is
   * non-linear, and gaps accumulate, so a machine with more regions ends up with
   * a taller column and the same address sits at a different height on each.
   *
   * The porting guide sets this, because a shared address scale is the entire
   * point of putting two maps beside each other - a reader draws a line across
   * them. The cost is that a small region is a sliver until it is zoomed into,
   * which is what zoom is for.
   */
  proportional?: boolean;
  /**
   * True while the host is keeping this view out of view - the porting guide's
   * inactive tab, which is `display: none` and therefore has no layout to scroll.
   *
   * The view needs to be told, because a hidden column cannot take a scroll
   * offset: the assignment lands on an element with no scroll height and is
   * silently dropped. Knowing when it comes back is what lets it re-apply the
   * offset, so flipping tabs shows the same addresses on the other machine
   * rather than starting again at the top.
   */
  hidden?: boolean;
  /** Names this column for assistive technology, e.g. "ZX81 memory map". */
  label?: string;
}

export function MemoryMapView({
  map,
  zoom,
  notation,
  selectedKey,
  onSelect,
  showDetails,
  sites = [],
  byIndirection = false,
  scrollTop,
  onScrollChange,
  overlay,
  onGeometry,
  onZoomGesture,
  label,
  hidden = false,
  proportional = false,
}: MemoryMapViewProps) {
  const detailed = zoom >= DETAIL_ZOOM;
  const bands = useMemo(() => memoryBands(map, detailed), [map, detailed]);
  const totalBytes = map.addressSpace;

  /** Format an address in the currently-selected notation. */
  const fmt = (addr: number) =>
    notation === 'hex' ? hexAddr(addr) : `${addr}`;

  /**
   * How to read one address back on this machine: `PEEK 32768`, or `?32768`
   * where the dialect works by indirection. A BBC or an Atom has no `PEEK` at
   * all, so offering one names a keyword the machine would reject.
   */
  const readBack = (addr: number) =>
    byIndirection ? `?${addr}` : `PEEK ${addr}`;

  /**
   * How a marker describes its site, for tooltips: a code load carries its own
   * `LOAD …` label (`expr`); a write reads `POKE 22528` or, for indirection,
   * the sigil form `?&2000`.
   */
  const writeDesc = (s: MapWriteSite) =>
    s.role === 'load' ? s.expr : byIndirection ? s.expr : `POKE ${s.expr}`;

  /** The marker/fill/label CSS classes for a site: blue for a code load
   *  (`role: 'load'`), amber for an ordinary write. */
  const markerCls = (s: MapWriteSite) =>
    s.role === 'load'
      ? {
          marker: styles.loadMarker,
          markerApprox: styles.loadMarkerApprox,
          fill: styles.loadFill,
          fillApprox: styles.loadFillApprox,
          label: styles.loadLabel,
        }
      : {
          marker: styles.pokeMarker,
          markerApprox: styles.pokeMarkerApprox,
          fill: styles.pokeFill,
          fillApprox: styles.pokeFillApprox,
          label: styles.pokeLabel,
        };

  /** A DOM key unique across roles, so a write and a load at one address don't
   *  collide. */
  const siteKey = (s: MapWriteSite) => `${s.role ?? 'w'}${s.address}`;

  const sitesInRegion = (start: number, end: number) =>
    sites.filter((s) => s.address >= start && s.address <= end);

  // Proportional drops the legibility floor and the gap, so the column's height
  // is exactly `columnHeight(addressSpace, zoom)` on every machine and two of
  // them can be read straight across. See `proportional` on the props.
  const gap = proportional ? 0 : GAP_PX;
  const bandHeight = (b: Band) => {
    const exact = columnHeight(b.end - b.start + 1, zoom);
    return proportional ? exact : Math.max(MIN_BAND_PX, exact);
  };

  // --- Pinch / wheel zoom, delegated to the host that owns the zoom value ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pointerDist = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2)
      pinch.current = { dist: pointerDist(), zoom };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current && onZoomGesture) {
      const dist = pointerDist();
      const start = pinch.current;
      if (start.dist > 0) onZoomGesture(() => (start.zoom * dist) / start.dist);
    }
  };
  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    // Ctrl/Cmd + wheel (and trackpad pinch, which reports ctrlKey) zooms; a plain
    // wheel is left alone so the map scrolls normally.
    if (!e.ctrlKey && !e.metaKey) return;
    if (!onZoomGesture) return;
    e.preventDefault();
    onZoomGesture((z) => z - e.deltaY * 0.01);
  };

  // A controlled scroll offset, applied before paint so a pane revealed by a tab
  // switch opens on the addresses the reader was already looking at rather than
  // at the top. Skipped while it already matches, so it never fights the user
  // scrolling: the scroll handler reports the new offset and the host echoes it
  // back unchanged.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || hidden || scrollTop === undefined) return;
    if (Math.abs(el.scrollTop - scrollTop) > 1) el.scrollTop = scrollTop;
  }, [scrollTop, zoom, detailed, hidden]);

  // The band geometry, reported to a host drawing an overlay over the column.
  const geometry = useMemo(
    () => bandLayout(bands, bandHeight, gap),
    // bandHeight is a pure function of zoom, captured fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bands, zoom, gap],
  );
  useLayoutEffect(() => {
    onGeometry?.(geometry);
  }, [geometry, onGeometry]);

  const selected = bands.find((b) => b.key === selectedKey) ?? null;
  const selectedSites = selected
    ? sitesInRegion(selected.start, selected.end)
    : [];
  // Loads aren't PEEK-back targets like writes, so the detail panel lists them
  // separately.
  const selectedWrites = selectedSites.filter((s) => s.role !== 'load');
  const selectedLoads = selectedSites.filter((s) => s.role === 'load');

  return (
    <div className={styles.body}>
      <div
        className={styles.mapScroll}
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
        onScroll={(e) => onScrollChange?.(e.currentTarget.scrollTop)}
      >
        <div
          className={`${styles.map} ${proportional ? styles.mapProportional : ''}`}
          aria-label={label}
          role={label ? 'group' : undefined}
        >
          {overlay}
          {bands.map((b) => {
            const px = bandHeight(b);
            const span = b.end - b.start + 1;
            const markers = sitesInRegion(b.start, b.end).map((s) => ({
              s,
              y: ((s.address - b.start) / span) * px,
            }));
            // Loop-range writes that overlap this band, by their full [lo, hi]
            // span (not just the start marker) so a range spanning several
            // bands shades each one it passes through.
            const ranges = sites
              .filter((s) => s.endAddress !== undefined)
              .map((s) => ({
                s,
                lo: Math.min(s.address, s.endAddress!),
                hi: Math.max(s.address, s.endAddress!),
              }))
              .filter((r) => r.hi >= b.start && r.lo <= b.end);
            let lastLabelY = -Infinity;
            const fraction = (span / totalBytes) * 100;
            return (
              <button
                key={b.key}
                type="button"
                className={`${styles.band} ${styles[b.kind]} ${
                  b.key === selectedKey ? styles.selected : ''
                }`}
                style={
                  {
                    height: `${px}px`,
                    // Sub-regions of one group are drawn as progressively
                    // stronger shades of their kind's colour: the hue still
                    // says what the region is for, the shade says which
                    // family it belongs to. See --mm-shade in the stylesheet.
                    '--mm-shade': b.shade,
                  } as React.CSSProperties
                }
                onClick={() => onSelect(b.key)}
                title={`${fmt(b.start)}–${fmt(b.end)} ${b.label}`}
              >
                {ranges.map(({ s, lo, hi }) => {
                  // Clamp the fill to this band; +1 on the far edge covers the
                  // end byte's own row so the shading reaches the last address.
                  const top = ((Math.max(lo, b.start) - b.start) / span) * px;
                  const bottom =
                    ((Math.min(hi, b.end) + 1 - b.start) / span) * px;
                  const cls = markerCls(s);
                  return (
                    <span
                      key={`f${siteKey(s)}`}
                      className={`${cls.fill} ${
                        s.approximate ? cls.fillApprox : ''
                      }`}
                      style={{
                        top: `${(top / px) * 100}%`,
                        height: `${((bottom - top) / px) * 100}%`,
                      }}
                    />
                  );
                })}
                {ranges
                  .filter(
                    (r) =>
                      r.s.endAddress! >= b.start && r.s.endAddress! <= b.end,
                  )
                  .map(({ s }) => {
                    const y = ((s.endAddress! - b.start) / span) * px;
                    // Label the end address too, but only when it clears the
                    // start line enough not to crowd its label. When the start
                    // sits in another band the two are already far apart, so
                    // always label.
                    const startInBand =
                      s.address >= b.start && s.address <= b.end;
                    const yStart = ((s.address - b.start) / span) * px;
                    const showLabel =
                      !startInBand || Math.abs(y - yStart) >= LABEL_GAP_PX;
                    const cls = markerCls(s);
                    return (
                      <span
                        key={`e${siteKey(s)}`}
                        className={`${cls.marker} ${
                          s.approximate ? cls.markerApprox : ''
                        }`}
                        style={{ top: `${(y / px) * 100}%` }}
                        title={`${writeDesc(s)} — range end ${fmt(
                          s.endAddress!,
                        )}`}
                      >
                        {showLabel && (
                          <span className={cls.label}>
                            {s.approximate ? '≈' : ''}
                            {fmt(s.endAddress!)}
                          </span>
                        )}
                      </span>
                    );
                  })}
                {detailed &&
                  addressTicks(b.start, b.end, px).map((a) => (
                    <span
                      key={`t${a}`}
                      className={styles.scaleTick}
                      style={{ top: `${((a - b.start) / span) * 100}%` }}
                    >
                      <span className={styles.scaleLabel}>{fmt(a)}</span>
                    </span>
                  ))}
                {markers.map(({ s, y }) => {
                  const showLabel = y - lastLabelY >= LABEL_GAP_PX;
                  if (showLabel) lastLabelY = y;
                  const cls = markerCls(s);
                  return (
                    <span
                      key={siteKey(s)}
                      className={`${cls.marker} ${
                        s.approximate ? cls.markerApprox : ''
                      }`}
                      style={{ top: `${(y / px) * 100}%` }}
                      title={
                        s.approximate
                          ? `${writeDesc(s)} — approximate (region estimate)`
                          : s.computed
                            ? writeDesc(s)
                            : ''
                      }
                    >
                      {showLabel && (
                        <span className={cls.label}>
                          {s.approximate ? '≈' : ''}
                          {fmt(s.address)}
                        </span>
                      )}
                    </span>
                  );
                })}
                {px >= MIN_LABEL_PX && (
                  <>
                    <span className={styles.bandMain}>
                      <span className={styles.bandLabel}>{b.label}</span>
                      {detailed && (
                        <span className={styles.bandAddr}>
                          {fmt(b.start)} – {fmt(b.end)}
                        </span>
                      )}
                    </span>
                    {!detailed && (
                      <span className={styles.bandPct}>
                        {fraction.toFixed(1)}%
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showDetails && (
        <div
          className={`${styles.detailOverlay} ${
            selected ? '' : styles.detailOverlayEmpty
          }`}
        >
          <div className={styles.detail}>
            {selected ? (
              <>
                <h3 className={styles.detailTitle}>{selected.label}</h3>
                <dl className={styles.detailGrid}>
                  <dt>Range</dt>
                  <dd className={styles.mono}>
                    {fmt(selected.start)} – {fmt(selected.end)}
                  </dd>
                  <dt>Size</dt>
                  <dd className={styles.mono}>
                    {(selected.end - selected.start + 1).toLocaleString()} bytes
                  </dd>
                  <dt>Start</dt>
                  <dd className={styles.mono}>{readBack(selected.start)}</dd>
                </dl>
                {selected.leaves.length > 1 && (
                  <ul className={styles.leafList}>
                    {selected.leaves.map((r) => (
                      <li key={r.start}>
                        <span className={styles.mono}>{fmt(r.start)}</span>{' '}
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
                {selected.leaves.map(
                  (r) =>
                    r.note && (
                      <p key={r.start} className={styles.note}>
                        {selected.leaves.length > 1 ? `${r.label}: ` : ''}
                        {r.note}
                      </p>
                    ),
                )}
                {selectedWrites.length > 0 && (
                  <div className={styles.pokedBox}>
                    <h4 className={styles.pokedTitle}>
                      Your program writes here — read it back with:
                    </h4>
                    <ul className={styles.pokedList}>
                      {selectedWrites.map((s) => (
                        <li key={s.address} className={styles.mono}>
                          {s.approximate ? '≈ ' : ''}
                          {readBack(s.address)}
                          {s.computed ? (
                            <span className={styles.pokedExpr}>
                              {' '}
                              · {s.expr}
                            </span>
                          ) : (
                            ''
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className={styles.pokedCaveat}>
                      Computed addresses show the first value a loop or variable
                      resolves to. A “≈” marks an approximate base for writes
                      whose address is worked out at runtime — the region is
                      right, the exact byte may not be.
                    </p>
                  </div>
                )}
                {selectedLoads.length > 0 && (
                  <div className={styles.pokedBox}>
                    <h4 className={styles.pokedTitle}>
                      Your program loads binary code here:
                    </h4>
                    <ul className={styles.pokedList}>
                      {selectedLoads.map((s) => (
                        <li key={s.address} className={styles.mono}>
                          {s.approximate ? '≈ ' : ''}
                          {fmt(s.address)}
                          <span className={styles.pokedExpr}> · {s.expr}</span>
                        </li>
                      ))}
                    </ul>
                    <p className={styles.pokedCaveat}>
                      A “≈” marks a load whose target isn’t given in the
                      statement (it comes from the file) — the address shown is
                      an approximate base.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className={styles.empty}>
                Select a region to see its start address and how to read it
                back.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
