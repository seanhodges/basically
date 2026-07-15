import { useEffect, useRef, type RefObject } from 'react';
import type { MachineEmulator } from '../../dialects/types';
import { ActivityRenderer, type RendererDims } from './activityRenderer';
import type { BandGeometry } from './bandLayout';
import type { FromWorker, ToWorker } from './messages';

type Mode =
  | { kind: 'worker'; worker: Worker }
  | { kind: 'main'; renderer: ActivityRenderer; canvas: HTMLCanvasElement }
  | { kind: 'none' };

/** How long to wait, on unmount, before tearing the worker down - long enough to
 *  bridge React StrictMode's dev remount (setup runs again and reclaims it). */
const DISPOSE_DELAY_MS = 100;

const backingSize = (dims: RendererDims) => ({
  w: Math.max(1, Math.round(dims.width * dims.dpr)),
  h: Math.max(1, Math.round(dims.height * dims.dpr)),
});

/**
 * Drives the live memory-activity overlay for the Memory Map panel. While the
 * panel is mounted it arms the running machine's activity recording, drains the
 * touched-address buffer once per animation frame, and ships it (zero-copy
 * transfer) to a Web Worker that decays and draws the teal/coral lines onto an
 * OffscreenCanvas - so the emulator's frame budget on the main thread is never
 * spent on the visualization. Browsers without OffscreenCanvas/Worker fall back
 * to an identical renderer on the main thread.
 *
 * Recording is armed on mount and disarmed on unmount; because the panel only
 * exists in the DOM while the map is open, nothing is recorded when it is hidden.
 */
export function useMemoryActivity(
  getMachine: () => MachineEmulator | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  geometry: BandGeometry[],
  dims: RendererDims,
): void {
  const geometryRef = useRef(geometry);
  const dimsRef = useRef(dims);
  // Keep the latest layout available to the (once-only) setup effect and loop.
  geometryRef.current = geometry;
  dimsRef.current = dims;

  const modeRef = useRef<Mode | null>(null);
  const rafRef = useRef(0);
  const spareRef = useRef<Uint8Array | null>(null);
  const armedRef = useRef<MachineEmulator | null>(null);
  const disposeTimerRef = useRef<number | null>(null);

  // Setup + per-frame drain loop. Runs once per mount; the render target is
  // built lazily and persists across StrictMode's dev remount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A StrictMode remount: cancel the pending teardown and reuse the worker.
    if (disposeTimerRef.current !== null) {
      clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }

    if (!modeRef.current) {
      modeRef.current = createMode(
        canvas,
        geometryRef.current,
        dimsRef.current,
        spareRef,
      );
    }

    const tick = () => {
      const machine = getMachine();
      if (machine && machine !== armedRef.current) {
        machine.setMemoryActivityRecording?.(true);
        armedRef.current = machine;
      } else if (!machine) {
        armedRef.current = null;
      }

      const hits = machine?.drainMemoryActivity?.(spareRef.current) ?? null;
      spareRef.current = null;
      const mode = modeRef.current;
      if (hits && mode) {
        if (mode.kind === 'worker') {
          const msg: ToWorker = { type: 'activity', hits };
          mode.worker.postMessage(msg, [hits.buffer]);
        } else if (mode.kind === 'main') {
          mode.renderer.ingest(hits);
          spareRef.current = hits; // reuse next frame; no transfer on main thread
        }
      }
      if (mode?.kind === 'main') mode.renderer.step();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      // This is what makes recording truly stop when the panel is hidden.
      armedRef.current?.setMemoryActivityRecording?.(false);
      armedRef.current = null;
      disposeTimerRef.current = window.setTimeout(() => {
        teardown(modeRef.current);
        modeRef.current = null;
        disposeTimerRef.current = null;
      }, DISPOSE_DELAY_MS);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resync the renderer to a new band layout / size / DPR.
  useEffect(() => {
    const mode = modeRef.current;
    if (!mode) return;
    if (mode.kind === 'worker') {
      const msg: ToWorker = { type: 'geometry', geometry, dims };
      mode.worker.postMessage(msg);
    } else if (mode.kind === 'main') {
      const { w, h } = backingSize(dims);
      mode.canvas.width = w;
      mode.canvas.height = h;
      mode.renderer.setGeometry(geometry, dims);
    }
  }, [geometry, dims]);
}

function createMode(
  canvas: HTMLCanvasElement,
  geometry: BandGeometry[],
  dims: RendererDims,
  spareRef: { current: Uint8Array | null },
): Mode {
  const canWorker =
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof canvas.transferControlToOffscreen === 'function';
  if (canWorker) {
    try {
      const offscreen = canvas.transferControlToOffscreen();
      const worker = new Worker(
        new URL('./memoryActivityWorker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (e.data?.type === 'recycle') spareRef.current = e.data.hits;
      };
      const init: ToWorker = {
        type: 'init',
        canvas: offscreen,
        geometry,
        dims,
      };
      worker.postMessage(init, [offscreen]);
      return { kind: 'worker', worker };
    } catch {
      // transferControlToOffscreen can throw (already transferred, unsupported);
      // fall through to the main-thread renderer.
    }
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { kind: 'none' };
  const { w, h } = backingSize(dims);
  canvas.width = w;
  canvas.height = h;
  return {
    kind: 'main',
    renderer: new ActivityRenderer(ctx, geometry, dims),
    canvas,
  };
}

function teardown(mode: Mode | null): void {
  if (mode?.kind === 'worker') {
    const dispose: ToWorker = { type: 'dispose' };
    mode.worker.postMessage(dispose);
    mode.worker.terminate();
  }
}
