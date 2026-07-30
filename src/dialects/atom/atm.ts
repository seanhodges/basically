/**
 * Acorn Atom `.atm` native binary format - the de-facto interchange format used
 * by Atom emulators (Atomulator, AtoMMC) and the closest thing the Atom has to a
 * "native binary". An `.atm` file is a 22-byte header followed by the raw memory
 * image:
 *
 * ```
 *  0..15  filename, ASCII, NUL-padded to 16 bytes
 * 16..17  load address  (little-endian)
 * 18..19  exec address  (little-endian)
 * 20..21  data length   (little-endian)
 * 22..    data bytes
 * ```
 *
 * For a BASIC program the data is exactly the `#2900` program image the
 * tokenizer produces (line records ending in `0D FF`), so an `.atm` is just that
 * image wrapped in the header with `load = exec = #2900`.
 */

/** Fixed size of the `.atm` header that precedes the data. */
import { TEXT_START } from './addresses';

export const ATM_HEADER_SIZE = 22;

const NAME_FIELD = 16;

function nameBytes(name: string): Uint8Array {
  const cleaned =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, NAME_FIELD) || 'PROGRAM';
  const out = new Uint8Array(NAME_FIELD); // NUL-padded
  for (let i = 0; i < cleaned.length; i++) out[i] = cleaned.charCodeAt(i);
  return out;
}

/** Wrap a raw `#2900` program image in the `.atm` header. */
export function buildAtm(image: Uint8Array, name: string): Uint8Array {
  const out = new Uint8Array(ATM_HEADER_SIZE + image.length);
  out.set(nameBytes(name), 0);
  const u16 = (off: number, v: number) => {
    out[off] = v & 0xff;
    out[off + 1] = (v >> 8) & 0xff;
  };
  u16(16, TEXT_START); // load
  u16(18, TEXT_START); // exec
  u16(20, image.length); // data length
  out.set(image, ATM_HEADER_SIZE);
  return out;
}

/**
 * Recover the raw `#2900` program image from a file that may be either an `.atm`
 * (header + data) or already a bare image. A bare image always begins with the
 * `0D` line marker; an `.atm` begins with its filename field, and its length
 * word matches the trailing data, which is how the two are told apart.
 *
 * Throws a clear "not a BASIC program" error for an `.atm` that is plainly not
 * a BASIC text image - one whose load address isn't `#2900`, or whose payload
 * doesn't begin with the `0D` line marker (a machine-code or data `.atm`) - so
 * the import surfaces the problem instead of silently yielding an empty document.
 */
export function stripAtmHeader(file: Uint8Array): Uint8Array {
  if (file.length >= 1 && file[0] === 0x0d) return file; // bare image
  if (file.length >= ATM_HEADER_SIZE) {
    const load = file[16]! | (file[17]! << 8);
    const data = file.subarray(ATM_HEADER_SIZE);
    if (load !== TEXT_START || data[0] !== 0x0d) {
      const hex = load.toString(16).toUpperCase().padStart(4, '0');
      throw new Error(
        `Not an Atom BASIC program: the .atm loads at #${hex} (BASIC text ` +
          `lives at #2900) — this looks like a machine-code or data file.`,
      );
    }
    return data;
  }
  throw new Error(
    'Not an Atom BASIC program: too short to be a #2900 image or .atm file.',
  );
}

/**
 * Read the header fields and payload of an `.atm` file, making no judgement
 * about its load address. Unlike {@link stripAtmHeader} - the BASIC-only fast
 * path that rejects anything that isn't a `#2900` text image - this is how the
 * importer recovers a machine-code or data `.atm` (one that loads somewhere
 * other than `#2900`) as a memory block. `data` is the payload up to the
 * header's declared length, clamped to the bytes actually present.
 *
 * The caller must have already established `file` is an `.atm` and not a bare
 * `#2900` image (`file.length >= ATM_HEADER_SIZE` and `file[0] !== 0x0d`); see
 * {@link import('./detokenizer').detokenizeProgramWithReport}.
 */
export function parseAtm(file: Uint8Array): {
  name: string;
  load: number;
  exec: number;
  data: Uint8Array;
} {
  const load = file[16]! | (file[17]! << 8);
  const exec = file[18]! | (file[19]! << 8);
  const length = file[20]! | (file[21]! << 8);
  const data = file.subarray(ATM_HEADER_SIZE, ATM_HEADER_SIZE + length);
  return { name: atmName(file), load, exec, data };
}

/** Read the program name from an `.atm` header (empty for a bare image). */
export function atmName(file: Uint8Array): string {
  if (file.length < ATM_HEADER_SIZE || file[0] === 0x0d) return '';
  let name = '';
  for (let i = 0; i < NAME_FIELD; i++) {
    const c = file[i]!;
    if (c === 0x00) break;
    name += String.fromCharCode(c);
  }
  return name;
}
