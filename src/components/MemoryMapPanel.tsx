import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIdeStore, selectActiveSource } from '../app/store';
import type { MachineEmulator } from '../dialects/types';
import type { PokeSite } from '../editor/pokeAddresses';
import {
  resolveWriteSites,
  writesByIndirection,
} from '../app/memoryWriteSites';
import { MemoryMapView, type Notation } from './MemoryMapView';
import {
  backingDpr,
  layoutHeight,
  type BandGeometry,
} from './memoryActivity/bandLayout';
import { useMemoryActivity } from './memoryActivity/useMemoryActivity';
import { EyeIcon, EyeOffIcon } from './icons';
import styles from './MemoryMapPanel.module.css';

/**
 * View ▸ Memory map - a colour-coded picture of the target machine's address
 * space. It docks in the right-hand column alongside the emulator preview and
 * the AI assistant (and takes over that slot when open), rather than floating as
 * a modal. It opens zoomed out (major region groups, labels only) and zooms
 * vertically to reveal sub-regions, an address scale, and the exact byte a
 * program POKEs. Each POKE is drawn as an amber line at its address inside the
 * region; addresses the program computes from variables/expressions are resolved
 * too (including `USR "a"` UDG calls), and any that land outside the machine's
 * memory are called out at the top. Where a program loads binary code
 * (`LOAD "" CODE` / `LOAD "",dev,1`) the address is drawn the same way but in
 * blue - exact when the statement gives one, otherwise an approximate base.
 *
 * Addresses read out in hex or as plain integers via the notation toggle.
 *
 * This file is the IDE half: the store wiring, the program's write analysis, the
 * controls, and the live memory-activity canvas. The picture itself is
 * {@link MemoryMapView}, which the porting guide also renders - twice, side by
 * side - so a reader can compare two machines' layouts. Anything that belongs to
 * the map rather than to this panel belongs there; anything that reaches the
 * store, the editor's analysis or an emulator has to stay here, because the
 * documentation bundle may not import those (see machinePickerBoundary.test.ts).
 */

/** Zoom multiplier bounds. The detail threshold lives with the view that applies it. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

/** Stable no-op machine accessor for when the panel is rendered without one. */
const nullMachine = (): MachineEmulator | null => null;

interface Props {
  /** Accessor for the live emulator, used to record and drain memory activity.
   *  Absent (or returning null) simply leaves the overlay dark. */
  getMachine?: () => MachineEmulator | null;
}

export function MemoryMapPanel({ getMachine }: Props = {}) {
  const setOpen = useIdeStore((s) => s.setMemoryMapOpen);
  const dialect = useIdeStore((s) => s.dialect);
  // The buffer on screen: the map answers "what does this code POKE", and
  // while a scratch buffer is showing that is the snippet, not the document.
  const source = useIdeStore(selectActiveSource);

  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [notation, setNotation] = useState<Notation>(
    dialect.addressNotation ?? 'hex',
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const map = dialect.memoryMap;

  const byIndirection = writesByIndirection(dialect);

  /** How the out-of-range warning describes a site. */
  const writeDesc = (s: PokeSite) =>
    s.role === 'load' ? s.expr : byIndirection ? s.expr : `POKE ${s.expr}`;

  // The memory writes the current program makes, resolved exactly as the
  // porting guide resolves them, so a marker means the same thing in both.
  const { inRange, outOfRange } = useMemo(
    () => resolveWriteSites(source, dialect),
    [source, dialect],
  );

  // --- Zoom, with the scroll centre held ---------------------------------
  // The scrolling column lives inside the view, so the anchor is kept as a
  // fraction of the content and applied through the view's controlled scroll
  // offset: capture what is centred now, and once the bands have re-laid out at
  // the new zoom, ask for the offset that centres it again.
  const [scrollTop, setScrollTop] = useState(0);
  const viewport = useRef({ height: 0, content: 0 });
  const zoomAnchor = useRef<number | null>(null);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  /** Capture the current centre, then apply a zoom change (number or updater);
   *  the layout effect below restores the centre once the bands re-lay out. */
  const changeZoom = useCallback((next: number | ((z: number) => number)) => {
    const { height, content } = viewport.current;
    zoomAnchor.current =
      content > height ? (scrollTopRef.current + height / 2) / content : null;
    setZoom((z) => clampZoom(typeof next === 'function' ? next(z) : next));
  }, []);

  // The live scroll offset, read by changeZoom without making it depend on it.
  const scrollTopRef = useRef(0);
  const onScrollChange = useCallback((top: number) => {
    scrollTopRef.current = top;
    setScrollTop(top);
  }, []);

  // --- Live memory-activity overlay -------------------------------------
  // A canvas layered over the band column, driven by the running emulator's
  // read/write activity (teal = read, coral = write, fading over ~0.5s). The
  // geometry comes from the view, so the overlay registers with the bands it
  // actually drew; the hook records only while this panel is mounted (i.e. the
  // map is on screen).
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const [geometry, setGeometry] = useState<BandGeometry[]>([]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const column = el.querySelector('[class*="mapScroll"]');
      setMapWidth(column ? column.clientWidth : el.clientWidth);
      viewport.current.height = column ? column.clientHeight : el.clientHeight;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onGeometry = useCallback((g: BandGeometry[]) => {
    setGeometry(g);
    viewport.current.content = layoutHeight(g);
  }, []);

  // Once the bands have re-laid out at the new zoom, re-centre on what was
  // centred before it. Keyed on the geometry, which is what changes when the
  // layout does.
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    if (anchor === null) return;
    zoomAnchor.current = null;
    const { height, content } = viewport.current;
    const next = Math.max(0, anchor * content - height / 2);
    scrollTopRef.current = next;
    setScrollTop(next);
  }, [geometry]);

  const dims = useMemo(() => {
    const width = mapWidth;
    const height = layoutHeight(geometry);
    const rawDpr =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    // Cap the effective DPR so a tall zoomed-in column never blows past the
    // browser's max canvas backing-store size, which would blank the overlay.
    return { width, height, dpr: backingDpr(width, height, rawDpr) };
  }, [mapWidth, geometry]);
  useMemoryActivity(getMachine ?? nullMachine, canvasRef, geometry, dims);

  if (!map) return null;

  const nudge = (delta: number) => changeZoom((z) => z + delta);
  const totalBytes = map.addressSpace;

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
            onClick={() => nudge(-2)}
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
            step={1}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            title="Zoom"
            aria-label="Zoom level"
          />
          <button
            className={styles.zoomBtn}
            onClick={() => nudge(2)}
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
            ? `${writeDesc(outOfRange[0]!)} resolves to ${outOfRange[0]!.address}, which is outside this machine's ${totalBytes.toLocaleString()}-byte memory and isn't shown.`
            : `Some addresses your program writes to fall outside this machine's ${totalBytes.toLocaleString()}-byte memory and aren't shown.`}
        </p>
      )}

      <p className={styles.hint}>
        Pinch, or Ctrl/⌘-scroll, to zoom in for sub-regions and an address
        scale.
        {inRange.some((s) => s.role !== 'load')
          ? ' Each amber line marks an address your program writes to.'
          : ''}
        {inRange.some((s) => s.role === 'load')
          ? ' A blue line marks where your program loads binary code.'
          : ''}
        {inRange.some((s) => s.endAddress !== undefined)
          ? ' A shaded band shows the range a loop writes to, from its start to' +
            ' its end address.'
          : ''}
      </p>

      <div ref={hostRef} className={styles.viewHost}>
        <MemoryMapView
          map={map}
          zoom={zoom}
          notation={notation}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          showDetails={showDetails}
          sites={inRange}
          byIndirection={byIndirection}
          scrollTop={scrollTop}
          onScrollChange={onScrollChange}
          onGeometry={onGeometry}
          onZoomGesture={changeZoom}
          overlay={
            <canvas
              ref={canvasRef}
              className={styles.activityCanvas}
              aria-hidden="true"
            />
          }
        />
      </div>
    </div>
  );
}
