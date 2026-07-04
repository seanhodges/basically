/** How many payload bytes formatHexDump renders before truncating. */
export const HEX_DUMP_MAX_BYTES = 4096;

/**
 * Classic hex dump: 4-digit offset, 16 hex bytes, ASCII gutter. Truncates at
 * `maxBytes` (with a trailing note) so a large CODE block can't lock the DOM.
 */
export function formatHexDump(
  bytes: Uint8Array,
  maxBytes = HEX_DUMP_MAX_BYTES,
): string {
  const shown = Math.min(bytes.length, maxBytes);
  const lines: string[] = [];
  for (let off = 0; off < shown; off += 16) {
    const row = bytes.subarray(off, Math.min(off + 16, shown));
    const hex = [...row]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(16 * 3 - 1, ' ');
    const ascii = [...row]
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${off.toString(16).padStart(4, '0')}  ${hex}  |${ascii}|`);
  }
  if (bytes.length > shown) {
    lines.push(`… showing first ${shown} of ${bytes.length} bytes`);
  }
  return lines.join('\n');
}
