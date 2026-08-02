import {
  buildFontSignatures,
  readFontText,
  type GlyphSignatures,
} from '../fontMatcher';
import { plainChar, mosaicChar } from '../../dialects/bbcmicro/charset';
import type { MachineScreenText } from '../../dialects/types';

/**
 * Recovering an Acorn screen as characters.
 *
 * The Acorn machines are two machines in one as far as this question goes.
 * MODE 7 is a teletext screen - a 40x25 matrix of character codes the SAA5050
 * turns into glyphs - and reads back exactly. Modes 0 to 6 are bitmaps with no
 * characters in them at all, and come back the way the Spectrum's and the
 * CPC's do: by matching each cell against the glyph the MOS would have drawn.
 *
 * Nothing here assumes a mode's usual layout. The 6845's own registers say how
 * wide the display is, how many rows it has and where it starts, so a hardware
 * scroll (which moves the start address, not the memory) or a `MODE` change is
 * followed rather than guessed at.
 */

/** Glyph rows a character occupies; modes 3 and 6 pad the row, not the glyph. */
const GLYPH_ROWS = 8;
/** Native pixels across a character cell, in every mode. */
const GLYPH_PIXELS = 8;

/**
 * Where each model keeps the font the MOS draws with, confirmed by reading the
 * real ROMs (see the colocated test, which pins a glyph in each).
 *
 * The Model B's OS 1.20 opens with the table: 96 glyphs for codes 32-127 at
 * &C000, which is always paged in, so it reads straight through the CPU.
 *
 * The Master's MOS 3.20 does not - &C000 there is code. Its font is the last
 * 1792 bytes of sideways ROM bank 15, covering codes 32-255, and that bank is
 * not paged in while a program runs. So it is read out of the ROM image
 * instead of through the CPU's current mapping.
 */
const B_FONT_ADDR = 0xc000;
const B_LAST_CODE = 0x7f;
const MASTER_FONT_BANK = 15;
const MASTER_FONT_OFFSET = 0x3900;
const MASTER_LAST_CODE = 0xff;
const FIRST_CODE = 0x20;

/** How the reader reaches the machine, without knowing it is jsbeeb. */
export interface AcornScreenPort {
  /** A byte as the video hardware fetches it (display address, not CPU). */
  videoRead(addr: number): number;
  /** A byte of sideways ROM bank `bank`, whatever is paged in right now. */
  romBankByte(bank: number, offset: number): number;
  /** A byte through the CPU's current mapping. */
  readmem(addr: number): number;
  /** 6845 register `reg`. */
  crtc(reg: number): number;
  /** True while the ULA is producing teletext. */
  teletext: boolean;
  /** ULA colour depth: 0 = 4 bits a pixel, 1 = 2 bits, 2 = 1 bit. */
  ulaMode: number;
  /** The system VIA's hardware-scroll wrap offset. */
  screenSubtract: number;
  isMaster: boolean;
}

/** Index the MOS font by glyph shape, once per machine. */
export function acornFontSignatures(port: AcornScreenPort): GlyphSignatures {
  return port.isMaster
    ? buildFontSignatures({
        glyphByte: (code, row) =>
          port.romBankByte(
            MASTER_FONT_BANK,
            MASTER_FONT_OFFSET + (code - FIRST_CODE) * GLYPH_ROWS + row,
          ),
        firstCode: FIRST_CODE,
        lastCode: MASTER_LAST_CODE,
      })
    : buildFontSignatures({
        glyphByte: (code, row) =>
          port.readmem(B_FONT_ADDR + (code - FIRST_CODE) * GLYPH_ROWS + row),
        firstCode: FIRST_CODE,
        lastCode: B_LAST_CODE,
      });
}

/** The CRTC's memory address for character cell (`row`, `col`). */
function crtcAddress(port: AcornScreenPort, row: number, col: number): number {
  const start = ((port.crtc(12) << 8) | port.crtc(13)) & 0x3fff;
  return (start + row * port.crtc(1) + col) & 0x3fff;
}

/**
 * The display address of a teletext cell.
 *
 * With MA13 set the CRTC is in "chunky" addressing: only the low ten bits of
 * the address matter and the scanline is ignored, so a 1K page maps to the top
 * of RAM - &7C00 on the Master and on a Model B whose MA11 is set, &3C00
 * otherwise (the Model B quirk jsbeeb's own video path models).
 */
function teletextAddress(port: AcornScreenPort, ma: number): number {
  const page = ma & 0x800 || port.isMaster ? 0x7c00 : 0x3c00;
  return (ma & 0x3ff) | page;
}

/**
 * The display address of scanline `raster` of the byte column at CRTC address
 * `ma`, the IC32/IC39 translation the Model B and the Master share: the low
 * eight address bits become the byte column, the scanline sits underneath, and
 * an address that has wrapped past the top of the screen is pulled back by the
 * VIA's hardware-scroll offset. That last step is what makes a scrolled screen
 * read back in the right order.
 */
function bitmapAddress(
  port: AcornScreenPort,
  ma: number,
  raster: number,
): number {
  const low = ma & 0x1fff;
  let high = (low >>> 8) & 0x0f;
  if (low & 0x1000) high = (high - port.screenSubtract) & 0x0f;
  return ((high << 11) | ((low & 0xff) << 3) | (raster & 0x07)) & 0x7fff;
}

/**
 * The SAA5050's state as it crosses a teletext row.
 *
 * The chip has a seven-bit data bus and starts every row in alphanumeric mode,
 * so a mosaic byte only draws as a mosaic once a graphics-colour control has
 * appeared to its left; before one, it draws the letter its low seven bits
 * name. Control codes themselves occupy a cell and display as a space.
 */
function teletextRow(bytes: readonly number[]): string {
  let graphics = false;
  let line = '';
  for (const byte of bytes) {
    const code = byte & 0x7f;
    if (code < 0x20) {
      if (code >= 0x01 && code <= 0x07) graphics = false;
      if (code >= 0x11 && code <= 0x17) graphics = true;
      line += ' ';
      continue;
    }
    // Alphanumerics go through the dialect charset, the same mapping a
    // listing uses, so a read and a listing agree about what a byte means.
    // (The SAA5050's own UK set differs from the MOS font in a handful of
    // punctuation slots - &23 draws a pound sign on a teletext screen, a hash
    // in every other mode - and the charset's view is the one the editor and
    // the reference pages already commit to.)
    const glyph =
      graphics && (code & 0x20) !== 0
        ? mosaicChar(code | 0x80)
        : plainChar(code);
    line += glyph !== undefined && [...glyph].length === 1 ? glyph : ' ';
  }
  return line;
}

/**
 * The screen as characters, or null when the display is not a text grid the
 * reader can decode - mid-reset, before the MOS has programmed the CRTC, or a
 * character row that is not eight scanlines of an eight-pixel cell.
 */
export function readAcornScreenText(
  port: AcornScreenPort,
  signatures: GlyphSignatures,
): MachineScreenText | null {
  const rows = port.crtc(6);
  const perLine = port.crtc(1);
  if (rows < 1 || perLine < 1) return null;

  if (port.teletext) {
    const lines = Array.from({ length: rows }, (_, row) =>
      teletextRow(
        Array.from({ length: perLine }, (_, col) =>
          port.videoRead(teletextAddress(port, crtcAddress(port, row, col))),
        ),
      ),
    );
    return { lines, cols: perLine, rows };
  }

  // The ULA's own setting is the text width: 10, 20, 40 or 80 characters a
  // line. The CRTC says how many bytes it fetches for that line, so the two
  // together give the depth without needing to know the mode number or the
  // CRTC's clock - 80 bytes across 40 characters is two bytes a cell, which is
  // two bits a pixel.
  const cols = [10, 20, 40, 80][port.ulaMode];
  if (cols === undefined) return null;
  const bytesPerChar = Math.floor(perLine / cols);
  if (bytesPerChar < 1) return null;
  const pixelsPerByte = GLYPH_PIXELS / bytesPerChar;
  const bitsPerPixel = bytesPerChar;

  const lines = readFontText({
    signatures,
    cols,
    rows,
    charFor: (code) => plainChar(code) ?? ' ',
    cellMask: (row, col) =>
      Array.from({ length: GLYPH_ROWS }, (_, raster) => {
        let mask = 0;
        for (let byte = 0; byte < bytesPerChar; byte++) {
          const ma = crtcAddress(port, row, col * bytesPerChar + byte);
          const value = port.videoRead(bitmapAddress(port, ma, raster));
          // A pixel's bits are spread one plane apart across the byte, so
          // pixel p is ink when any of its planes is set - which is all this
          // needs to know, the colour itself being someone else's question.
          for (let p = 0; p < pixelsPerByte; p++) {
            let bits = 0;
            for (let plane = 0; plane < bitsPerPixel; plane++) {
              bits |= 0x80 >> (p + plane * pixelsPerByte);
            }
            if (value & bits) mask |= 0x80 >> (byte * pixelsPerByte + p);
          }
        }
        return mask;
      }),
  });
  return { lines, cols, rows };
}
