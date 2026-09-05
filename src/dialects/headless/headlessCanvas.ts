import { deflateSync } from 'node:zlib';

/**
 * Enough of a 2D canvas for a `MachineEmulator.renderTo` to paint into under
 * node, plus a PNG encoder for the result.
 *
 * The seam hands a machine a `CanvasRenderingContext2D` and nothing else, so
 * the only way to see what a machine draws outside a browser is to supply one.
 * Several tests already stub two or three members each; this covers the whole
 * surface the machines actually use, which a grep over every `renderTo` puts
 * at nine members: `fillStyle`, `font`, `textBaseline`, `imageSmoothingEnabled`,
 * `createImageData`, `putImageData`, `drawImage`, `fillRect` and `fillText`.
 *
 * **Fidelity.** Everything but `fillText` is exact: the machines that paint
 * pixels hand over an RGBA buffer and this writes those bytes, so the result is
 * the same picture the browser would show. `fillText` is not exact and cannot
 * be - the machines that use it (the Apple 1, Altair, GE-235 and TRS-80
 * terminals, the Apple II text layer, and the missing-ROM notices) deliberately
 * draw through the *host's* font, which node has not got. Those glyphs come out
 * in the 5x7 font below instead: legible, positioned correctly, and a different
 * shape from what a browser draws. {@link HeadlessCanvas.hostFontGlyphs} counts
 * them so a caller can say which of the two it got.
 */

/** Canvas `ImageData`: a fixed-size RGBA buffer with its dimensions. */
export class HeadlessImageData {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parse the colour forms the machines actually set.
 *
 * Unknown forms throw rather than defaulting to black: a colour this cannot
 * read is a picture silently painted wrong, and a machine that grows one should
 * fail here where the reason is obvious.
 */
function parseColor(css: string): Rgba {
  const text = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1]!;
    const wide = digits.length === 6;
    const at = (i: number): number =>
      wide
        ? parseInt(digits.slice(i * 2, i * 2 + 2), 16)
        : parseInt(digits[i]! + digits[i]!, 16);
    return { r: at(0), g: at(1), b: at(2), a: 1 };
  }
  const fn = /^rgba?\(([^)]*)\)$/i.exec(text);
  if (fn) {
    const parts = fn[1]!.split(',').map((p) => Number(p.trim()));
    const [r, g, b, a] = parts;
    if (parts.length >= 3 && [r, g, b].every((n) => Number.isFinite(n))) {
      return { r: r!, g: g!, b: b!, a: parts.length > 3 ? (a ?? 1) : 1 };
    }
  }
  throw new Error(`headless canvas cannot read the colour ${css}`);
}

/**
 * A 5x7 stand-in for the host's monospace font, one row of five per group.
 *
 * Codes 0x20-0x7E; anything outside them draws nothing. Rows are the top seven
 * of an eight-row em box, so a descender row is left under the baseline.
 */
const GLYPH_ROWS = 7;
const GLYPH_COLS = 5;
const GLYPH_BOX = 8;
const FIRST_GLYPH = 0x20;

// prettier-ignore
const GLYPHS = [
  '..... ..... ..... ..... ..... ..... .....', // space
  '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..', // !
  '.#.#. .#.#. ..... ..... ..... ..... .....', // "
  '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.', // #
  '..#.. .#### #.#.. .###. ..#.# ####. ..#..', // $
  '##..# ##..# ...#. ..#.. .#... #..## #..##', // %
  '.##.. #..#. .##.. .##.# #..#. #..#. .##.#', // &
  '..#.. ..#.. ..... ..... ..... ..... .....', // '
  '...#. ..#.. .#... .#... .#... ..#.. ...#.', // (
  '.#... ..#.. ...#. ...#. ...#. ..#.. .#...', // )
  '..... #.#.# .###. ..#.. .###. #.#.# .....', // *
  '..... ..#.. ..#.. ##### ..#.. ..#.. .....', // +
  '..... ..... ..... ..... ..##. ..#.. .#...', // ,
  '..... ..... ..... ##### ..... ..... .....', // -
  '..... ..... ..... ..... ..... ..##. ..##.', // .
  '....# ...#. ..#.. ..#.. .#... #.... .....', // /
  '.###. #...# #..## #.#.# ##..# #...# .###.', // 0
  '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.', // 1
  '.###. #...# ....# ...#. ..#.. .#... #####', // 2
  '##### ...#. ..#.. ...#. ....# #...# .###.', // 3
  '...#. ..##. .#.#. #..#. ##### ...#. ...#.', // 4
  '##### #.... ####. ....# ....# #...# .###.', // 5
  '..##. .#... #.... ####. #...# #...# .###.', // 6
  '##### #...# ....# ...#. ..#.. ..#.. ..#..', // 7
  '.###. #...# #...# .###. #...# #...# .###.', // 8
  '.###. #...# #...# .#### ....# ...#. .##..', // 9
  '..... ..##. ..##. ..... ..##. ..##. .....', // :
  '..... ..##. ..##. ..... ..##. ..#.. .#...', // ;
  '...#. ..#.. .#... #.... .#... ..#.. ...#.', // <
  '..... ..... ##### ..... ##### ..... .....', // =
  '.#... ..#.. ...#. ....# ...#. ..#.. .#...', // >
  '.###. #...# ....# ...#. ..#.. ..... ..#..', // ?
  '.###. #...# ....# #.### #.#.# #.#.# .####', // @
  '..#.. .#.#. #...# #...# ##### #...# #...#', // A
  '####. #...# #...# ####. #...# #...# ####.', // B
  '.###. #...# #.... #.... #.... #...# .###.', // C
  '###.. #..#. #...# #...# #...# #..#. ###..', // D
  '##### #.... #.... ####. #.... #.... #####', // E
  '##### #.... #.... ####. #.... #.... #....', // F
  '.###. #...# #.... #.### #...# #...# .####', // G
  '#...# #...# #...# ##### #...# #...# #...#', // H
  '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', // I
  '..### ...#. ...#. ...#. ...#. #..#. .##..', // J
  '#...# #..#. #.#.. ##... #.#.. #..#. #...#', // K
  '#.... #.... #.... #.... #.... #.... #####', // L
  '#...# ##.## #.#.# #.#.# #...# #...# #...#', // M
  '#...# #...# ##..# #.#.# #..## #...# #...#', // N
  '.###. #...# #...# #...# #...# #...# .###.', // O
  '####. #...# #...# ####. #.... #.... #....', // P
  '.###. #...# #...# #...# #.#.# #..#. .##.#', // Q
  '####. #...# #...# ####. #.#.. #..#. #...#', // R
  '.###. #...# #.... .###. ....# #...# .###.', // S
  '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', // T
  '#...# #...# #...# #...# #...# #...# .###.', // U
  '#...# #...# #...# #...# #...# .#.#. ..#..', // V
  '#...# #...# #...# #.#.# #.#.# ##.## #...#', // W
  '#...# #...# .#.#. ..#.. .#.#. #...# #...#', // X
  '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', // Y
  '##### ....# ...#. ..#.. .#... #.... #####', // Z
  '.###. .#... .#... .#... .#... .#... .###.', // [
  '#.... .#... ..#.. ..#.. ...#. ....# .....', // \
  '.###. ...#. ...#. ...#. ...#. ...#. .###.', // ]
  '..#.. .#.#. #...# ..... ..... ..... .....', // ^
  '..... ..... ..... ..... ..... ..... #####', // _
  '.#... ..#.. ..... ..... ..... ..... .....', // `
  '..... ..... .###. ....# .#### #...# .####', // a
  '#.... #.... ####. #...# #...# #...# ####.', // b
  '..... ..... .###. #.... #.... #...# .###.', // c
  '....# ....# .#### #...# #...# #...# .####', // d
  '..... ..... .###. #...# ##### #.... .###.', // e
  '..##. .#..# .#... ###.. .#... .#... .#...', // f
  '..... .#### #...# #...# .#### ....# .###.', // g
  '#.... #.... ####. #...# #...# #...# #...#', // h
  '..#.. ..... .##.. ..#.. ..#.. ..#.. .###.', // i
  '...#. ..... ..##. ...#. ...#. #..#. .##..', // j
  '#.... #.... #..#. #.#.. ##... #.#.. #..#.', // k
  '.##.. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', // l
  '..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#', // m
  '..... ..... ####. #...# #...# #...# #...#', // n
  '..... ..... .###. #...# #...# #...# .###.', // o
  '..... ..... ####. #...# ####. #.... #....', // p
  '..... ..... .#### #...# .#### ....# ....#', // q
  '..... ..... #.##. ##..# #.... #.... #....', // r
  '..... ..... .#### #.... .###. ....# ####.', // s
  '.#... .#... ###.. .#... .#... .#..# ..##.', // t
  '..... ..... #...# #...# #...# #..## .##.#', // u
  '..... ..... #...# #...# #...# .#.#. ..#..', // v
  '..... ..... #...# #.#.# #.#.# #.#.# .#.#.', // w
  '..... ..... #...# .#.#. ..#.. .#.#. #...#', // x
  '..... ..... #...# #...# .#### ....# .###.', // y
  '..... ..... ##### ...#. ..#.. .#... #####', // z
  '...#. ..#.. ..#.. .#... ..#.. ..#.. ...#.', // {
  '..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', // |
  '.#... ..#.. ..#.. ...#. ..#.. ..#.. .#...', // }
  '..... ..#.# .#.#. #.#.. ..... ..... .....', // ~
].map((art) => {
  const bits = art.replace(/ /g, '');
  if (bits.length !== GLYPH_ROWS * GLYPH_COLS) {
    throw new Error(`glyph "${art}" is not ${GLYPH_ROWS}x${GLYPH_COLS}`);
  }
  return bits;
});

/** The 2D context a machine paints through. */
class HeadlessContext {
  fillStyle = '#000000';
  font = '10px monospace';
  textBaseline = 'alphabetic';
  textAlign = 'start';
  imageSmoothingEnabled = true;

  constructor(private readonly canvas: HeadlessCanvas) {}

  createImageData(width: number, height: number): HeadlessImageData {
    return new HeadlessImageData(width, height);
  }

  /**
   * Write an image's pixels over the canvas, replacing rather than blending -
   * `putImageData` ignores alpha compositing, and the machines rely on that to
   * paint an opaque frame over the last one.
   *
   * The seven-argument form copies only the dirty rectangle out of the source,
   * which is how the BBC repaints just the region jsbeeb touched.
   */
  putImageData(
    image: HeadlessImageData,
    dx: number,
    dy: number,
    dirtyX = 0,
    dirtyY = 0,
    dirtyWidth = image.width,
    dirtyHeight = image.height,
  ): void {
    const { width, height, rgba } = this.canvas;
    for (let row = 0; row < dirtyHeight; row++) {
      const sy = dirtyY + row;
      const ty = dy + sy;
      if (sy < 0 || sy >= image.height || ty < 0 || ty >= height) continue;
      for (let col = 0; col < dirtyWidth; col++) {
        const sx = dirtyX + col;
        const tx = dx + sx;
        if (sx < 0 || sx >= image.width || tx < 0 || tx >= width) continue;
        const from = (sy * image.width + sx) * 4;
        const to = (ty * width + tx) * 4;
        rgba[to] = image.data[from]!;
        rgba[to + 1] = image.data[from + 1]!;
        rgba[to + 2] = image.data[from + 2]!;
        rgba[to + 3] = image.data[from + 3]!;
      }
    }
  }

  /**
   * Blit a source canvas, scaling by nearest neighbour.
   *
   * Always nearest neighbour: every machine that draws this way sets
   * `imageSmoothingEnabled = false` first, because a machine's pixels are
   * square blocks and interpolating them is wrong at any size.
   */
  drawImage(source: HeadlessCanvas, ...args: number[]): void {
    let sx = 0;
    let sy = 0;
    let sw = source.width;
    let sh = source.height;
    let dx: number;
    let dy: number;
    let dw: number;
    let dh: number;
    if (args.length === 8) {
      [sx, sy, sw, sh, dx, dy, dw, dh] = args as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
    } else if (args.length === 4) {
      [dx, dy, dw, dh] = args as [number, number, number, number];
    } else if (args.length === 2) {
      [dx, dy] = args as [number, number];
      dw = sw;
      dh = sh;
    } else {
      throw new Error(`headless drawImage takes 3, 5 or 9 arguments`);
    }
    if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
    for (let row = 0; row < dh; row++) {
      const ty = Math.round(dy) + row;
      if (ty < 0 || ty >= this.canvas.height) continue;
      const srcY = sy + Math.floor((row * sh) / dh);
      if (srcY < 0 || srcY >= source.height) continue;
      for (let col = 0; col < dw; col++) {
        const tx = Math.round(dx) + col;
        if (tx < 0 || tx >= this.canvas.width) continue;
        const srcX = sx + Math.floor((col * sw) / dw);
        if (srcX < 0 || srcX >= source.width) continue;
        const from = (srcY * source.width + srcX) * 4;
        this.blend(tx, ty, {
          r: source.rgba[from]!,
          g: source.rgba[from + 1]!,
          b: source.rgba[from + 2]!,
          a: source.rgba[from + 3]! / 255,
        });
      }
    }
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    const colour = parseColor(this.fillStyle);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let row = 0; row < Math.round(height); row++) {
      for (let col = 0; col < Math.round(width); col++) {
        this.blend(x0 + col, y0 + row, colour);
      }
    }
  }

  /**
   * Draw text in the stand-in font, sized and positioned as the host would.
   *
   * The em box is the `font`'s pixel size, so a glyph scales with whatever cell
   * height the machine asked for; the advance is the 0.6em a monospace face
   * gives, which only matters for the multi-character strings (the missing-ROM
   * notices and the load-error banners) - the terminals place every character
   * themselves.
   */
  fillText(text: string, x: number, y: number): void {
    const size = /(\d+(?:\.\d+)?)px/.exec(this.font);
    const em = size ? Number(size[1]) : 10;
    const scale = em / GLYPH_BOX;
    const advance = Math.max(1, Math.round(em * 0.6));
    // 'top' puts y at the top of the em box; the default baseline sits on the
    // glyph's foot, which is one descender row up from the box's bottom.
    const top =
      this.textBaseline === 'top' ? y : y - (GLYPH_ROWS / GLYPH_BOX) * em;
    const colour = parseColor(this.fillStyle);
    for (let i = 0; i < text.length; i++) {
      const bits = GLYPHS[text.charCodeAt(i) - FIRST_GLYPH];
      const left = x + i * advance;
      if (!bits) continue;
      this.canvas.hostFontGlyphs++;
      for (let row = 0; row < GLYPH_ROWS; row++) {
        for (let col = 0; col < GLYPH_COLS; col++) {
          if (bits[row * GLYPH_COLS + col] !== '#') continue;
          // One source pixel covers a whole scaled block, so a glyph stays
          // solid rather than combing when the cell is several pixels tall.
          const px0 = Math.round(left + col * scale);
          const px1 = Math.max(px0 + 1, Math.round(left + (col + 1) * scale));
          const py0 = Math.round(top + row * scale);
          const py1 = Math.max(py0 + 1, Math.round(top + (row + 1) * scale));
          for (let py = py0; py < py1; py++) {
            for (let px = px0; px < px1; px++) this.blend(px, py, colour);
          }
        }
      }
    }
  }

  /** Source-over one pixel, which is what every draw here but an image does. */
  private blend(x: number, y: number, colour: Rgba): void {
    const { width, height, rgba } = this.canvas;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    const a = Math.min(1, Math.max(0, colour.a));
    if (a >= 1) {
      rgba[i] = colour.r;
      rgba[i + 1] = colour.g;
      rgba[i + 2] = colour.b;
      rgba[i + 3] = 255;
      return;
    }
    const keep = 1 - a;
    rgba[i] = colour.r * a + rgba[i]! * keep;
    rgba[i + 1] = colour.g * a + rgba[i + 1]! * keep;
    rgba[i + 2] = colour.b * a + rgba[i + 2]! * keep;
    rgba[i + 3] = Math.max(rgba[i + 3]!, Math.round(a * 255));
  }
}

/** A canvas backed by a plain RGBA buffer. */
export class HeadlessCanvas {
  /** Glyphs drawn in the stand-in font, i.e. how much of this is not exact. */
  hostFontGlyphs = 0;

  private context: HeadlessContext | null = null;
  private buffer: Uint8ClampedArray;
  private w: number;
  private h: number;

  constructor(width = 300, height = 150) {
    this.w = width;
    this.h = height;
    this.buffer = new Uint8ClampedArray(width * height * 4);
  }

  get width(): number {
    return this.w;
  }

  // Machines create a back canvas and size it afterwards, so a resize has to
  // reallocate; assigning the same size is left alone so it does not clear.
  set width(value: number) {
    if (value === this.w) return;
    this.w = value;
    this.buffer = new Uint8ClampedArray(this.w * this.h * 4);
  }

  get height(): number {
    return this.h;
  }

  set height(value: number) {
    if (value === this.h) return;
    this.h = value;
    this.buffer = new Uint8ClampedArray(this.w * this.h * 4);
  }

  get rgba(): Uint8ClampedArray {
    return this.buffer;
  }

  getContext(kind: string): HeadlessContext | null {
    if (kind !== '2d') return null;
    this.context ??= new HeadlessContext(this);
    return this.context;
  }

  /** The context, typed as the seam expects it. */
  get renderContext(): CanvasRenderingContext2D {
    return this.getContext('2d') as unknown as CanvasRenderingContext2D;
  }

  /** How many distinct colours are on it - a blank frame has one. */
  distinctColours(): number {
    const seen = new Set<number>();
    for (let i = 0; i < this.buffer.length; i += 4) {
      seen.add(
        (this.buffer[i]! << 24) |
          (this.buffer[i + 1]! << 16) |
          (this.buffer[i + 2]! << 8) |
          this.buffer[i + 3]!,
      );
      if (seen.size > 64) break;
    }
    return seen.size;
  }
}

/**
 * Give node the two globals the machines reach for while painting, and return
 * the undo.
 *
 * Six machines allocate a back canvas with `document.createElement('canvas')`
 * and seven construct an `ImageData` directly. Nothing else in a render path
 * touches the DOM.
 */
export function installCanvasGlobals(): () => void {
  const globals = globalThis as Record<string, unknown>;
  const previousDocument = globals.document;
  const previousImageData = globals.ImageData;
  globals.ImageData = HeadlessImageData;
  globals.document = {
    createElement(tag: string) {
      if (tag !== 'canvas') {
        throw new Error(`headless canvas cannot create a <${tag}>`);
      }
      return new HeadlessCanvas();
    },
  };
  return () => {
    globals.document = previousDocument;
    globals.ImageData = previousImageData;
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}

/** Encode an RGBA buffer as a PNG: 8 bits per channel, no filtering. */
export function encodePng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: truecolour with alpha
  // A scanline is prefixed with its filter type; 0 is "none", and the deflate
  // pass below does the compressing.
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}
