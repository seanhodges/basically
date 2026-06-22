import { atomCharset } from './charset';
import { stripAtmHeader } from './atm';

/**
 * Convert an Atom BASIC program image (the `#2900` in-memory layout produced by
 * {@link import('./tokenizer').tokenizeProgram}) back into editable text. Each
 * line is `0D` then a big-endian line number then the ASCII body; the program
 * ends with `0D FF`. Bodies are stored verbatim, so this is a faithful inverse
 * of the tokenizer: line number as decimal digits followed by the body mapped
 * back through the charset.
 *
 * Accepts either a bare `#2900` image or a full `.atm` file (header + data);
 * {@link stripAtmHeader} unwraps the latter, so it drives the `.atm` import too.
 */
export function detokenizeProgram(file: Uint8Array): string {
  const image = stripAtmHeader(file);
  const lines: string[] = [];
  let p = 0;

  while (p + 2 < image.length && image[p] === 0x0d && image[p + 1] !== 0xff) {
    const lineNo = (image[p + 1]! << 8) | image[p + 2]!;
    // The body runs to the next 0x0D start-of-line marker (or end of image).
    let end = p + 3;
    while (end < image.length && image[end] !== 0x0d) end++;
    const body = atomCharset.toUnicode(image.subarray(p + 3, end));
    lines.push(`${lineNo}${body}`);
    p = end;
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
