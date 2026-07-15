import type { BandGeometry } from './bandLayout';
import type { RendererDims } from './activityRenderer';

/** Messages the panel sends to the memory-activity worker. */
export type ToWorker =
  | {
      type: 'init';
      canvas: OffscreenCanvas;
      geometry: BandGeometry[];
      dims: RendererDims;
    }
  | { type: 'geometry'; geometry: BandGeometry[]; dims: RendererDims }
  | { type: 'activity'; hits: Uint8Array }
  | { type: 'dispose' };

/** Messages the worker sends back to the panel. */
export type FromWorker = { type: 'recycle'; hits: Uint8Array };
