/**
 * Commodore VIC-20 PETSCII <-> editor text.
 *
 * PETSCII is shared across the Commodore 8-bit line, so the VIC-20's byte
 * mapping is byte-identical to the C64's; the C64 charset is simply re-exported
 * here as {@link vic20Charset}. The colour-control escapes the shared charset
 * understands ({red}, {cyan}, {rvon}…) are all meaningful on the VIC-20's
 * colour display, exactly as on the C64.
 */
export { c64Charset as vic20Charset } from '../commodore64/charset';
