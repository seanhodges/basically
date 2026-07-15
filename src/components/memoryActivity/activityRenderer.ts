import { READ_BIT, WRITE_BIT } from '../../emulator/memoryActivityBuffer';
import { addrToY, layoutHeight, type BandGeometry } from './bandLayout';

/** Read accesses light up teal. */
export const READ_COLOR = '#00A896';
/** Write accesses light up coral. */
export const WRITE_COLOR = '#F05D5E';

/** Below this intensity a row is treated as dark and skipped. */
const MIN_INTENSITY = 0.02;

export interface RendererDims {
  /** CSS pixel width of the overlay. */
  width: number;
  /** CSS pixel height of the overlay (the stacked band column). */
  height: number;
  /** Device pixel ratio; the backing store is width*dpr x height*dpr. */
  dpr: number;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Turns per-frame memory-activity snapshots into fading teal (read) / coral
 * (write) lines on a canvas. Holds two per-device-pixel-row intensity arrays and
 * an address to row lookup, so `ingest` is one indexed store per touched address
 * and `step` touches only lit rows. Deliberately free of any DOM/worker
 * specifics: the same instance drives the worker's OffscreenCanvas and the
 * main-thread fallback.
 */
export class ActivityRenderer {
  private widthPx = 0;
  private heightPx = 0;
  private readInt = new Float32Array(0);
  private writeInt = new Float32Array(0);
  /** address -> device-pixel row, or -1 when the address is off the map. */
  private rowOf = new Int32Array(0);

  constructor(
    private readonly ctx: Ctx,
    geometry: BandGeometry[],
    dims: RendererDims,
    /** Per-frame decay multiplier (~0.9 fades a line out in ~0.5 s at 60 Hz). */
    private readonly fade = 0.9,
  ) {
    this.setGeometry(geometry, dims);
  }

  /**
   * Rebuild the intensity arrays and address to row lookup for a new band
   * layout / size / DPR. Lit rows reset (a one-frame blank on a decaying overlay
   * is imperceptible). Called on zoom, detail-level, resize and DPR changes.
   */
  setGeometry(geometry: BandGeometry[], dims: RendererDims): void {
    this.widthPx = Math.max(1, Math.round(dims.width * dims.dpr));
    this.heightPx = Math.max(1, Math.round(layoutHeight(geometry) * dims.dpr));
    this.readInt = new Float32Array(this.heightPx);
    this.writeInt = new Float32Array(this.heightPx);

    const addressSpace = geometry.length
      ? geometry[geometry.length - 1]!.end + 1
      : 0;
    this.rowOf = new Int32Array(addressSpace);
    for (let addr = 0; addr < addressSpace; addr++) {
      const y = addrToY(geometry, addr);
      const row =
        y === null ? -1 : Math.min(this.heightPx - 1, (y * dims.dpr) | 0);
      this.rowOf[addr] = row;
    }
  }

  /**
   * Fold a drained activity snapshot into the intensity arrays: each touched
   * address lights its mapped row to full intensity for its access kind.
   */
  ingest(hits: Uint8Array): void {
    const rowOf = this.rowOf;
    const n = Math.min(hits.length, rowOf.length);
    for (let addr = 0; addr < n; addr++) {
      const bits = hits[addr]!;
      if (bits === 0) continue;
      const row = rowOf[addr]!;
      if (row < 0) continue;
      if (bits & READ_BIT) this.readInt[row] = 1;
      if (bits & WRITE_BIT) this.writeInt[row] = 1;
    }
  }

  /** Decay every row, then redraw the lit ones. Call once per animation frame. */
  step(): void {
    const { readInt, writeInt, fade } = this;
    for (let i = 0; i < readInt.length; i++) {
      const r = readInt[i]! * fade;
      readInt[i] = r < MIN_INTENSITY ? 0 : r;
      const w = writeInt[i]! * fade;
      writeInt[i] = w < MIN_INTENSITY ? 0 : w;
    }
    this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.widthPx, this.heightPx);
    // Two passes so fillStyle is set once per colour. Writes last, so a row that
    // is both read and written reads as coral.
    this.paint(this.readInt, READ_COLOR);
    this.paint(this.writeInt, WRITE_COLOR);
    ctx.globalAlpha = 1;
  }

  private paint(intensity: Float32Array, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    for (let i = 0; i < intensity.length; i++) {
      const a = intensity[i]!;
      if (a === 0) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(0, i, this.widthPx, 1);
    }
  }
}
