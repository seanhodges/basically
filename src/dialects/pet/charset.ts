/**
 * Commodore PET PETSCII <-> editor text.
 *
 * PETSCII originated on the PET, so the byte mapping is byte-identical to the
 * C64's; the C64 charset is simply re-exported here as {@link petCharset}. The
 * only conceptual difference is that the colour-control escapes the shared
 * charset understands ({red}, {cyan}, {rvon}…) are meaningless-but-harmless
 * bytes on a monochrome PET: a program may still store and round-trip them, they
 * just have no visible effect on real PET hardware.
 */
export { c64Charset as petCharset } from '../commodore64/charset';
