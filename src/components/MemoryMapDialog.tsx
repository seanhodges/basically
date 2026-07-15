import { useMemo, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { pokeAddresses } from '../editor/pokeAddresses';
import type { MemoryRegion } from '../dialects/types';
import { memoryBands, type Band } from './memoryBands';
import dialog from './Dialog.module.css';
import styles from './MemoryMapDialog.module.css';

/**
 * View ▸ Memory map - a colour-coded picture of the target machine's address
 * space. It opens zoomed out (major region groups, labels only) and zooms
 * vertically to reveal sub-regions and addresses. Regions the current program
 * POKEs a literal address into are highlighted; selecting one shows the address
 * in the decimal form a matching PEEK would need.
 *
 * The map is drawn as data-driven DOM bands (one element per visible region) so
 * a future update can light up the regions a running emulator is touching using
 * the same per-region highlight hook, without changing how it is rendered.
 */

/** Zoom multiplier bounds and the point at which detail (leaves + addresses) appears. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const DETAIL_ZOOM = 1.75;
/** Pixels-per-byte at zoom 1, and the smallest a band may shrink to. */
const PX_PER_BYTE = 0.0055;
const MIN_BAND_PX = 26;

const hex = (addr: number) =>
  `&${addr.toString(16).toUpperCase().padStart(4, '0')}`;

export function MemoryMapDialog() {
  const open = useIdeStore((s) => s.memoryMapOpen);
  const setOpen = useIdeStore((s) => s.setMemoryMapOpen);
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);

  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const map = dialect.memoryMap;
  const hasPoke = dialect.keywords.some((k) => k.word === 'POKE');

  // Literal addresses the current program POKEs, and the set of leaf regions any
  // of them fall in (the highlight). Only computed for dialects that have POKE.
  const poked = useMemo(
    () => (map && hasPoke ? pokeAddresses(source) : []),
    [map, hasPoke, source],
  );
  const pokedInRegion = (r: MemoryRegion) =>
    poked.filter((a) => a >= r.start && a <= r.end);

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

  if (!open || !map) return null;

  const nudge = (delta: number) => setZoom((z) => clampZoom(z + delta));
  const totalBytes = map.addressSpace;
  const bandHeight = (b: Band) =>
    Math.max(MIN_BAND_PX, (b.end - b.start + 1) * PX_PER_BYTE * zoom);

  const selected = bands.find((b) => b.key === selectedKey) ?? null;
  const selectedPoked = selected
    ? selected.leaves.flatMap((r) => pokedInRegion(r)).sort((a, b) => a - b)
    : [];

  return (
    <div className={dialog.modalBackdrop} onClick={() => setOpen(false)}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Memory map — {dialect.name}</h2>
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

        <p className={styles.hint}>
          Pinch, or Ctrl/⌘-scroll, to zoom in for sub-regions and addresses.
          {poked.length > 0
            ? ' Highlighted bands are POKEd by your program.'
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
                const isPoked =
                  poked.length > 0 &&
                  b.leaves.some((r) => pokedInRegion(r).length > 0);
                const fraction = ((b.end - b.start + 1) / totalBytes) * 100;
                return (
                  <button
                    key={b.key}
                    type="button"
                    className={`${styles.band} ${styles[b.kind]} ${
                      b.key === selectedKey ? styles.selected : ''
                    } ${isPoked ? styles.poked : ''}`}
                    style={{ height: `${bandHeight(b)}px` }}
                    onClick={() => setSelectedKey(b.key)}
                    title={`${hex(b.start)}–${hex(b.end)} ${b.label}`}
                  >
                    <span className={styles.bandMain}>
                      <span className={styles.bandLabel}>{b.label}</span>
                      {detailed && (
                        <span className={styles.bandAddr}>
                          {hex(b.start)} – {hex(b.end)}
                        </span>
                      )}
                    </span>
                    {isPoked && <span className={styles.badge}>POKE</span>}
                    <span className={styles.bandPct}>
                      {fraction.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.detail}>
            {selected ? (
              <>
                <h3 className={styles.detailTitle}>{selected.label}</h3>
                <dl className={styles.detailGrid}>
                  <dt>Range</dt>
                  <dd className={styles.mono}>
                    {hex(selected.start)} – {hex(selected.end)}
                  </dd>
                  <dt>Decimal</dt>
                  <dd className={styles.mono}>
                    {selected.start} – {selected.end}
                  </dd>
                  <dt>Size</dt>
                  <dd className={styles.mono}>
                    {(selected.end - selected.start + 1).toLocaleString()} bytes
                  </dd>
                  <dt>Start</dt>
                  <dd className={styles.mono}>PEEK {selected.start}</dd>
                </dl>
                {selected.leaves.length > 1 && (
                  <ul className={styles.leafList}>
                    {selected.leaves.map((r) => (
                      <li key={r.start}>
                        <span className={styles.mono}>{hex(r.start)}</span>{' '}
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
                {selectedPoked.length > 0 && (
                  <div className={styles.pokedBox}>
                    <h4 className={styles.pokedTitle}>
                      Your program POKEs here — read it back with:
                    </h4>
                    <ul className={styles.pokedList}>
                      {selectedPoked.map((a) => (
                        <li key={a} className={styles.mono}>
                          PEEK {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className={styles.empty}>
                Select a region to see its start address and the value to use in
                a PEEK.
              </p>
            )}
          </div>
        </div>

        <div className={dialog.modalActions}>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
