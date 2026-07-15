import { ActivityRenderer, type RendererDims } from './activityRenderer';
import type { FromWorker, ToWorker } from './messages';

/**
 * Off-main-thread half of the memory-activity overlay. Owns the OffscreenCanvas
 * transferred from the panel and an {@link ActivityRenderer}, and runs its own
 * animation loop so the decay + drawing never steal from the emulator's frame
 * budget on the main thread. The main thread only drains the emulator's activity
 * buffer and transfers it here; everything visual happens in this worker.
 *
 * `self` is cast to a minimal worker shape so the file compiles under the DOM
 * lib (the project's single tsconfig) without pulling in the WebWorker lib, which
 * would clash with the DOM globals. `requestAnimationFrame`/`cancelAnimationFrame`
 * come from the DOM lib but resolve to the worker's own at runtime.
 */
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  close(): void;
};

let canvas: OffscreenCanvas | null = null;
let renderer: ActivityRenderer | null = null;
let raf = 0;

/** Match the OffscreenCanvas backing store to the panel's device pixels. Only
 *  the worker can resize it once transferControlToOffscreen has handed it over. */
const sizeCanvas = (dims: RendererDims) => {
  if (!canvas) return;
  canvas.width = Math.max(1, Math.round(dims.width * dims.dpr));
  canvas.height = Math.max(1, Math.round(dims.height * dims.dpr));
};

const loop = () => {
  renderer?.step();
  raf = requestAnimationFrame(loop);
};

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init': {
      canvas = msg.canvas;
      sizeCanvas(msg.dims);
      const c2d = canvas.getContext('2d');
      if (!c2d) return;
      renderer = new ActivityRenderer(c2d, msg.geometry, msg.dims);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      break;
    }
    case 'geometry': {
      sizeCanvas(msg.dims);
      renderer?.setGeometry(msg.geometry, msg.dims);
      break;
    }
    case 'activity': {
      renderer?.ingest(msg.hits);
      // Hand the buffer straight back so the panel can reuse it (ping-pong pool).
      ctx.postMessage({ type: 'recycle', hits: msg.hits }, [msg.hits.buffer]);
      break;
    }
    case 'dispose': {
      cancelAnimationFrame(raf);
      renderer = null;
      canvas = null;
      ctx.close();
      break;
    }
  }
};
