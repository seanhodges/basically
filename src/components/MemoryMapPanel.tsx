import { useMemo, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { pokeSites, type PokeSite } from '../editor/pokeAddresses';
import { memoryBands, type Band } from './memoryBands';
import { addressTicks } from './memoryScale';
import { EyeIcon, EyeOffIcon } from './icons';
import styles from './MemoryMapPanel.module.css';

/**
 * View ▸ Memory map - a colour-coded picture of the target machine's address
 * space. It docks in the right-hand column alongside the emulator preview and
 * the AI assistant (and takes over that slot when open), rather than floating as
 * a modal. It opens zoomed out (major region groups, labels only) and zooms
 * vertically to reveal sub-regions, an address scale, and the exact byte a
 * program POKEs. Each POKE is drawn as a line at its address inside the region;
 * addresses the program computes from variables/expressions are resolved too
 * (including `USR "a"` UDG calls), and any that land outside the machine's
 * memory are called out at the top.
 *
 * Addresses read out in hex or as plain integers via the notation toggle. The
 * map is drawn as data-driven DOM bands (one element per visible region) so a
 * future update can light up the regions a running emulator is touching, without
 * changing how it is rendered.
 */

/** Zoom multiplier bounds and the point at which detail (leaves + addresses) appears. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const DETAIL_ZOOM = 1.75;
/** Pixels-per-byte at zoom 1, and the smallest a band may shrink to. */
const PX_PER_BYTE = 0.0055;
const MIN_BAND_PX = 26;
/** Hide a POKE marker's address label if it would sit within this many pixels
 * of the last shown one (small regions clamp to MIN_BAND_PX, so labels crowd). */
const LABEL_GAP_PX = 12;

type Notation = 'hex' | 'dec';

const hexAddr = (addr: number) =>
  `&${addr.toString(16).toUpperCase().padStart(4, '0')}`;

export function MemoryMapPanel() {
  const setOpen = useIdeStore((s) => s.setMemoryMapOpen);
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);

  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [notation, setNotation] = useState<Notation>('hex');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const map = dialect.memoryMap;
  const hasPoke = dialect.keywords.some((k) => k.word === 'POKE');

  /** Format an address in the currently-selected notation. */
  const fmt = (addr: number) =>
    notation === 'hex' ? hexAddr(addr) : `${addr}`;

  // The POKEs the current program makes, de-duplicated by address and split into
  // those that land in the machine's memory (drawn as markers) and those that
  // resolve out of range (surfaced as a warning). Only for dialects with POKE.
  const { inRange, outOfRange } = useMemo(() => {
    const seen = new Map<number, PokeSite>();
    if (map && hasPoke)
      for (const s of pokeSites(source, { udgBase: map.udgBase })) {
        // Prefer an exact site over an approximate one at the same address.
        const prev = seen.get(s.address);
        if (!prev || (prev.approximate && !s.approximate))
          seen.set(s.address, s);
      }
    const within: PokeSite[] = [];
    const beyond: PokeSite[] = [];
    for (const s of seen.values()) {
      const inSpace = !!map && s.address >= 0 && s.address < map.addressSpace;
      if (s.approximate) {
        // An approximate address is only a best-effort base, so show it only
        // where it plausibly points at RAM: in range, non-zero, and not in a
        // ROM region (a POKE there would be a no-op). Otherwise drop it
        // silently - no out-of-range warning for a guessed base.
        const kind = map?.regions.find(
          (r) => s.address >= r.start && s.address <= r.end,
        )?.kind;
        if (inSpace && s.address !== 0 && kind !== 'rom') within.push(s);
      } else if (inSpace) {
        within.push(s);
      } else {
        beyond.push(s);
      }
    }
    within.sort((a, b) => a.address - b.address);
    beyond.sort((a, b) => a.address - b.address);
    return { inRange: within, outOfRange: beyond };
  }, [map, hasPoke, source]);

  const sitesInRegion = (start: number, end: number) =>
    inRange.filter((s) => s.address >= start && s.address <= end);

  const detailed = zoom >= DETAIL_ZOOM;
  const bands = useMemo(
    () => (map ? memoryBands(map, detailed) : []),
    [map, detailed],
  );

  // --- Pinch / wheel zoom ------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

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
    if (pointers.current.size === 2 && pinch.current) {
      const dist = pointerDist();
      if (pinch.current.dist > 0) {
        setZoom(clampZoom((pinch.current.zoom * dist) / pinch.current.dist));
      }
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
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.01));
  };

  if (!map) return null;

  const nudge = (delta: number) => setZoom((z) => clampZoom(z + delta));
  const totalBytes = map.addressSpace;
  const bandHeight = (b: Band) =>
    Math.max(MIN_BAND_PX, (b.end - b.start + 1) * PX_PER_BYTE * zoom);

  const selected = bands.find((b) => b.key === selectedKey) ?? null;
  const selectedSites = selected
    ? sitesInRegion(selected.start, selected.end)
    : [];

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <strong>Memory map</strong>
        <button
          className="linklike"
          onClick={() => setOpen(false)}
          title="Close memory map"
          aria-label="Close memory map"
        >
          ✕
        </button>
      </div>

      <div className={styles.controls}>
        <button
          className={`icon-btn ${styles.detailsToggle} ${
            showDetails ? 'active' : ''
          }`}
          onClick={() => setShowDetails((v) => !v)}
          aria-pressed={showDetails}
          title={showDetails ? 'Hide details' : 'Show details'}
          aria-label={showDetails ? 'Hide details' : 'Show details'}
        >
          <span className={styles.detailsIcon} aria-hidden="true">
            {showDetails ? <EyeOffIcon /> : <EyeIcon />}
          </span>
          <span className={styles.detailsText}>
            {showDetails ? 'Hide Details' : 'Show Details'}
          </span>
        </button>
        <div
          className={styles.notation}
          role="group"
          aria-label="Address notation"
        >
          <button
            className={notation === 'hex' ? styles.notationOn : ''}
            onClick={() => setNotation('hex')}
            aria-pressed={notation === 'hex'}
          >
            Hex
          </button>
          <button
            className={notation === 'dec' ? styles.notationOn : ''}
            onClick={() => setNotation('dec')}
            aria-pressed={notation === 'dec'}
          >
            Int
          </button>
        </div>
        <div className={styles.zoom}>
          <button
            className={styles.zoomBtn}
            onClick={() => nudge(-0.5)}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            className={styles.zoomSlider}
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
            title="Zoom"
            aria-label="Zoom level"
          />
          <button
            className={styles.zoomBtn}
            onClick={() => nudge(0.5)}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {outOfRange.length > 0 && (
        <p className={styles.warning}>
          {outOfRange.length === 1
            ? `POKE ${outOfRange[0]!.expr} resolves to ${outOfRange[0]!.address}, which is outside this machine's ${totalBytes.toLocaleString()}-byte memory and isn't shown.`
            : `Some POKE addresses in your program fall outside this machine's ${totalBytes.toLocaleString()}-byte memory and aren't shown.`}
        </p>
      )}

      <p className={styles.hint}>
        Pinch, or Ctrl/⌘-scroll, to zoom in for sub-regions and an address
        scale.
        {inRange.length > 0
          ? ' Each line marks an address your program POKEs.'
          : ''}
        {inRange.some((s) => s.endAddress !== undefined)
          ? ' A shaded band shows the range a loop POKEs, from its start to its' +
            ' end address.'
          : ''}
      </p>

      <div className={styles.body}>
        <div
          className={styles.mapScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={onWheel}
        >
          <div className={styles.map}>
            {bands.map((b) => {
              const px = bandHeight(b);
              const span = b.end - b.start + 1;
              const markers = sitesInRegion(b.start, b.end).map((s) => ({
                s,
                y: ((s.address - b.start) / span) * px,
              }));
              // Loop-range POKEs that overlap this band, by their full [lo, hi]
              // span (not just the start marker) so a range spanning several
              // bands shades each one it passes through.
              const ranges = inRange
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
                  style={{ height: `${px}px` }}
                  onClick={() => setSelectedKey(b.key)}
                  title={`${fmt(b.start)}–${fmt(b.end)} ${b.label}`}
                >
                  {ranges.map(({ s, lo, hi }) => {
                    // Clamp the fill to this band; +1 on the far edge covers the
                    // end byte's own row so the shading reaches the last address.
                    const top = ((Math.max(lo, b.start) - b.start) / span) * px;
                    const bottom =
                      ((Math.min(hi, b.end) + 1 - b.start) / span) * px;
                    return (
                      <span
                        key={`f${s.address}`}
                        className={`${styles.pokeFill} ${
                          s.approximate ? styles.pokeFillApprox : ''
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
                      return (
                        <span
                          key={`e${s.address}`}
                          className={`${styles.pokeMarker} ${
                            s.approximate ? styles.pokeMarkerApprox : ''
                          }`}
                          style={{ top: `${(y / px) * 100}%` }}
                          title={`POKE ${s.expr} — range end ${fmt(
                            s.endAddress!,
                          )}`}
                        >
                          {showLabel && (
                            <span className={styles.pokeLabel}>
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
                    return (
                      <span
                        key={s.address}
                        className={`${styles.pokeMarker} ${
                          s.approximate ? styles.pokeMarkerApprox : ''
                        }`}
                        style={{ top: `${(y / px) * 100}%` }}
                        title={
                          s.approximate
                            ? `POKE ${s.expr} — approximate (region estimate)`
                            : s.computed
                              ? `POKE ${s.expr}`
                              : ''
                        }
                      >
                        {showLabel && (
                          <span className={styles.pokeLabel}>
                            {s.approximate ? '≈' : ''}
                            {fmt(s.address)}
                          </span>
                        )}
                      </span>
                    );
                  })}
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
                </button>
              );
            })}
          </div>
        </div>

        {showDetails && (
          <div className={styles.detailOverlay}>
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
                      {(selected.end - selected.start + 1).toLocaleString()}{' '}
                      bytes
                    </dd>
                    <dt>Start</dt>
                    <dd className={styles.mono}>PEEK {selected.start}</dd>
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
                  {selectedSites.length > 0 && (
                    <div className={styles.pokedBox}>
                      <h4 className={styles.pokedTitle}>
                        Your program POKEs here — read it back with:
                      </h4>
                      <ul className={styles.pokedList}>
                        {selectedSites.map((s) => (
                          <li key={s.address} className={styles.mono}>
                            {s.approximate ? '≈ ' : ''}PEEK {s.address}
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
                        Computed addresses show the first value a loop or
                        variable resolves to. A “≈” marks an approximate base
                        for POKEs whose address is worked out at runtime — the
                        region is right, the exact byte may not be.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className={styles.empty}>
                  Select a region to see its start address and the value to use
                  in a PEEK.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
