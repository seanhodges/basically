/**
 * AMSDOS `.bas` container: a 128-byte header (file type, length fields,
 * 16-bit checksum over bytes 0–66) ahead of the tokenized program. The
 * builder/parser accepts headerless (raw tokenized) images too, so `.bas`
 * files from either source import cleanly. Stage 1 fills this in; see
 * docs/contributing/dialect-plans/cpc464.md.
 */

/** Wrap a tokenized program in an AMSDOS header. */
export function buildBasFile(_program: Uint8Array): Uint8Array {
  throw new Error('cpc464: not implemented');
}

/** Unwrap an AMSDOS-headered (or raw) tokenized program image. */
export function parseBasFile(_image: Uint8Array): {
  program: Uint8Array;
  warnings: string[];
} {
  throw new Error('cpc464: not implemented');
}
