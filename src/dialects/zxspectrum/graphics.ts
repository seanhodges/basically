import type { GraphicEntry } from '../../keyboard/layoutSchema';

/**
 * The ZX Spectrum's graphics-mode characters and the keys that type them,
 * decoded from `K-DECODE` in `public/roms/zxspectrum.rom` rather than read off a
 * picture of the keyboard.
 *
 * On entry to that routine `C` holds `MODE` (0 = K/L/C, 1 = E, 2 = G), `A`/`E`
 * hold the character from the main key table at 0x0205 - which stores letters
 * **uppercase** - and `B` is 0xFF when no shift is held.
 *
 * **Letters become user-defined graphics.** The graphics branch of the mode
 * dispatch at 0x0333 is a single instruction, `ADD A,$4F` at 0x033E:
 *
 * ```
 * 0338  DEC C
 * 0339  JP M,$034F      ; MODE 0: ordinary letter
 * 033C  JR Z,$0341      ; MODE 1: extended
 * 033E  ADD A,$4F       ; MODE 2 (graphics)
 * ```
 *
 * so `code = uppercase ASCII + 0x4F`: `A` (0x41) becomes 0x90 and `U` (0x55)
 * becomes 0xA4 - twenty-one letters onto exactly the twenty-one UDG codes,
 * ending on the `UDG_LAST` the charset already declares.
 *
 * **Digits become block graphics.** At 0x0389, reached when `MODE` is 2:
 *
 * ```
 * 038C  CP $39 / JR Z   ; '9' and '0' are handled elsewhere
 * 0390  CP $30 / JR Z   ; (mode toggle and delete)
 * 0394  AND $07
 * 0396  ADD A,$80       ; code = 0x80 + (ASCII & 7)
 * 0398  INC B
 * 0399  RET Z           ; unshifted: done
 * 039A  XOR $0F         ; shifted: complement the quadrant bits
 * 039C  RET
 * ```
 *
 * `ASCII & 7` maps '1'-'7' to 1-7 and **'8' to 0**, and `XOR $0F` complements
 * all four quadrant bits, which is exactly inverse video. Eight keys times two
 * shift states therefore cover all sixteen codes exactly once - note that key 8
 * carries the blank and the solid block rather than a quadrant, the one
 * assignment nobody would guess from the keycaps. The ROM complements on any
 * shift reaching that point, but CAPS SHIFT is the documented modifier and is
 * what the palette shows.
 */

/** MODE 2 turns a digit key into `0x80 + (ASCII & 7)`; CAPS SHIFT inverts it. */
const BLOCK_BASE = 0x80;
/** MODE 2 turns a letter key into `uppercase ASCII + UDG_OFFSET`. */
const UDG_OFFSET = 0x4f;

/** The graphics-mode digit keys, in keycap order. */
const BLOCK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/** The graphics-mode letter keys: A-U, the twenty-one user-defined graphics. */
const UDG_KEYS = [...'ABCDEFGHIJKLMNOPQRSTU'];

/** The character each block-graphics code renders as (charset's own table). */
const BLOCK_CHARS: Record<number, string> = {
  0x80: ' ',
  0x81: '▘',
  0x82: '▝',
  0x83: '▀',
  0x84: '▖',
  0x85: '▌',
  0x86: '▞',
  0x87: '▛',
  0x88: '▗',
  0x89: '▚',
  0x8a: '▐',
  0x8b: '▜',
  0x8c: '▄',
  0x8d: '▙',
  0x8e: '▟',
  0x8f: '█',
};

/**
 * The sixteen block graphics, 0x80-0x8F: each digit key unshifted, then the same
 * key under CAPS SHIFT with the quadrant bits complemented.
 */
export const SPECTRUM_BLOCK_GRAPHICS: GraphicEntry[] = [
  ...BLOCK_KEYS.map((key) => {
    const code = BLOCK_BASE + (key.charCodeAt(0) & 7);
    return { key, char: BLOCK_CHARS[code]!, code };
  }),
  ...BLOCK_KEYS.map((key) => {
    const code = (BLOCK_BASE + (key.charCodeAt(0) & 7)) ^ 0x0f;
    return { key, modifier: 'CAPS', char: BLOCK_CHARS[code]!, code };
  }),
];

/**
 * The twenty-one user-defined graphics, 0x90-0xA4. Their shapes live in the
 * machine's UDG RAM and are whatever the program puts there, so the palette
 * shows the charset's own text form for each - the `\a`-`\u` escape.
 */
export const SPECTRUM_UDG_GRAPHICS: GraphicEntry[] = UDG_KEYS.map((key) => ({
  key,
  char: `\\${key.toLowerCase()}`,
  code: key.charCodeAt(0) + UDG_OFFSET,
}));

/** Both sets, in code order, for the charset and the round-trip tests. */
export const SPECTRUM_GRAPHICS: GraphicEntry[] = [
  ...SPECTRUM_BLOCK_GRAPHICS,
  ...SPECTRUM_UDG_GRAPHICS,
];

/** The block-graphics table as the charset wants it: code -> character. */
export const BLOCK_GRAPHIC_UNICODE: Record<number, string> = Object.fromEntries(
  SPECTRUM_BLOCK_GRAPHICS.map(({ code, char }) => [code, char]),
);
