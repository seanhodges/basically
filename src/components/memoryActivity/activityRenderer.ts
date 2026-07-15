import { READ_BIT, WRITE_BIT } from '../../emulator/memoryActivityBuffer';
import { addrToY, layoutHeight, type BandGeometry } from './bandLayout';

/** Read accesses light up teal. */
export const READ_COLOR = '#00A896';
/** Write accesses light up coral. */
export const WRITE_COLOR = '#F05D5E';

/** Below this intensity a row is treated as dark and skipped. */
const MIN_INTENSITY = 0.02;

/**
 * A hit lights the rows spanned by the whole group of addresses it falls in,
 * not just its own row. Trades address precision for thicker, more legible
 * lines that stay visible without zooming right in.
 */
const ADDRESSES_PER_LINE = 10;

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
 * a group-to-row-span lookup, so `ingest` lights the rows of the touched
 * address's group and `step` touches only lit rows. Deliberately free of any
 * DOM/worker specifics: the same instance drives the worker's OffscreenCanvas
 * and the main-thread fallback.
 */
export class ActivityRenderer {
  private widthPx = 0;
  private heightPx = 0;
  private readInt = new Float32Array(0);
  private writeInt = new Float32Array(0);
  /**
   * For each group of `ADDRESSES_PER_LINE` addresses, the first and last
   * device-pixel row it covers (inclusive), or -1 when no address in the group
   * lands on the map. A hit lights every row in `[lo, hi]`.
   */
  private groupRowLo = new Int32Array(0);
  private groupRowHi = new Int32Array(0);

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
   * Rebuild the intensity arrays and group-to-row-span lookup for a new band
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
    const groupCount = Math.ceil(addressSpace / ADDRESSES_PER_LINE);
    this.groupRowLo = new Int32Array(groupCount).fill(-1);
    this.groupRowHi = new Int32Array(groupCount).fill(-1);
    for (let addr = 0; addr < addressSpace; addr++) {
      const y = addrToY(geometry, addr);
      if (y === null) continue;
      const row = Math.min(this.heightPx - 1, (y * dims.dpr) | 0);
      const g = (addr / ADDRESSES_PER_LINE) | 0;
      const lo = this.groupRowLo[g]!;
      if (lo < 0 || row < lo) this.groupRowLo[g] = row;
      if (row > this.groupRowHi[g]!) this.groupRowHi[g] = row;
    }
  }

  /**
   * Fold a drained activity snapshot into the intensity arrays: each touched
   * address lights the rows of its `ADDRESSES_PER_LINE`-address group to full
   * intensity for its access kind.
   */
  ingest(hits: Uint8Array): void {
    const { groupRowLo, groupRowHi, readInt, writeInt } = this;
    const n = hits.length;
    for (let addr = 0; addr < n; addr++) {
      const bits = hits[addr]!;
      if (bits === 0) continue;
      const g = (addr / ADDRESSES_PER_LINE) | 0;
      if (g >= groupRowLo.length) break;
      const lo = groupRowLo[g]!;
      if (lo < 0) continue;
      const hi = groupRowHi[g]!;
      if (bits & READ_BIT) for (let r = lo; r <= hi; r++) readInt[r] = 1;
      if (bits & WRITE_BIT) for (let r = lo; r <= hi; r++) writeInt[r] = 1;
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
